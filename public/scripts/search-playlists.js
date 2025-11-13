// public/scripts/search-playlists.js
// Playlist search functionality

// Import required functions - use relative import for better compatibility
let searchPlaylists, isPlaylistFavorited;

// Initialize imports when available
function initializeImports() {
    if (window.searchPlaylists && window.isPlaylistFavorited) {
        searchPlaylists = window.searchPlaylists;
        isPlaylistFavorited = window.isPlaylistFavorited;
        return true;
    }
    return false;
}

// Search state
let searchTimeout;
let currentSearchQuery = '';
let currentSearchFilter = 'all';
let isSearching = false;

// Initialize search functionality
export function initializeSearch() {
    const searchInput = document.getElementById('playlistSearchInput');
    const searchResults = document.getElementById('searchResults');
    const clearBtn = document.getElementById('clearSearchBtn');
    const filterRadios = document.querySelectorAll('input[name="searchFilter"]');

    if (!searchInput) {
        console.warn('Search input not found, skipping search initialization');
        return;
    }

    // Wait for dependencies to be available
    if (!initializeImports()) {
        console.log('Waiting for favorites functions to be available...');
        setTimeout(initializeSearch, 500);
        return;
    }

    // Handle search input with debouncing
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        handleSearchInput(query);
    });

    // Handle filter changes
    filterRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                currentSearchFilter = e.target.value;
                if (currentSearchQuery) {
                    performSearch(currentSearchQuery, currentSearchFilter);
                }
            }
        });
    });

    // Handle clear search
    if (clearBtn) {
        clearBtn.addEventListener('click', clearSearch);
    }

    // Handle Enter key
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = e.target.value.trim();
            if (query) {
                performSearch(query, currentSearchFilter);
            }
        }
    });

    console.log('Search functionality initialized');
}

// Handle search input with debouncing
function handleSearchInput(query) {
    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    currentSearchQuery = query;

    // If query is empty, hide results
    if (!query) {
        hideSearchResults();
        return;
    }

    // Show loading state
    showSearchLoading();

    // Debounce search - wait 300ms after user stops typing
    searchTimeout = setTimeout(() => {
        performSearch(query, currentSearchFilter);
    }, 300);
}

// Perform the actual search
async function performSearch(query, filter = 'all') {
    if (isSearching) return;
    
    // Wait for functions to be available
    if (!initializeImports()) {
        setTimeout(() => performSearch(query, filter), 100);
        return;
    }
    
    try {
        isSearching = true;
        showSearchLoading();

        const filters = buildSearchFilters(filter);
        const results = await searchPlaylists(query, filters);

        await displaySearchResults(results, query);
        
    } catch (error) {
        console.error('Error performing search:', error);
        showSearchError('Có lỗi xảy ra khi tìm kiếm. Vui lòng thử lại.');
    } finally {
        isSearching = false;
    }
}

// Build search filters based on selected option
function buildSearchFilters(filterType) {
    const filters = { limit: 20 };

    switch (filterType) {
        case 'public':
            filters.isPublic = true;
            break;
        case 'mine':
            // Will be handled in searchPlaylists function
            filters.userOnly = true;
            break;
        case 'all':
        default:
            // No additional filters
            break;
    }

    return filters;
}

// Display search results
async function displaySearchResults(playlists, query) {
    const searchResults = document.getElementById('searchResults');
    const searchGrid = document.getElementById('searchPlaylistGrid');
    const countElement = document.getElementById('searchResultsCount');

    if (!searchResults || !searchGrid) {
        console.error('Search result elements not found');
        return;
    }

    // Update count
    const count = playlists.length;
    if (countElement) {
        countElement.textContent = `${count} kết quả cho "${query}"`;
    }

    // Show results container
    searchResults.style.display = 'block';

    if (count === 0) {
        searchGrid.innerHTML = `
            <div class="empty-message">
                <p>Không tìm thấy playlist nào phù hợp với "${query}"</p>
                <p>Hãy thử với từ khóa khác hoặc thay đổi bộ lọc</p>
            </div>
        `;
        return;
    }

    // Render playlist cards with favorite status
    try {
        const cardsHTML = await Promise.all(
            playlists.map(async (playlist) => {
                let isFavorited = false;
                if (isPlaylistFavorited) {
                    try {
                        isFavorited = await isPlaylistFavorited(playlist.id);
                    } catch (e) {
                        console.warn('Could not check favorite status:', e);
                    }
                }
                return createPlaylistCardHTML(playlist, isFavorited);
            })
        );

        searchGrid.innerHTML = cardsHTML.join('');
        
        // Add event listeners for favorite buttons and playlist clicks
        addSearchResultEventListeners();
        
    } catch (error) {
        console.error('Error rendering search results:', error);
        searchGrid.innerHTML = `
            <div class="error-message">
                <p>Có lỗi khi hiển thị kết quả tìm kiếm</p>
            </div>
        `;
    }
}

// Create playlist card HTML
function createPlaylistCardHTML(playlist, isFavorited = false) {
    const defaultCover = 'https://lezswjtnlsmznkgrzgmu.supabase.co/storage/v1/object/public/cover/449bd474-7a51-4c22-b4a4-2ad8736d6fad/default-cover.webp';
    const coverUrl = playlist.cover_url || defaultCover;
    const ownerUsername = playlist.owner_username || playlist.users?.username || 'Unknown';
    const color = playlist.color || '#1DB954';
    
    // Get track count
    let trackCount = 0;
    if (playlist.playlist_tracks && typeof playlist.playlist_tracks.count === 'number') {
        trackCount = playlist.playlist_tracks.count;
    } else if (playlist.track_count) {
        trackCount = playlist.track_count;
    }
    
    return `
        <div class="playlist-card spotify-style" 
             data-playlist-id="${playlist.id}">
            
            <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" 
                    data-playlist-id="${playlist.id}"
                    aria-label="${isFavorited ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}">
                <span class="favorite-icon"></span>
            </button>
            
            <div class="playlist-cover-img" 
                 style="background-image: url('${coverUrl}');"></div>
                 
            <div class="playlist-info">
                <h3>${escapeHtml(playlist.name)}</h3>
                <p>${trackCount} bài hát</p>
                <p class="playlist-owner">by ${escapeHtml(ownerUsername)}</p>
            </div>
        </div>
    `;
}

// Add event listeners for search results
function addSearchResultEventListeners() {
    // Playlist card clicks
    document.querySelectorAll('#searchPlaylistGrid .playlist-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking favorite button
            if (e.target.closest('.favorite-btn')) return;
            
            const playlistId = card.dataset.playlistId;
            if (playlistId && window.switchTab) {
                window.switchTab('detail-playlist', playlistId);
            }
        });
    });

    // Favorite button clicks
    document.querySelectorAll('#searchPlaylistGrid .favorite-btn').forEach(btn => {
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
                const newFavoriteStatus = await window.togglePlaylistFavorite(playlistId);
                
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

// Clear search
function clearSearch() {
    const searchInput = document.getElementById('playlistSearchInput');
    const searchResults = document.getElementById('searchResults');
    
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    
    hideSearchResults();
    currentSearchQuery = '';
    
    if (searchTimeout) {
        clearTimeout(searchTimeout);
        searchTimeout = null;
    }
}

// Show search loading state
function showSearchLoading() {
    const searchGrid = document.getElementById('searchPlaylistGrid');
    const searchResults = document.getElementById('searchResults');
    
    if (searchResults) {
        searchResults.style.display = 'block';
    }
    
    if (searchGrid) {
        searchGrid.innerHTML = `
            <div class="search-loading">
                <span>Đang tìm kiếm...</span>
            </div>
        `;
    }
}

// Show search error
function showSearchError(message) {
    const searchGrid = document.getElementById('searchPlaylistGrid');
    
    if (searchGrid) {
        searchGrid.innerHTML = `
            <div class="error-message">
                <p>${escapeHtml(message)}</p>
                <button onclick="window.location.reload()" class="btn-retry">Thử lại</button>
            </div>
        `;
    }
}

// Hide search results
function hideSearchResults() {
    const searchResults = document.getElementById('searchResults');
    if (searchResults) {
        searchResults.style.display = 'none';
    }
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
window.initializeSearch = initializeSearch;
window.performSearch = performSearch;
window.clearSearch = clearSearch;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSearch);
} else {
    initializeSearch();
}