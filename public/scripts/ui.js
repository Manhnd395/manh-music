// ui.js (Phiên bản Nâng cấp - Chỉ xử lý giao diện)

// Global debouncing utility
window.uiHelpers = {
    clickTimeouts: new Map(),
    
    // Prevent double clicks with debouncing
    preventDoubleClick(key, delay = 1000) {
        if (this.clickTimeouts.has(key)) {
            return true; // Already executing
        }
        
        this.clickTimeouts.set(key, true);
        setTimeout(() => {
            this.clickTimeouts.delete(key);
        }, delay);
        
        return false; // Safe to execute
    }
};

window.buildUrl = function(relativePath) {
    const getBaseUrl = () => {
        const script = document.querySelector('script[src*="ui.js"]');
        if (script) {
            const scriptSrc = script.src;
            const baseWithOrigin = scriptSrc.substring(0, scriptSrc.lastIndexOf('/scripts/'));
            // If script src already has origin, extract just the path
            if (baseWithOrigin.includes('://')) {
                return baseWithOrigin.replace(window.location.origin, '');
            }
            return baseWithOrigin;
        }
        return window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    };
    const base = getBaseUrl();
    return `${window.location.origin}${base}/${relativePath.replace(/^\/+/, '')}`;
};

window.loadComponent = async function(relativePath, targetId) {
    const target = document.getElementById(targetId);
    if (!target) {
        console.error(`Target #${targetId} not found`);
        return false;
    }

    const getBaseUrl = () => {
        const script = document.querySelector('script[src*="ui.js"]');
        if (script) {
            const scriptSrc = script.src;
            const baseWithOrigin = scriptSrc.substring(0, scriptSrc.lastIndexOf('/scripts/'));
            // If script src already has origin, extract just the path
            if (baseWithOrigin.includes('://')) {
                return baseWithOrigin.replace(window.location.origin, '');
            }
            return baseWithOrigin;
        }
        return window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    };

    const baseUrl = getBaseUrl();
    const cleanPath = relativePath.replace(/^\/+/, '');
    const url = `${window.location.origin}${baseUrl}/${cleanPath}`;

    try {
        console.log(`Loading: ${url} → #${targetId}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        target.innerHTML = html;
        console.log(`Loaded: ${relativePath}`);
        return true;
    } catch (error) {
        console.error(`Failed to load ${relativePath}:`, error);
        target.innerHTML = `<p class="error-message">Lỗi tải ${targetId}</p>`;
        return false;
    }
};

export async function loadHomeContent() {
    try {
        const container = document.getElementById('mainContentArea');
        const homeSection = document.getElementById('home-section');
        const publicSection = document.getElementById('public-playlists-section');
        
        // Ẩn tất cả section, hiện home section
        document.querySelectorAll('.main-section').forEach(section => {
            section.style.display = 'none';
        });
        homeSection.style.display = 'block';
        // Hiển thị luôn khu public playlists nếu tồn tại trên home
        if (publicSection) publicSection.style.display = 'block';
        
        await window.appFunctions.loadUserPlaylists();
        // Tải danh sách playlist công khai nếu có grid
        if (typeof window.renderPublicPlaylists === 'function') {
            try { await window.renderPublicPlaylists(12); } catch (e) { console.warn('renderPublicPlaylists fail:', e); }
        }
        
        // Load lịch sử bài hát
        await loadRecentHistory(); // Hàm này đã thêm trong app.js
        
    } catch (error) {
        console.error('Lỗi load trang chủ:', error);
    }
}

// Use direct Supabase URL for default cover
const defaultCover = 'https://lezswjtnlsmznkgrzgmu.supabase.co/storage/v1/object/public/cover/449bd474-7a51-4c22-b4a4-2ad8736d6fad/default-cover.webp';
window.updatePlayerBar = function(track) {
    const cover = document.getElementById('trackCover');
    const title = document.getElementById('trackTitle');
    const artist = document.getElementById('trackArtist');


    if (cover) {
        if (track.cover_url && track.cover_url.trim() !== '') {
            cover.src = track.cover_url;
            cover.alt = track.title || 'Track cover';
            cover.style.display = 'block';
        } else {
            cover.src = defaultCover;
            cover.alt = 'No cover';
            cover.style.display = 'block';
        }
    }

    if (title) title.textContent = track.title || 'Unknown Title';
    if (artist) artist.textContent = track.artist || 'Unknown Artist';

    const rightPanel = document.getElementById('sidebar-right');
    if (!rightPanel) {
        console.warn('sidebar-right not found - check HTML');
        return;
    }

    if (track) {
        rightPanel.classList.add('active');
        // Force trigger layout recalculation
        document.body.classList.add('sidebar-right-active');
    } else {
        rightPanel.classList.remove('active');
        document.body.classList.remove('sidebar-right-active');
    }

    if (!track) {
        rightPanel.innerHTML = `
            <div class="right-panel-content">
                <div class="right-panel-placeholder">
                    <div class="placeholder-cover">🎵</div>
                    <p>Chọn bài hát để xem chi tiết</p>
                    <small>Playlist: Danh sách phát cá nhân</small>
                </div>
            </div>
        `;
        return;
    }

    // Render nội dung chính
    rightPanel.innerHTML = `
        <div class="right-panel-content">
            ${window.currentPlaylistSource && window.currentPlaylist && window.currentPlaylist.length > 0 
                ? `<div class="current-playlist-header">${window.currentPlaylistSource}</div>` 
                : ''
            }
          <img src="${track.cover_url || defaultCover}" 
              alt="${track.title} cover" 
              class="track-cover-large" 
              onerror="if(!this._tried){this._tried=true;this.src='${defaultCover}';}">
            <div class="track-title-large">${track.title || 'Unknown Title'}</div>
            <div class="track-artist-large">${track.artist || 'Unknown Artist'}</div>
            
            <div id="nextTrackContainer" class="next-track-preview"></div>
            <div id="lyricsContainer" class="lyrics-container lyrics-loading">Đang tải lời bài hát...</div>
        </div>
    `;

    // Thêm khối chat AI bên dưới lyrics
    const chatSection = `
        <div id="aiChatSection" class="ai-chat-section">
            <h4>Hỏi thêm về bài hát!</h4>
            <div id="chatMessages" class="chat-messages"></div>
            <div class="chat-input-container">
                <input type="text" id="chatInput" placeholder="Hỏi về ${track.title} (e.g., Ý nghĩa lời bài hát?)" />
                <button id="sendChatBtn" onclick="sendAIQuery('${track.id}', '${track.title}', '${track.artist}')">
                    <i class="fas fa-paper-plane"></i> Gửi
                </button>
            </div>
        </div>
    `;
    rightPanel.insertAdjacentHTML('beforeend', chatSection);

    // Gắn sự kiện Enter cho ô nhập
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendAIQuery(track.id, track.title, track.artist);
        });
    }

    // Gọi các hàm phụ trợ
    getNextTrackPreview().then(nextTrack => {
        const nextHtml = nextTrack ? `
            <div class="next-track-preview">
                <h4>Bài hát tiếp theo</h4>
                <div class="next-track-info">${nextTrack.title} - ${nextTrack.artist}</div>
            </div>
        ` : '<div class="next-track-preview"><p>Không có bài tiếp theo</p></div>';
        document.getElementById('nextTrackContainer').innerHTML = nextHtml;
    });

    getSongInfo(track);
    fetchLyrics(track);
};

window.sendAIQuery = async function(trackId, title, artist) {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendChatBtn');
    const messages = document.getElementById('chatMessages');
    
    if (!input || !input.value.trim()) return;
    
    const userMessage = input.value.trim();
    input.value = '';
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang hỏi...';
    
    // Add user message
    const userDiv = document.createElement('div');
    userDiv.className = 'chat-message user';
    userDiv.textContent = userMessage;
    messages.appendChild(userDiv);
    messages.scrollTop = messages.scrollHeight;
    
    try {
        const apiKey = window.GROQ_API_KEY;
        
        // Enhanced API key validation
        const isValidKey = apiKey && 
                          apiKey !== 'your-groq-key-here' && 
                          apiKey !== '__VITE_GROQ_API_KEY__' && 
                          apiKey !== 'undefined' &&
                          apiKey.length > 10;
        
        if (!isValidKey) {
            console.warn('GROQ API key invalid or missing:', {
                exists: !!apiKey,
                isPlaceholder: apiKey === '__VITE_GROQ_API_KEY__',
                length: apiKey?.length || 0
            });
            throw new Error('GROQ_API_KEY not configured properly');
        }
        
        // Prompt tối ưu
        const prompt = `Bạn là chuyên gia âm nhạc. Trả lời ngắn gọn về bài hát "${title}" của ${artist}. Câu hỏi: ${userMessage}. Trả lời bằng tiếng Việt, dưới 200 từ.`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey.trim()}`
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant', // Updated to active model
                messages: [
                    { role: 'system', content: 'Bạn là trợ lý âm nhạc thân thiện, trả lời bằng tiếng Việt.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 300,
                temperature: 0.7
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('GROQ API Error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        
        if (!data?.choices?.[0]?.message?.content) {
            console.error('Invalid GROQ response:', data);
            throw new Error('Empty or invalid response from AI');
        }
        
        let text = data.choices[0].message.content.trim();
        if (!text) {
            throw new Error('AI returned empty response');
        }
        
        // Add AI response
        const aiDiv = document.createElement('div');
        aiDiv.className = 'chat-message ai';
        aiDiv.innerHTML = text.replace(/\n/g, '<br>');
        messages.appendChild(aiDiv);
        messages.scrollTop = messages.scrollHeight;
        
        console.log('✅ GROQ AI response success');
        
    } catch (error) {
        console.error('GROQ AI error:', error);
        
        // Enhanced fallback responses
        const errorDiv = document.createElement('div');
        errorDiv.className = 'chat-message ai';
        errorDiv.style.color = 'var(--warning-color)';
        
        let fallbackMessage = '';
        if (error.name === 'AbortError') {
            fallbackMessage = `⏱️ Yêu cầu timeout. "${title}" của ${artist} có vẻ thú vị! Hãy thử lại sau.`;
        } else if (error.message.includes('GROQ_API_KEY') || error.message.includes('not configured')) {
            fallbackMessage = `🤖 AI chat chưa sẵn sàng. Tuy nhiên, "${title}" của ${artist} là một bài hát hay! Bạn có thể tìm hiểu thêm về nghệ sĩ này.`;
        } else if (error.message.includes('401') || error.message.includes('403')) {
            fallbackMessage = `🔑 Dịch vụ AI tạm thời không khả dụng. "${title}" nghe có vẻ tuyệt! Bạn thích phong cách âm nhạc nào của ${artist}?`;
        } else if (error.message.includes('429')) {
            fallbackMessage = `🚦 Quá nhiều yêu cầu. Hãy đợi một chút rồi thử lại. "${title}" của ${artist} chắc chắn đáng nghe!`;
        } else {
            fallbackMessage = `⚡ AI đang bận. Nhưng "${title}" của ${artist} rất hay! Hãy thử lại sau hoặc khám phá thêm bài hát khác.`;
        }
        
        errorDiv.innerHTML = fallbackMessage;
        messages.appendChild(errorDiv);
        messages.scrollTop = messages.scrollHeight;
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi';
    }
};

async function getSongInfo(track) {
    const container = document.getElementById('songInfoContainer');
    if (!container) return;

    // container.innerHTML = '<p>Đang tải thông tin bài hát...</p>';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const query = encodeURIComponent(`${track.artist} ${track.title}`);
        const response = await fetch(`https://musicbrainz.org/ws/2/recording/?query="${query}"&fmt=json&limit=1`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error('API fail');
        const data = await response.json();
        if (data.count > 0 && data.recordings[0]) {
            const recording = data.recordings[0];
            const info = `
                <strong>Thể loại:</strong> ${recording['genres']?.map(g => g.name).join(', ') || 'Unknown'}<br>
                <strong>Ngày phát hành:</strong> ${recording['first-release-date'] || 'Unknown'}<br>
                <strong>Mô tả:</strong> ${recording.artist-credit[0]?.name || 'N/A'} - Một ca khúc nổi bật từ album ${recording.releases?.[0]?.title || 'N/A'}.
            `;
            container.innerHTML = info;
            return;
        }
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.warn('Song info timeout - fallback to mock');
        } else {
            console.warn('Song info fetch fail (fallback to mock):', error.message);
        }
    }

}

function generateMockLyrics(title, artist) {
    const lines = [
        `[Verse 1]\nIn the rhythm of ${title}, we find our way,`,
        `\n${artist}'s melody, lighting up the day.`,
        `\n[Chorus]\nOh, ${title}, take me higher,`,
        `With your sound, set my soul on fire.`,
        `\n[Verse 2]\nWhispers of the night, in every note we hear,`,
        `${title} forever, drawing us near.`
    ];
    return lines.join('\n') + `\n\n*(Mock lyrics - Use real API for full verses)*`;
}

async function fetchLyrics(track) {
    const container = document.getElementById('lyricsContainer');
    if (!container) return;

    const cacheKey = `lyrics_${track.artist}_${track.title}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        container.textContent = cached;
        container.classList.remove('lyrics-loading');
        return;
    }

    container.textContent = 'Đang tải lời bài hát...';
    container.classList.add('lyrics-loading');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);  // Tăng timeout lên 15s cho ovh

    try {
        // Primary: Lyrics.ovh
        const artist = encodeURIComponent(track.artist || 'Unknown');
        const title = encodeURIComponent(track.title || 'Unknown');
        const response = await fetch(`https://api.lyrics.ovh/v1/${artist}/${title}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error('No lyrics from ovh');
        const data = await response.json();
        let lyrics = data.lyrics || null;
        
        if (lyrics && lyrics.trim() !== '') {
            lyrics = lyrics.replace(/\n\s*\n/g, '\n\n').trim();
            container.textContent = lyrics;
            localStorage.setItem(cacheKey, lyrics);
            container.classList.remove('lyrics-loading');
            console.log('✅ ovh lyrics for:', track.title);
            return;
        } else {
            throw new Error('ovh empty - fallback Genius');
        }
        
    } catch (error) {
        clearTimeout(timeoutId);
        console.warn('Lyrics.ovh failed:', error.message);
        
        // Fallback: Genius API với multiple proxy options
        try {
            console.log('Trying Genius API fallback...');
            const searchQuery = encodeURIComponent(`${track.title} ${track.artist}`);
            
            // Try multiple proxy services
            const proxies = [
                `https://corsproxy.io/?${encodeURIComponent(`https://api.genius.com/search?q=${searchQuery}`)}`,
                `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://api.genius.com/search?q=${searchQuery}`)}`
            ];
            
            let geniusData = null;
            let lastError = null;
            
            for (const proxyUrl of proxies) {
                try {
                    console.log('Trying proxy:', proxyUrl.split('?')[0]);
                    
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 8000);
                    
                    const geniusResponse = await fetch(proxyUrl, {
                        headers: {
                            'Authorization': 'Bearer IxVXGHsLgddA9h0Po19AjKMezA4xvvKJ5uQ0CiDfpK9oFPrBXE3dr43iaeCbRlFG'
                        },
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (!geniusResponse.ok) {
                        throw new Error(`HTTP ${geniusResponse.status}`);
                    }
                    
                    const responseData = await geniusResponse.json();
                    
                    // Direct response (no wrapper)
                    geniusData = responseData;
                    
                    if (geniusData?.response?.hits?.length > 0) {
                        console.log('✅ Genius API success with proxy');
                        break;
                    }
                    
                } catch (err) {
                    lastError = err;
                    console.warn('Proxy failed:', err.message);
                    continue;
                }
            }
            
            if (!geniusData?.response?.hits?.length) {
                throw new Error(`No lyrics found after trying all proxies. Last error: ${lastError?.message}`);
            }
            
            const hit = geniusData.response.hits[0];
            const lyricsUrl = hit.result.url;
            
            // Simple lyrics extraction without fetching full HTML
            const lyricsPreview = hit.result.full_title || `${hit.result.title} - ${hit.result.primary_artist.name}`;
            container.innerHTML = `
                <div class="lyrics-header">
                    <h4>🎵 ${hit.result.full_title}</h4>
                    <p>Nghệ sĩ: ${hit.result.primary_artist.name}</p>
                    <a href="${lyricsUrl}" target="_blank" class="genius-link">
                        <i class="fas fa-external-link-alt"></i> Xem lyrics đầy đủ trên Genius
                    </a>
                </div>
                <p class="lyrics-note">💡 Click link trên để xem lời bài hát chi tiết</p>
            `;
            
            localStorage.setItem(cacheKey, container.innerHTML);
            container.classList.remove('lyrics-loading');
            console.log('✅ Genius info displayed for:', track.title);
            return;
            
        } catch (geniusError) {
            console.warn('All Genius methods failed:', geniusError.message);
        }
        
        // Final fallback - simple error message
        const noLyricsMsg = `Chưa có lời cho bài hát "${track.title}" của ${track.artist}.`;
        container.textContent = noLyricsMsg;
        localStorage.setItem(cacheKey, noLyricsMsg);
        container.classList.remove('lyrics-loading');
        console.log('❌ No lyrics found for:', track.title);
    }
}

async function getNextTrackPreview() {
    if (!window.currentPlaylist || window.currentPlaylist.length === 0) {
        return { title: 'Bài hát ngẫu nhiên', artist: 'Từ cơ sở dữ liệu' };
    }
    
    let nextIndex = (window.currentTrackIndex + 1) % window.currentPlaylist.length;
    if (window.isShuffling) {
        let shuffleIdx = window.shuffleOrder.indexOf(window.currentTrackIndex);
        shuffleIdx = (shuffleIdx + 1) % window.currentPlaylist.length;
        nextIndex = window.shuffleOrder[shuffleIdx];
    }
    
    // If we're at the end of playlist and not in repeat all mode
    if (window.repeatMode !== 'all' && nextIndex === 0 && window.currentTrackIndex !== 0) {
        return { title: 'Bài hát ngẫu nhiên', artist: 'Từ cơ sở dữ liệu' };
    }
    
    return window.currentPlaylist[nextIndex] || null;
}

// FIXED home loader: chờ session & init event thay vì tự fetch lại nhiều lần
const tryLoadHome = async () => {
    console.log('🔧 ui.js retry check:', {
        hasUser: !!window.currentUser,
        appInitialized: !!window.appInitialized,
        loadHomePageFn: typeof window.loadHomePage === 'function'
    });

    // Nếu app đã init hoàn toàn → chỉ cần đảm bảo loadHomePage
    if (window.appInitialized && window.currentUser) {
        console.log('✅ ui.js: App initialized – invoking loadHomePage(skipFetch=true)');
        await window.loadHomePage(true);
        return;
    }

    // Nếu đã có user nhưng app chưa init thì đợi initializeApp kết thúc
    if (window.currentUser && !window.appInitialized) {
        console.log('⏳ ui.js: User present nhưng app chưa init – chờ APP_READY event');
        return; // APP_READY listener sẽ lo
    }

    // Chưa có user → đợi session restore events
    if (!window.currentUser) {
        if ((window.homeRetryCount || 0) < 20) { // ~10s tổng
            window.homeRetryCount = (window.homeRetryCount || 0) + 1;
            setTimeout(tryLoadHome, 500);
        } else {
            console.error('❌ ui.js: Timeout chờ user – kiểm tra token trong localStorage');
        }
    }
};

// Khi app init xong phát sự kiện, đảm bảo không double fetch
window.addEventListener('APP_READY', (e) => {
    console.log('🎉 APP_READY event received in ui.js for user:', e.detail?.user?.email);
    // Không tham chiếu biến cục bộ trong app.js để tránh ReferenceError
    if (typeof window.loadHomePage === 'function') {
        window.loadHomePage(true);
    }
});


document.addEventListener('DOMContentLoaded', () => {
    const getBaseUrl = () => {
        const script = document.querySelector('script[src*="ui.js"]');
        if (script) {
            const scriptSrc = script.src;
            return scriptSrc.substring(0, scriptSrc.lastIndexOf('/scripts/'));
        }
        return window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    };

    const baseUrl = getBaseUrl();
    const path = (p) => p.replace(/^\/+/, '');

    window.loadComponent(path('components/sidebar.html'), 'sidebar');
    window.loadComponent(path('components/player-bar.html'), 'playerBar').then(() => {
        // Ensure player controls are initialized after player bar is loaded
        if (window.initializePlayerControls) {
            window.initializePlayerControls();
        }
    });
    window.loadComponent(path('home-content.html'), 'mainContentArea')
        .then(success => {
            if (success) {
                console.log('home-content.html loaded → starting tryLoadHome (optimized)');
                setTimeout(tryLoadHome, 80);
            } else {
                console.error('home-content.html failed → retrying tryLoadHome in 1s');
                setTimeout(tryLoadHome, 1000);
            }
        });
});

window.fetchLyrics = fetchLyrics; 
window.getNextTrackPreview = getNextTrackPreview;
window.getSongInfo = getSongInfo;   