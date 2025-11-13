// public/scripts/favorites.js
// Favorites functionality for playlists

// Use global supabase instead of import
const getSupabase = () => window.supabase;

// Cache for favorites to avoid repeated API calls
const favoritesCache = new Map();
const cacheExpiry = 5 * 60 * 1000; // 5 minutes

// Check if a playlist is favorited by current user with caching
export async function isPlaylistFavorited(playlistId) {
    try {
        if (!window.supabase) {
            console.warn('Supabase not available');
            return false;
        }
        
        const { data: { user } } = await window.supabase.auth.getUser();
        if (!user) return false;

        // Check cache first
        const cacheKey = `${user.id}:${playlistId}`;
        const cached = favoritesCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cacheExpiry) {
            return cached.value;
        }

        // Use count instead of select to avoid 406 errors
        const { count, error } = await window.supabase
            .from('user_favorites')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('playlist_id', playlistId);

        if (error) {
            console.error('Error checking favorite status:', error);
            // Try fallback with different approach
            try {
                const { data: fallbackData, error: fallbackError } = await window.supabase
                    .from('user_favorites')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('playlist_id', playlistId)
                    .maybeSingle();
                    
                if (fallbackError) {
                    console.error('Fallback favorite check failed:', fallbackError);
                    return false;
                }
                
                const result = !!fallbackData;
                // Cache the result
                favoritesCache.set(cacheKey, { value: result, timestamp: Date.now() });
                return result;
                
            } catch (fallbackErr) {
                console.error('Complete favorite check failure:', fallbackErr);
                return false;
            }
        }

        const result = (count || 0) > 0;
        
        // Cache the result
        favoritesCache.set(cacheKey, { value: result, timestamp: Date.now() });
        
        return result;
    } catch (error) {
        console.error('Error in isPlaylistFavorited:', error);
        return false;
    }
}

// Add playlist to favorites
export async function addToFavorites(playlistId) {
    try {
        const supabase = getSupabase();
        if (!supabase) throw new Error('Supabase not available');
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error('User not authenticated');
        }

        const { data, error } = await supabase
            .from('user_favorites')
            .insert({
                user_id: user.id,
                playlist_id: playlistId
            })
            .select()
            .single();

        if (error) throw error;
        
        // Invalidate cache
        const cacheKey = `${user.id}:${playlistId}`;
        favoritesCache.delete(cacheKey);
        
        console.log('Playlist added to favorites:', data);
        return data;
    } catch (error) {
        if (error.code === '23505') {
            // Unique constraint violation - playlist already favorited
            throw new Error('Playlist đã có trong danh sách yêu thích');
        }
        console.error('Error adding to favorites:', error);
        throw error;
    }
}

// Remove playlist from favorites
export async function removeFromFavorites(playlistId) {
    try {
        const supabase = getSupabase();
        if (!supabase) throw new Error('Supabase not available');
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error('User not authenticated');
        }

        const { error } = await supabase
            .from('user_favorites')
            .delete()
            .eq('user_id', user.id)
            .eq('playlist_id', playlistId);

        if (error) throw error;
        
        // Invalidate cache
        const cacheKey = `${user.id}:${playlistId}`;
        favoritesCache.delete(cacheKey);
        
        console.log('Playlist removed from favorites:', playlistId);
        return true;
    } catch (error) {
        console.error('Error removing from favorites:', error);
        throw error;
    }
}

// Toggle favorite status
export async function togglePlaylistFavorite(playlistId) {
    try {
        const isFavorited = await isPlaylistFavorited(playlistId);
        
        if (isFavorited) {
            await removeFromFavorites(playlistId);
            return false; // Now unfavorited
        } else {
            await addToFavorites(playlistId);
            return true; // Now favorited
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        throw error;
    }
}

// Get user's favorite playlists
export async function getUserFavorites(limit = 20, offset = 0) {
    try {
        const supabase = getSupabase();
        if (!supabase) return [];
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('user_favorites')
            .select(`
                id,
                created_at,
                playlists (
                    id,
                    name,
                    description,
                    color,
                    cover_url,
                    is_public,
                    created_at,
                    user_id,
                    users (username)
                )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        // Transform data to match playlist format
        return data.map(fav => ({
            ...fav.playlists,
            favorited_at: fav.created_at,
            owner_username: fav.playlists.users?.username
        }));
    } catch (error) {
        console.error('Error getting user favorites:', error);
        return [];
    }
}

// Search playlists (both public and user's own)
export async function searchPlaylists(query, filters = {}) {
    try {
        const supabase = getSupabase();
        if (!supabase) return [];
        
        const { data: { user } } = await supabase.auth.getUser();
        
        let supabaseQuery = supabase
            .from('playlists')
            .select(`
                id,
                name,
                description,
                color,
                cover_url,
                is_public,
                created_at,
                user_id,
                users (username)
            `);

        // Search by name and description
        if (query && query.trim()) {
            const searchTerm = query.trim();
            supabaseQuery = supabaseQuery.or(
                `name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`
            );
        }

        // Apply filters
        if (filters.isPublic !== undefined) {
            supabaseQuery = supabaseQuery.eq('is_public', filters.isPublic);
        } else if (filters.userOnly && user) {
            // Show only user's own playlists
            supabaseQuery = supabaseQuery.eq('user_id', user.id);
        } else {
            // Show public playlists OR user's own playlists
            if (user) {
                supabaseQuery = supabaseQuery.or(`is_public.eq.true,user_id.eq.${user.id}`);
            } else {
                supabaseQuery = supabaseQuery.eq('is_public', true);
            }
        }

        if (filters.userId) {
            supabaseQuery = supabaseQuery.eq('user_id', filters.userId);
        }

        // Ordering and limiting
        supabaseQuery = supabaseQuery
            .order('created_at', { ascending: false })
            .limit(filters.limit || 20);

        const { data, error } = await supabaseQuery;

        if (error) throw error;

        // Add owner username to results
        return data.map(playlist => ({
            ...playlist,
            owner_username: playlist.users?.username
        }));
    } catch (error) {
        console.error('Error searching playlists:', error);
        return [];
    }
}

// Export functions to global scope
window.isPlaylistFavorited = isPlaylistFavorited;
window.addToFavorites = addToFavorites;
window.removeFromFavorites = removeFromFavorites;
window.togglePlaylistFavorite = togglePlaylistFavorite;
window.getUserFavorites = getUserFavorites;
window.searchPlaylists = searchPlaylists;