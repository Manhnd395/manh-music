import { supabase } from '../supabase/client.js';

let editingPlaylistId = null;
window.isSwitchingTab = false;
window.isLoadingPlaylistDetail = false;

window.loadDetailPlaylist = async function(playlistId) {
    if (!playlistId) {
        console.error('Lỗi: Thiếu ID playlist');
        return;
    }
    // Log giá trị playlistId để debug lỗi 400
    console.log('PlaylistId truy vấn:', playlistId, typeof playlistId);

    // NGĂN GỌI NHIỀU LẦN
    if (window.isLoadingPlaylistDetail) {
        console.log('Đang tải playlist, bỏ qua request trùng');
        return;
    }
    window.isLoadingPlaylistDetail = true;

    window.currentPlaylistId = playlistId;

    const header = document.getElementById('playlistHeader');
    const container = document.getElementById('trackList');

    if (header) header.innerHTML = '<p>Đang tải playlist...</p>';
    if (container) container.innerHTML = '<p>Đang tải bài hát...</p>';

    try {
        // 1. Lấy thông tin playlist
        const { data: playlist, error } = await supabase
            .from('playlists')
            .select('id, name, description, color, cover_url, created_at, user_id, is_public')
            .eq('id', playlistId)
            .single();

        if (error) throw error;
        if (!playlist) throw new Error('Playlist không tồn tại');

        window.currentEditingPlaylist = playlist;

        // 2. Render header
        if (header) {
            header.innerHTML = `
                <div class="playlist-info">
                    <h1>${escapeHtml(playlist.name)}</h1>
                    <p>${escapeHtml(playlist.description || 'Không có mô tả')}</p>
                </div>
                <div class="playlist-actions">
                    <button class="play-all-btn" data-id="${playlistId}">Phát Tất Cả</button>
                    <button class="edit-playlist-btn" onclick="window.openPlaylistEditModal('${playlistId}')">
                        Chỉnh sửa
                    </button>
                    <button class="delete-playlist-btn" onclick="window.deletePlaylist('${playlistId}')" style="background:#ff4d4d;color:white;padding:8px 16px;border:none;border-radius:4px;margin-left:10px;">
                        Xóa
                    </button>
                </div>
                <!-- Modal trigger only; form moved to overlay -->
            `;

            // Gắn Play All
            const playBtn = header.querySelector('.play-all-btn');
            if (playBtn) {
                playBtn.addEventListener('click', () => handlePlayAll(playlistId, playlist));
            }
        }

        // 3. Tải tracks
        const tracks = await window.loadPlaylistTracks(playlistId, false);

        // 4. Render tracks
        if (container) {
            if (tracks.length === 0) {
                container.innerHTML = '<p class="empty-message">Playlist trống</p>';
            } else {
                renderTracks(tracks, container);
            }
        }

        // 5. Badge số bài
        const badge = document.createElement('span');
        badge.textContent = `${tracks.length} bài hát`;
        badge.style.cssText = 'color:var(--text-secondary);font-size:0.9em;margin-left:10px;';
        header.querySelector('.playlist-info')?.appendChild(badge);

    } catch (error) {
        console.error('Lỗi load playlist:', error);
        if (container) container.innerHTML = `<p class="error">Lỗi: ${error.message}</p>`;
        if (header) header.innerHTML = '<h2>Lỗi tải</h2>';
    } finally {
        window.isLoadingPlaylistDetail = false;
    }
};

async function uploadPlaylistCover(userId, playlistId, coverFile) {
    const BUCKET_NAME = 'cover';
   
    const fileExt = coverFile.name.split('.').pop();
    const filePath = `playlists/${playlistId}/cover.${fileExt}`;
    try {
        console.log('Starting playlist cover upload to path:', filePath);
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, coverFile, {
                cacheControl: '3600',
                upsert: true,
            });
        if (uploadError) {
            console.error('Upload error:', uploadError);
            return null;
        }
        const { data: publicUrlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);
        console.log('Public URL:', publicUrlData.publicUrl);
        return publicUrlData.publicUrl;
    } catch (error) {
        console.error('System error during upload:', error);
        return null;
    }
}
window.uploadPlaylistCover = uploadPlaylistCover;

function handlePlayAll(playlistId, playlistData) {
    // Reload tracks nếu cần (cache có thể cũ)
    window.loadPlaylistTracks(playlistId, false).then(tracks => {
        if (tracks.length > 0) {
            window.currentPlaylist = tracks;  // Global scope fix
            window.currentTrackIndex = 0;
            window.playTrack(tracks[0], tracks, 0);  // Play đầu
            console.log(`Playing all from playlist: ${playlistData.name}`);
        }
    });
}

// Hàm toggle edit form
// Legacy inline editor removed; replaced by modal overlay
window.toggleEditPlaylist = function() {
        console.warn('toggleEditPlaylist legacy call ignored (modal in use)');
};

// Create / open modal
window.openPlaylistEditModal = async function(playlistId) {
    // Remove legacy inline panel if present and prevent duplicates
    document.getElementById('playlistEditPanel')?.remove();
    const existing = document.getElementById('playlistEditModal');
    if (existing) {
        existing.querySelector('#plName')?.focus();
        return; // singleton
    }
    // Helper to validate UUID (avoid 400 when using temp id like 'NEW')
    const isValidUUID = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    let playlist;
    let creationMode = false;
    if (playlistId === 'NEW' || !isValidUUID(playlistId)) {
        // Creation mode: no fetch, use defaults
        creationMode = true;
        playlist = { id: 'NEW', name: '', description: '', color: '#1db954', cover_url: null, is_public: false };
        console.log('[Playlist Modal] Creation mode initiated, skipping fetch.');
    } else {
        const { data: fetched, error } = await supabase
            .from('playlists')
            .select('id, name, description, color, cover_url, is_public')
            .eq('id', playlistId)
            .single();
        if (error || !fetched) {
            alert('Không tải được playlist để chỉnh sửa');
            return;
        }
        playlist = fetched;
    }
    window.currentEditingPlaylist = playlist;

    // Ensure stylesheet is loaded once (respect Vite base path /manh-music/ in production)
    if (!document.getElementById('playlistModalStylesheet')) {
        const link = document.createElement('link');
        link.id = 'playlistModalStylesheet';
        link.rel = 'stylesheet';
        // Use relative path so GitHub Pages base works; fallback injection if load fails
        link.href = 'styles/playlist-modal.css';
        link.onload = () => console.log('[Playlist Modal] stylesheet loaded');
        link.onerror = () => {
            console.warn('[Playlist Modal] stylesheet failed – injecting minimal inline styles');
            const style = document.createElement('style');
            style.textContent = `#playlistEditModal{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;font-family:system-ui}#playlistEditModal .pl-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(2px)}#playlistEditModal .pl-modal{position:relative;width:640px;max-width:92%;background:#1b1b1b;border-radius:16px;padding:32px 36px 38px;box-shadow:0 20px 60px -18px rgba(0,0,0,.8);color:#fff;font-size:15px}#playlistEditModal .pl-modal h2{margin:0 0 24px;font-size:24px;font-weight:600}#playlistEditModal .pl-grid{display:grid;grid-template-columns:220px 1fr;gap:28px}#playlistEditModal .pl-cover-wrapper{width:220px;height:220px;background:#222;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden}#playlistEditModal .pl-cover-wrapper img{width:100%;height:100%;object-fit:cover}#playlistEditModal .pl-form{display:flex;flex-direction:column}#playlistEditModal .pl-row{margin-bottom:18px;display:flex;flex-direction:column}#playlistEditModal .pl-row label{font-size:12px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:#aaa;margin-bottom:6px}#playlistEditModal input[type=text],#playlistEditModal textarea{background:#151515;border:1px solid #333;color:#fff;padding:12px 14px;border-radius:10px;font-size:15px}#playlistEditModal input[type=text]:focus,#playlistEditModal textarea:focus{outline:2px solid #1db954}#playlistEditModal .pl-actions{display:flex;justify-content:flex-end;gap:16px;margin-top:6px}#playlistEditModal .pl-btn{border:none;padding:12px 24px;border-radius:28px;font-weight:600;cursor:pointer}#playlistEditModal .pl-btn-primary{background:#1db954;color:#fff}#playlistEditModal .pl-btn-secondary{background:#2b2b2b;color:#e0e0e0}`;
            document.head.appendChild(style);
        };
        document.head.appendChild(link);
    }

    // Create overlay modal like Spotify
    const root = document.createElement('div');
    root.id = 'playlistEditModal';
    root.className = 'pl-modal-root';
    // Markup with heading like Spotify
    root.innerHTML = `
        <div class="pl-backdrop" tabindex="-1" aria-hidden="true"></div>
        <div class="pl-modal" role="dialog" aria-modal="true" aria-label="Chỉnh sửa playlist">
            <button class="pl-close" aria-label="Đóng">✕</button>
            <h2 class="pl-title">${creationMode ? 'Create playlist' : 'Edit details'}</h2>
            <div class="pl-grid">
                <div class="pl-cover-wrapper" id="plCoverWrapper" aria-label="Ảnh bìa hiện tại (nhấn để chọn ảnh mới)">
                    ${playlist.cover_url ? `<img id="plCoverPreview" src="${getPublicPlaylistCoverUrl(playlist.cover_url)}" alt="Playlist cover" onerror="this.src='${defaultCover}'"/>` : `<img id="plCoverPreview" src="${defaultCover}" alt="Default playlist cover" />`}
                    <input type="file" id="plCoverFile" accept="image/*" class="pl-file-hidden" aria-label="Chọn ảnh bìa" />
                </div>
                <form id="playlistEditForm" class="pl-form" novalidate>
                    <div class="pl-row">
                        <label for="plName">Tên playlist</label>
                        <input id="plName" name="name" type="text" value="${escapeHtml(playlist.name)}" maxlength="80" required />
                        <div class="pl-counter" id="plNameCounter">${playlist.name.length}/80</div>
                    </div>
                    <div class="pl-row">
                        <label for="plDesc">Mô tả (tuỳ chọn)</label>
                        <textarea id="plDesc" name="description" rows="4" maxlength="300">${escapeHtml(playlist.description || '')}</textarea>
                        <div class="pl-counter" id="plDescCounter">${(playlist.description || '').length}/300</div>
                    </div>
                    <div class="pl-row pl-inline">
                        <div class="pl-sub">
                            <label for="plColor">Màu nền</label>
                            <input type="color" id="plColor" value="${playlist.color || '#1db954'}" />
                        </div>
                        <div class="pl-sub">
                            <label for="plPublic">Công khai</label>
                            <label class="pl-switch">
                                <input type="checkbox" id="plPublic" ${playlist.is_public ? 'checked' : ''} />
                                <span class="pl-slider"></span>
                            </label>
                        </div>
                    </div>
                    <div class="pl-actions">
                        <button type="button" class="pl-btn pl-btn-secondary" id="plCancelBtn">Hủy</button>
                        <button type="submit" class="pl-btn pl-btn-primary" id="plSaveBtn">Lưu</button>
                    </div>
                </form>
            </div>
        </div>`;

    document.body.appendChild(root);
    setTimeout(() => root.querySelector('#plName')?.focus(), 30);

    // Close helpers
    const closeModal = () => root.remove();
    root.querySelector('.pl-backdrop')?.addEventListener('click', closeModal);
    root.querySelector('.pl-close')?.addEventListener('click', closeModal);
    root.querySelector('#plCancelBtn')?.addEventListener('click', closeModal);
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closeModal(); } });
    // Dismiss with CTRL+X like some desktop mods (optional)
    root.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') { closeModal(); } });

    // Live counters
    const nameInput = root.querySelector('#plName');
    const descInput = root.querySelector('#plDesc');
    const nameCounter = root.querySelector('#plNameCounter');
    const descCounter = root.querySelector('#plDescCounter');
    nameInput.addEventListener('input', () => nameCounter.textContent = `${nameInput.value.length}/80`);
    descInput.addEventListener('input', () => descCounter.textContent = `${descInput.value.length}/300`);

    // Cover interactions
    const coverInput = root.querySelector('#plCoverFile');
    const coverWrapper = root.querySelector('#plCoverWrapper');
    const coverPreview = root.querySelector('#plCoverPreview');
    coverWrapper.addEventListener('click', () => coverInput?.click());
    coverInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            if (coverPreview && coverPreview.tagName === 'IMG') {
                coverPreview.src = url;
            } else if (coverPreview) {
                const img = document.createElement('img');
                img.id = 'plCoverPreview';
                img.src = url;
                img.alt = 'Playlist cover';
                coverPreview.replaceWith(img);
            }
        }
    });

    // Prevent global player shortcuts while typing inside the form
    root.addEventListener('keydown', (e) => {
        const t = e.target;
        const tag = t?.tagName?.toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) {
            e.stopPropagation();
        }
    });

    // Submit
    root.querySelector('#playlistEditForm').addEventListener('submit', (e) => {
        e.preventDefault();
        // In creation mode the patched savePlaylistModal (from openCreatePlaylistModal) ignores the id param.
        window.savePlaylistModal(playlist.id);
    });
};
 

window.savePlaylistModal = async function(playlistId) {
        const name = document.getElementById('plName')?.value.trim();
        const desc = document.getElementById('plDesc')?.value.trim();
        const color = document.getElementById('plColor')?.value;
        const isPublic = !!document.getElementById('plPublic')?.checked;
    const coverFile = document.getElementById('plCoverFile')?.files?.[0];
        if (!name) {
                alert('Tên không được để trống');
                return;
        }
        let finalCoverUrl = window.currentEditingPlaylist?.cover_url || null;
        if (coverFile) {
                const { data: { user } } = await supabase.auth.getUser();
                const uploadedUrl = await window.uploadPlaylistCover(user.id, playlistId, coverFile);
                if (uploadedUrl) finalCoverUrl = uploadedUrl;
        }
        const updates = { name, description: desc, color, cover_url: finalCoverUrl, is_public: isPublic };
        try {
                const { error } = await supabase.from('playlists').update(updates).eq('id', playlistId);
                if (error) throw error;
                document.getElementById('playlistEditPanel')?.remove();
                document.getElementById('playlistEditModal')?.remove();
                await window.loadDetailPlaylist(playlistId);
                await window.appFunctions.loadUserPlaylists(true);
                alert('Đã lưu playlist');
    } catch (err) {
                console.error('Lỗi lưu playlist:', err);
                alert('Lỗi: ' + err.message);
    }
        
    // close function
};


// Hàm getPublicPlaylistCoverUrl (sửa bucket 'cover')
function getPublicPlaylistCoverUrl(coverPath) {
    if (!coverPath) return null;
    if (coverPath.includes('supabase.co') || coverPath.startsWith('http')) return coverPath;
    const { data } = supabase.storage.from('cover').getPublicUrl(coverPath);  // ← FIX: Bucket 'cover'
    return data.publicUrl;
}

// Hàm save edit (sửa scope 'playlist', cover handle)
window.savePlaylistEdit = async function(playlistId) {
    const formId = `editPlaylistForm-${playlistId}`;
    const form = document.getElementById(formId);
    if (!form) return console.error('Form không tồn tại');

    const name = document.getElementById(`editName-${playlistId}`).value.trim();
    const desc = document.getElementById(`editDesc-${playlistId}`).value.trim();
    const color = document.getElementById(`editColor-${playlistId}`).value;
    const coverFile = document.getElementById(`editCover-${playlistId}`)?.files[0];  // ← FIX: Cover file

    if (!name) {
        alert('Tên playlist không được để trống!');
        return;
    }

    const currentPlaylist = window.currentEditingPlaylist;  // ← FIX: Scope từ loadDetailPlaylist
    let finalCoverUrl = currentPlaylist.cover_url || null;  // ← FIX: Default current
    
    if (coverFile) {
        const { data: { user } } = await supabase.auth.getUser();
        const uploadedUrl = await window.uploadPlaylistCover(user.id, playlistId, coverFile);
        if (uploadedUrl) finalCoverUrl = uploadedUrl;
    } else if (document.querySelector(`#editCover-${playlistId} + .btn-delete-cover`)) {  // If delete clicked
        finalCoverUrl = null;
    }


    // Lấy lại thứ tự track mới từ UI
    const sortableList = document.getElementById(`sortableTracks-${playlistId}`);
    let newOrder = [];
    if (sortableList) {
        newOrder = Array.from(sortableList.children).map(li => li.dataset.trackId);
    }

    const updates = {
        name,
        description: desc,
        color,
        cover_url: finalCoverUrl  // ← FIX: Update cover_url
    };

    try {
        // Cập nhật playlist info
        const { error } = await supabase
            .from('playlists')
            .update(updates)
            .eq('id', playlistId)
            .select();

        if (error) throw error;

        // Nếu có thay đổi thứ tự bài hát, cập nhật lại trường added_at cho playlist_tracks
        if (newOrder.length > 0) {
            for (let i = 0; i < newOrder.length; i++) {
                const trackId = newOrder[i];
                // Cập nhật added_at = i (hoặc trường order nếu có)
                await supabase
                    .from('playlist_tracks')
                    .update({ added_at: i })
                    .eq('playlist_id', playlistId)
                    .eq('track_id', trackId);
            }
        }

        console.log('Playlist updated:', updates);
        alert('Cập nhật thành công!');
        
        window.toggleEditPlaylist(playlistId, name, desc, color, finalCoverUrl);  // ← FIX: Pass cover to toggle
        await window.loadDetailPlaylist(playlistId); 
        await window.appFunctions.loadUserPlaylists(true);  
    } catch (error) {
        console.error('Lỗi update playlist:', error);
        alert(`Lỗi: ${error.message}. Kiểm tra quyền RLS nếu cần.`);
    }
};



// ← THÊM HÀM XÓA COVER
window.deletePlaylistCover = async function(playlistId) {
    if (!confirm('Xóa ảnh nền playlist?')) return;
    try {
        const { error } = await supabase
            .from('playlists')
            .update({ cover_url: null })
            .eq('id', playlistId);
        if (error) throw error;
        console.log('Cover deleted');
        await window.appFunctions.loadUserPlaylists(true);
        await window.loadDetailPlaylist(playlistId);  // Refresh detail
    } catch (err) {
        console.error('Lỗi xóa cover:', err);
        alert('Lỗi: ' + err.message);
    }
};

const defaultCover = 'https://lezswjtnlsmznkgrzgmu.supabase.co/storage/v1/object/public/cover/449bd474-7a51-4c22-b4a4-2ad8736d6fad/default-cover.webp';
/**
 * Render danh sách bài hát (Được dùng chung cho Playlist, Uploads, Search, Recommend)
 * @param {Array<Object>} tracks - Danh sách các đối tượng track
 * @param {HTMLElement} container - Container để chèn danh sách
 */
function renderTracks(tracks, container) {
    if(!container) return;
    container.innerHTML = '';

    tracks.forEach((track, index) => { 
        const item = document.createElement('div');
        item.className = 'track-item playable-track'; 

        const safeTitle = track.title ? track.title.trim() : 'Unknown Title';
        const safeArtist = track.artist ?track.artist.trim() : 'Unknown Artist';
        const safeCoverUrl = track.cover_url || '';
        const trackNumber = index + 1;

        item.addEventListener('click' , function(e){
            if (e.target.closest('.btn-action')) return;
            window.currentPlaylist = tracks;  // ← Fix scope: dùng window. để global
            window.playTrack(track, tracks, index); 
            e.preventDefault();  // ← Fix typo
        });

        const titleInnerHTML = safeTitle.length > 20 ? `${safeTitle}` : safeTitle;

        // ← FIX: Add trash button for playlist tracks (if in detail view)
        const isPlaylistDetail = container.id === 'trackList';  // Assume #trackList in detail
        const deleteButton = isPlaylistDetail ? `
            <div class="track-actions">
                <button class="btn-action btn-remove-track" onclick="window.removeTrackFromPlaylist('${track.id}', '${window.currentPlaylistId || ''}')" title="Xóa khỏi playlist">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        ` : '';

        item.innerHTML = `
            <div class="track-info">
                <span class="track-number">${trackNumber}.</span>
             <img src="${safeCoverUrl}" alt="${safeTitle} by ${safeArtist}" class="track-cover" 
                 onerror="if(!this._tried){this._tried=true;this.src='${defaultCover}';}" />
                <div class="track-details">
                    <strong class="track-name marquee-container">
                        <span class="track-title-inner">${titleInnerHTML}</span>
                    </strong>
                    <small class="track-artist">${safeArtist}</small>
                </div>
            </div>
            ${deleteButton}
        `;
        
        const titleContainer = item.querySelector('.marquee-container');
        if (titleContainer) {
            const titleText = titleContainer.querySelector('.track-title-inner');
            if (titleText && titleText.scrollWidth > titleContainer.clientWidth) {
                titleText.classList.add('marquee');  
            }
        }
        
        container.appendChild(item);
    });
    console.log(`Rendered ${tracks.length} tracks in container`);
}

// ← THÊM HÀM XÓA TRACK KHỎI PLAYLIST
window.removeTrackFromPlaylist = async function(trackId, playlistId) {
    if (!confirm('Xóa bài hát khỏi playlist?')) return;
    try {
        const { error } = await supabase
            .from('playlist_tracks')
            .delete()
            .eq('playlist_id', playlistId)
            .eq('track_id', trackId);
        if (error) throw error;
        alert('Đã xóa bài hát khỏi playlist!');
        await window.loadDetailPlaylist(playlistId);  // Refresh detail
    } catch (err) {
        console.error('Lỗi xóa track:', err);
        alert('Lỗi: ' + err.message);
    }
};

// Hàm hiển thị playlist grid với màu sắc (THÊM MỚI)
export function renderPlaylists(playlists, container) {
    if (!playlists || playlists.length === 0) {
        container.innerHTML = '<p class="empty-message">Chưa có playlist nào.</p>';
        return;
    }

    container.innerHTML = '';

        playlists.forEach(playlist => {
            const card = document.createElement('div');
            card.className = 'playlist-card spotify-style';
            card.dataset.playlistId = playlist.id;

            // ÁP DỤNG MÀU TỪ DATABASE
            const color = playlist.color || '#1DB954';
            card.style.setProperty('--card-primary-color', color);
            card.style.setProperty('--card-secondary-color', '#282828');


            let coverHtml = '';
            if (playlist.cover_url) {
                const coverUrl = playlist.cover_url.startsWith('http') ? playlist.cover_url : getPublicPlaylistCoverUrl(playlist.cover_url);
                coverHtml = `<div class="playlist-cover-img" style="background-image:url('${coverUrl}');"></div>`;
            } else {
                // Lấy chữ cái đầu tiên, viết hoa
                const firstChar = playlist.name && playlist.name.trim() ? playlist.name.trim()[0].toUpperCase() : '?';
                coverHtml = `<div class="playlist-cover-placeholder" style="background:${color};">
                    <span class="playlist-cover-letter">${firstChar}</span>
                </div>`;
            }

            // Lấy số lượng bài hát từ playlist_tracks.count nếu có
            let trackCount = 0;
            if (playlist.playlist_tracks && typeof playlist.playlist_tracks.count === 'number') {
                trackCount = playlist.playlist_tracks.count;
            }

            const ownerLine = playlist.owner_username ? `<p class="playlist-owner" style="font-size:12px;color:#aaa;margin-top:4px;">by ${escapeHtml(playlist.owner_username)}</p>` : '';
            card.innerHTML = `
                ${coverHtml}
                <div class="playlist-info">
                    <h3>${escapeHtml(playlist.name)}</h3>
                    <p>${trackCount} bài hát</p>
                    ${ownerLine}
                </div>
            `;

            card.addEventListener('click', () => {
                window.switchTab('detail-playlist', playlist.id);
            });

            container.appendChild(card);
        });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Hàm tạo playlist mới với màu sắc
export async function createPlaylist(playlistData) {
    try {
        const { data, error } = await supabase
            .from('playlists')
            .insert([{
                name: playlistData.name,
                color: playlistData.color,
                user_id: await getCurrentUserId(),
                cover_url: playlistData.cover_url || null,
                description: playlistData.description || null,
                is_public: !!playlistData.is_public
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Lỗi tạo playlist:', error);
        throw error;
    }
}

async function getCurrentUserId() {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
}

// ← THÊM HÀM XÓA PLAYLIST (từ loadDetailPlaylist onclick)
window.deletePlaylist = async function(playlistId) {
    if (!confirm('Xóa playlist này? Tất cả bài hát sẽ bị xóa!')) return;
    try {
        // Xóa tracks liên quan
        const { error: unlinkError } = await supabase
            .from('playlist_tracks')
            .delete()
            .eq('playlist_id', playlistId);
        if (unlinkError) throw unlinkError;
        
        // Xóa playlist
        const { error: deleteError } = await supabase
            .from('playlists')
            .delete()
            .eq('id', playlistId);
        if (deleteError) throw deleteError;
        
        alert('Playlist đã xóa!');
        window.switchTab('home');  // Back to home
        window.cachedPlaylists = null;
        await window.appFunctions.loadUserPlaylists(true);  // Refresh grid
    } catch (err) {
        console.error('Lỗi xóa playlist:', err);
        alert('Lỗi: ' + err.message);
    }
};


window.renderTracks = renderTracks;
window.addTrackToPlaylist = window.addTrackToPlaylist;
window.loadDetailPlaylist = window.loadDetailPlaylist;
window.renderPlaylists = renderPlaylists;