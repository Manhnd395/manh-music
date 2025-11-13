// public/scripts/playlist-favorites.js
// Add favorites functionality to existing playlist cards

// Use global functions instead of imports for better compatibility
let isPlaylistFavorited, togglePlaylistFavorite;

// Initialize when functions are available
function initializeFavoritesFunctions() {
    if (window.isPlaylistFavorited && window.togglePlaylistFavorite) {
        isPlaylistFavorited = window.isPlaylistFavorited;
        togglePlaylistFavorite = window.togglePlaylistFavorite;
        return true;
    }
    return false;
}

// Enhanced renderPlaylists function with favorites support
export async function renderPlaylistsWithFavorites(playlists, container, options = {}) {
    if (!playlists || playlists.length === 0) {
        container.innerHTML = '<p class="empty-message">Chưa có playlist nào.</p>';
        return;
    }

    // Wait for functions to be available
    if (!initializeFavoritesFunctions()) {
        setTimeout(() => renderPlaylistsWithFavorites(playlists, container, options), 200);
        return;
    }

    const { showFavoriteButtons = true, showOwner = true } = options;
    container.innerHTML = '';

    // Get favorite status for all playlists in parallel for better performance
    let favoriteStatuses = {};
    if (showFavoriteButtons) {
        try {
            const favoritePromises = playlists.map(async (playlist) => {
                const isFavorited = await isPlaylistFavorited(playlist.id);
                return { id: playlist.id, isFavorited };
            });
            
            const results = await Promise.all(favoritePromises);
            favoriteStatuses = results.reduce((acc, result) => {
                acc[result.id] = result.isFavorited;
                return acc;
            }, {});
        } catch (error) {
            console.error('Error fetching favorite statuses:', error);
            // Continue without favorite functionality
        }
    }

    playlists.forEach(playlist => {
        const card = document.createElement('div');
        card.className = 'playlist-card spotify-style';
        card.dataset.playlistId = playlist.id;

        // Apply color from database
        const color = playlist.color || '#1DB954';
        card.style.setProperty('--card-primary-color', color);
        card.style.setProperty('--card-secondary-color', '#282828');

        let coverHtml = '';
        const defaultCover = 'https://lezswjtnlsmznkgrzgmu.supabase.co/storage/v1/object/public/cover/449bd474-7a51-4c22-b4a4-2ad8736d6fad/default-cover.webp';
        
        if (playlist.cover_url) {
            const coverUrl = playlist.cover_url.startsWith('http') 
                ? playlist.cover_url 
                : getPublicPlaylistCoverUrl(playlist.cover_url);
            coverHtml = `<div class="playlist-cover-img" style="background-image:url('${coverUrl}');"></div>`;
        } else {
            // Use default cover image instead of placeholder
            coverHtml = `<div class="playlist-cover-img" style="background-image:url('${defaultCover}');"></div>`;
        }

        // Get track count from playlist_tracks.count if available
        let trackCount = 0;
        if (playlist.playlist_tracks && typeof playlist.playlist_tracks.count === 'number') {
            trackCount = playlist.playlist_tracks.count;
        } else if (playlist.track_count) {
            trackCount = playlist.track_count;
        }

        // Owner line
        const ownerLine = showOwner && playlist.owner_username 
            ? `<p class="playlist-owner" style="font-size:12px;color:#aaa;margin-top:4px;">by ${escapeHtml(playlist.owner_username)}</p>` 
            : '';

        // Favorite button
        const isFavorited = favoriteStatuses[playlist.id] || false;
        const favoriteButton = showFavoriteButtons 
            ? `<button class="favorite-btn ${isFavorited ? 'favorited' : ''}" 
                       data-playlist-id="${playlist.id}"
                       aria-label="${isFavorited ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}">
                   <span class="favorite-icon"></span>
               </button>`
            : '';

        card.innerHTML = `
            ${favoriteButton}
            ${coverHtml}
            <div class="playlist-info">
                <h3>${escapeHtml(playlist.name)}</h3>
                <p>${trackCount} bài hát</p>
                ${ownerLine}
            </div>
        `;

        // Add click listener for playlist (excluding favorite button)
        card.addEventListener('click', (e) => {
            if (e.target.closest('.favorite-btn')) return;
            window.switchTab('detail-playlist', playlist.id);
        });

        container.appendChild(card);
    });

    // Add event listeners for favorite buttons
    if (showFavoriteButtons) {
        addFavoriteButtonListeners(container);
    }
}

// Add event listeners for favorite buttons in a container
export function addFavoriteButtonListeners(container) {
    const favoriteButtons = container.querySelectorAll('.favorite-btn');
    
    favoriteButtons.forEach(btn => {
        // Remove existing listeners to prevent duplicates
        btn.replaceWith(btn.cloneNode(true));
    });

    // Add new listeners
    const newFavoriteButtons = container.querySelectorAll('.favorite-btn');
    newFavoriteButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const playlistId = btn.dataset.playlistId;
            if (!playlistId) return;
            
            try {
                // Optimistic update
                const wasFavorited = btn.classList.contains('favorited');
                btn.classList.toggle('favorited');
                btn.setAttribute('aria-label', 
                    wasFavorited ? 'Thêm vào yêu thích' : 'Bỏ yêu thích'
                );
                
                // Call API
                const newFavoriteStatus = await togglePlaylistFavorite(playlistId);
                
                // Update UI to match actual result
                if (newFavoriteStatus !== !wasFavorited) {
                    btn.classList.toggle('favorited');
                    btn.setAttribute('aria-label', 
                        newFavoriteStatus ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'
                    );
                }
                
                // Show feedback
                showToast(newFavoriteStatus ? 
                    'Đã thêm vào yêu thích' : 
                    'Đã bỏ khỏi yêu thích'
                );
                
            } catch (error) {
                console.error('Error toggling favorite:', error);
                // Revert optimistic update
                btn.classList.toggle('favorited');
                showToast('Có lỗi xảy ra. Vui lòng thử lại.', 'error');
            }
        });
    });
}

// Update existing playlist cards to include favorite buttons
export async function updatePlaylistCardsWithFavorites(containerSelector = '.playlist-grid') {
    const containers = document.querySelectorAll(containerSelector);
    
    for (const container of containers) {
        const playlistCards = container.querySelectorAll('.playlist-card');
        
        for (const card of playlistCards) {
            const playlistId = card.dataset.playlistId;
            if (!playlistId) continue;

            // Check if favorite button already exists
            if (card.querySelector('.favorite-btn')) continue;

            try {
                // Check if playlist is favorited
                const isFavorited = await isPlaylistFavorited(playlistId);
                
                // Create favorite button
                const favoriteButton = document.createElement('button');
                favoriteButton.className = `favorite-btn ${isFavorited ? 'favorited' : ''}`;
                favoriteButton.dataset.playlistId = playlistId;
                favoriteButton.setAttribute('aria-label', 
                    isFavorited ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'
                );
                favoriteButton.innerHTML = '<span class="favorite-icon"></span>';
                
                // Insert as first child
                card.insertBefore(favoriteButton, card.firstChild);
                
            } catch (error) {
                console.error(`Error adding favorite button to playlist ${playlistId}:`, error);
            }
        }
        
        // Add event listeners for favorite buttons
        addFavoriteButtonListeners(container);
    }
}

// Helper function for public playlist cover URL
function getPublicPlaylistCoverUrl(coverPath) {
    if (!coverPath) return null;
    if (coverPath.includes('supabase.co') || coverPath.startsWith('http')) return coverPath;
    
    // Assuming supabase is available globally
    if (window.supabase) {
        const { data } = window.supabase.storage.from('cover').getPublicUrl(coverPath);
        return data.publicUrl;
    }
    
    return coverPath;
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show toast notification
function showToast(message, type = 'success') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Style the toast
    Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: type === 'error' ? '#f44336' : '#1DB954',
        color: 'white',
        padding: '12px 20px',
        borderRadius: '8px',
        zIndex: '10000',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        transform: 'translateX(400px)',
        transition: 'transform 0.3s ease-out'
    });
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Animate out and remove
    setTimeout(() => {
        toast.style.transform = 'translateX(400px)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Export functions
window.renderPlaylistsWithFavorites = renderPlaylistsWithFavorites;
window.updatePlaylistCardsWithFavorites = updatePlaylistCardsWithFavorites;
window.addFavoriteButtonListeners = addFavoriteButtonListeners;

// Auto-initialize when app is ready
document.addEventListener('DOMContentLoaded', () => {
    // Listen for APP_READY event
    window.addEventListener('APP_READY', () => {
        setTimeout(() => {
            updatePlaylistCardsWithFavorites('.playlist-grid');
        }, 500);
    });
    
    // Also check every few seconds in case playlists are loaded dynamically
    setInterval(() => {
        updatePlaylistCardsWithFavorites('.playlist-grid');
    }, 5000);
});