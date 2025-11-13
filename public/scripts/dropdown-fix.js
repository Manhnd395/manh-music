// dropdown-fix.js - Fix missing playlist-add-container issue

// Function to ensure all track items have proper dropdown containers
function ensureDropdownContainers() {
    console.log('🔧 Ensuring dropdown containers...');
    
    // Find all track items with missing containers
    const trackItems = document.querySelectorAll('.track-item');
    let fixedCount = 0;
    
    trackItems.forEach(item => {
        const actionsDiv = item.querySelector('.track-actions');
        if (!actionsDiv) return;
        
        const hasContainer = actionsDiv.querySelector('.playlist-add-container');
        if (hasContainer) return; // Already has container
        
        const button = actionsDiv.querySelector('.btn-action[onclick*="togglePlaylistDropdown"]');
        if (!button) return; // No add button
        
        // Extract track ID from onclick
        const onclickAttr = button.getAttribute('onclick');
        const trackIdMatch = onclickAttr.match(/togglePlaylistDropdown\(this,\s*'([^']+)'\)/);
        if (!trackIdMatch) return;
        
        const trackId = trackIdMatch[1];
        
        // Create proper container structure
        const container = document.createElement('div');
        container.className = 'playlist-add-container';
        
        const dropdown = document.createElement('div');
        dropdown.className = 'playlist-dropdown';
        
        // Replace button content
        actionsDiv.innerHTML = '';
        
        const newButton = document.createElement('button');
        newButton.className = 'btn-action';
        newButton.innerHTML = '<i class="fas fa-plus"></i>';
        newButton.setAttribute('onclick', `event.stopPropagation(); window.appFunctions.togglePlaylistDropdown(this, '${trackId}')`);
        
        container.appendChild(newButton);
        container.appendChild(dropdown);
        actionsDiv.appendChild(container);
        
        fixedCount++;
        console.log(`✅ Fixed dropdown container for track: ${trackId}`);
    });
    
    if (fixedCount > 0) {
        console.log(`🔧 Fixed ${fixedCount} dropdown containers`);
    }
}

// Auto-fix on DOM changes
function setupDropdownObserver() {
    const observer = new MutationObserver((mutations) => {
        let shouldFix = false;
        
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check if any added nodes contain track-items
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        if (node.classList?.contains('track-item') || 
                            node.querySelector?.('.track-item')) {
                            shouldFix = true;
                        }
                    }
                });
            }
        });
        
        if (shouldFix) {
            setTimeout(ensureDropdownContainers, 100); // Small delay to ensure DOM is ready
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('🔧 Dropdown container observer setup complete');
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        ensureDropdownContainers();
        setupDropdownObserver();
    });
} else {
    ensureDropdownContainers();
    setupDropdownObserver();
}

// Export for manual use
window.dropdownFix = {
    ensureContainers: ensureDropdownContainers,
    setupObserver: setupDropdownObserver
};