// public/scripts/favorites-init.js
// Initialize all favorites functionality

// Initialize all favorites features when app is ready
function initializeFavoritesFeatures() {
    console.log('Initializing favorites features...');
    
    // Initialize search functionality
    if (window.initializeSearch) {
        window.initializeSearch();
    }
    
    // Update existing playlist cards with favorite buttons
    if (window.updatePlaylistCardsWithFavorites) {
        setTimeout(() => {
            window.updatePlaylistCardsWithFavorites('.playlist-grid');
        }, 1000);
    }
    
    console.log('Favorites features initialized');
}

// Enhanced switchTab to load favorites page
function enhanceSwitchTab() {
    const originalSwitchTab = window.switchTab;
    
    if (originalSwitchTab) {
        window.switchTab = function(tabName, param) {
            const result = originalSwitchTab.call(this, tabName, param);
            
            // Load favorites when switching to favorites tab
            if (tabName === 'favorites' && window.loadFavoritesPage) {
                setTimeout(() => {
                    window.loadFavoritesPage();
                }, 100);
            }
            
            return result;
        };
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    enhanceSwitchTab();
    
    // Listen for app ready events
    window.addEventListener('APP_READY', initializeFavoritesFeatures);
    
    // Also initialize after a delay in case APP_READY already fired
    setTimeout(initializeFavoritesFeatures, 2000);
});

// Additional CSS for playlist cards positioning
const additionalCSS = `
.playlist-card {
    position: relative;
}

.playlist-card .favorite-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
}

/* Ensure favorite buttons are visible on existing cards */
.playlist-card:not(.spotify-style) .favorite-btn {
    background: rgba(0, 0, 0, 0.7);
}

.playlist-card:not(.spotify-style):hover .favorite-btn {
    background: rgba(0, 0, 0, 0.9);
}

/* Responsive favorite buttons */
@media (max-width: 768px) {
    .playlist-card .favorite-btn {
        opacity: 1;
        top: 5px;
        right: 5px;
        width: 35px;
        height: 35px;
    }
}
`;

// Inject additional CSS
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalCSS;
document.head.appendChild(styleSheet);