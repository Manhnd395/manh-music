// public/scripts/favorites.js
// Favorites functionality for playlists

import { supabase } from './supabase/client.js';

// Check if a playlist is favorited by current user
export async function isPlaylistFavorited(playlistId) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { data, error } = await supabase
            .from('user_favorites')
            .select('id')
            .eq('user_id', user.id)
            .eq('playlist_id', playlistId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error checking favorite status:', error);
            return false;
        }

        return !!data;
    } catch (error) {
        console.error('Error in isPlaylistFavorited:', error);
        return false;
    }
}

// Add playlist to favorites
export async function addToFavorites(playlistId) {
    try {
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
        
        console.log('Playlist removed from favorites');
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