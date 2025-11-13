// public/scripts/favorites-init.js
// Initialize all favorites functionality

// Initialize all favorites features when app is ready
function initializeFavoritesFeatures() {
    console.log('Initializing favorites features...');
    
    // Initialize search functionality with delay
    setTimeout(() => {
        if (window.initializeSearch) {
            try {
                window.initializeSearch();
            } catch (error) {
                console.warn('Error initializing search:', error);
            }
        }
    }, 1000);
    
    // Update existing playlist cards with favorite buttons
    setTimeout(() => {
        if (window.updatePlaylistCardsWithFavorites) {
            try {
                window.updatePlaylistCardsWithFavorites('.playlist-grid');
            } catch (error) {
                console.warn('Error updating playlist cards:', error);
            }
        }
    }, 2000);
    
    console.log('Favorites features initialization started');
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
    z-index: 10;
}

/* Ensure spotify-style cards work with favorite buttons */
.playlist-card.spotify-style {
    position: relative;
}

.playlist-card.spotify-style .favorite-btn {
    top: 12px;
    right: 12px;
}

/* Responsive favorite buttons */
@media (max-width: 768px) {
    .playlist-card .favorite-btn {
        opacity: 1;
        top: 8px;
        right: 8px;
        width: 35px;
        height: 35px;
    }
    
    .playlist-card.spotify-style .favorite-btn {
        top: 10px;
        right: 10px;
    }
}
`;

// Inject additional CSS
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalCSS;
document.head.appendChild(styleSheet);