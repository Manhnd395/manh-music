// public/scripts/favorites-page.js
// Favorites page functionality

// Use global functions instead of imports
let getUserFavorites, isPlaylistFavorited;

// Initialize when functions are available
function initializeFavoritesFunctions() {
    if (window.getUserFavorites && window.isPlaylistFavorited) {
        getUserFavorites = window.getUserFavorites;
        isPlaylistFavorited = window.isPlaylistFavorited;
        return true;
    }
    return false;
}

// Load and display user's favorite playlists
export async function loadFavoritesPage() {
    const favoritesGrid = document.getElementById('favoritesGrid');
    const favoritesEmpty = document.getElementById('favoritesEmpty');
    
    if (!favoritesGrid) {
        console.warn('Favorites grid not found');
        return;
    }

    // Wait for functions to be available
    if (!initializeFavoritesFunctions()) {
        setTimeout(loadFavoritesPage, 200);
        return;
    }

    try {
        // Show loading state
        favoritesGrid.innerHTML = `
            <div class="search-loading">
                <span>Đang tải playlist yêu thích...</span>
            </div>
        `;
        
        if (favoritesEmpty) {
            favoritesEmpty.style.display = 'none';
        }

        // Fetch user's favorite playlists
        const favorites = await getUserFavorites(50); // Load up to 50 favorites

        if (favorites.length === 0) {
            // Show empty state
            favoritesGrid.innerHTML = '';
            if (favoritesEmpty) {
                favoritesEmpty.style.display = 'block';
            }
            return;
        }

        // Render favorite playlists
        const favoritesHTML = favorites.map(playlist => 
            createFavoritePlaylistCard(playlist)
        ).join('');

        favoritesGrid.innerHTML = favoritesHTML;
        
        if (favoritesEmpty) {
            favoritesEmpty.style.display = 'none';
        }

        // Add event listeners
        addFavoritesEventListeners();

        console.log(`Loaded ${favorites.length} favorite playlists`);

    } catch (error) {
        console.error('Error loading favorites page:', error);
        favoritesGrid.innerHTML = `
            <div class="error-message">
                <p>Có lỗi khi tải danh sách yêu thích</p>
                <button onclick="window.loadFavoritesPage()" class="btn-retry">Thử lại</button>
            </div>
        `;
    }
}

// Create favorite playlist card HTML
function createFavoritePlaylistCard(playlist) {
    const defaultCover = 'https://lezswjtnlsmznkgrzgmu.supabase.co/storage/v1/object/public/cover/449bd474-7a51-4c22-b4a4-2ad8736d6fad/default-cover.webp';
    const coverUrl = playlist.cover_url || defaultCover;
    const ownerUsername = playlist.owner_username || 'Unknown';
    const favoriteDate = new Date(playlist.favorited_at).toLocaleDateString('vi-VN');
    
    return `
        <div class="playlist-card favorite-card" 
             data-playlist-id="${playlist.id}"
             style="background: linear-gradient(135deg, ${playlist.color || '#1db954'}, #000);">
            
            <button class="favorite-btn favorited" 
                    data-playlist-id="${playlist.id}"
                    aria-label="Bỏ yêu thích">
                <span class="favorite-icon"></span>
            </button>
            
            <div class="playlist-info">
                <img src="${coverUrl}" 
                     alt="Playlist cover" 
                     class="playlist-cover"
                     onerror="this.src='${defaultCover}'">
                     
                <h3 class="playlist-name">${escapeHtml(playlist.name)}</h3>
                
                <p class="playlist-meta">
                    Bởi: ${escapeHtml(ownerUsername)}
                    ${playlist.is_public ? '• Công khai' : '• Riêng tư'}
                </p>
                
                <p class="playlist-favorite-date">
                    Yêu thích từ: ${favoriteDate}
                </p>
                
                ${playlist.description ? 
                    `<p class="playlist-description">${escapeHtml(playlist.description)}</p>` 
                    : ''
                }
            </div>
        </div>
    `;
}

// Add event listeners for favorites page
function addFavoritesEventListeners() {
    // Playlist card clicks
    document.querySelectorAll('#favoritesGrid .playlist-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking favorite button
            if (e.target.closest('.favorite-btn')) return;
            
            const playlistId = card.dataset.playlistId;
            if (playlistId && window.switchTab) {
                window.switchTab('detail-playlist', playlistId);
            }
        });
    });

    // Favorite button clicks (to remove from favorites)
    document.querySelectorAll('#favoritesGrid .favorite-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const playlistId = btn.dataset.playlistId;
            if (!playlistId) return;
            
            // Confirm removal
            const confirmed = confirm('Bạn có chắc muốn bỏ playlist này khỏi danh sách yêu thích?');
            if (!confirmed) return;
            
            try {
                // Remove from favorites
                await window.removeFromFavorites(playlistId);
                
                // Remove card from UI
                const card = btn.closest('.playlist-card');
                if (card) {
                    card.style.animation = 'fadeOut 0.3s ease-out';
                    setTimeout(() => {
                        card.remove();
                        
                        // Check if favorites grid is empty
                        const remainingCards = document.querySelectorAll('#favoritesGrid .playlist-card');
                        if (remainingCards.length === 0) {
                            const favoritesEmpty = document.getElementById('favoritesEmpty');
                            if (favoritesEmpty) {
                                favoritesEmpty.style.display = 'block';
                            }
                        }
                    }, 300);
                }
                
                showToast('Đã bỏ khỏi danh sách yêu thích');
                
            } catch (error) {
                console.error('Error removing from favorites:', error);
                showToast('Có lỗi xảy ra. Vui lòng thử lại.', 'error');
            }
        });
    });
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
window.loadFavoritesPage = loadFavoritesPage;

// Auto-load favorites when favorites tab is shown
document.addEventListener('DOMContentLoaded', () => {
    // Listen for tab switches
    const originalSwitchTab = window.switchTab;
    if (originalSwitchTab) {
        window.switchTab = function(tabName, param) {
            const result = originalSwitchTab.call(this, tabName, param);
            
            if (tabName === 'favorites') {
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    loadFavoritesPage();
                }, 100);
            }
            
            return result;
        };
    }
});