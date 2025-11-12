import { supabase } from '../supabase/client.js';

if (!supabase) {
    console.error('SUPABASE CLIENT NOT INITIALIZED! Check load order: client.js must load before auth.js');
    throw new Error('Supabase client missing');
}
console.log('Script loaded at path:', window.location.pathname);

let isLoggin = false;

function getBasePath() {
    const envBase = import.meta && import.meta.env && import.meta.env.BASE_URL;
    if (envBase) {
        return envBase.endsWith('/') ? envBase : envBase + '/';
    }
    if (window.location.pathname.includes('/manh-music/') || window.location.hostname.endsWith('github.io')) {
        return '/manh-music/';
    }
    return '/';
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Auth.js: DOMContentLoaded');

    // Centralized event handler
    const handleAuthChangeEvent = (event, session) => {
        console.log(`Auth.js: Handling event ${event}`, session);
        const user = session?.user || null;
        
        // Avoid overwriting a valid user with null if events are out of order
        if (user || !window.currentUser) {
            window.currentUser = user;
        }

        // Dispatch a single, consistent event for the app to listen to
        document.dispatchEvent(new CustomEvent('SUPABASE_AUTH_CHANGE', {
            detail: { event, session }
        }));

        checkRedirect();
    };

    // This is our primary listener for live auth changes (login, logout)
    supabase.auth.onAuthStateChange((event, session) => {
        console.log(`Auth.js: onAuthStateChange event: ${event}`, session);
        // We trust onAuthStateChange as the source of truth for live events
        handleAuthChangeEvent(event, session);
    });

    // This listener handles the initial, fast session restoration from client.js
    window.addEventListener('SUPABASE_SESSION_RESTORED', (e) => {
        console.log('Auth.js: Received SUPABASE_SESSION_RESTORED');
        // We treat the restored session as the initial session state
        handleAuthChangeEvent('INITIAL_SESSION', e.detail.session);
    });

    // Initial check for pages that might not have a user
    // This helps redirect from protected pages if the session restoration is slow
    setTimeout(() => {
        checkRedirect();
    }, 50);


    // Attach listeners to forms
    attachFormListeners();
});

function checkRedirect() {
    const user = window.currentUser;
    const basePath = getBasePath();
    const currentPath = window.location.pathname;
    const isAuthPage = currentPath === `${basePath}` || currentPath.endsWith('/index.html') || currentPath.includes('signup.html');
    const isPlayerPage = currentPath.includes('player.html');

    if (!user && isPlayerPage) {
        console.log('Auth.js: No user on player page, redirecting to login.');
        window.location.href = basePath;
    } else if (user && isAuthPage) {
        console.log('Auth.js: User is logged in and on auth page, redirecting to player.');
        window.location.href = `${basePath}player.html`;
    } else {
        console.log('Auth.js: Auth state is consistent with current page.');
    }
}

function attachFormListeners() {
    // Gắn listener signup
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        console.log('FOUND signupForm');
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('SIGNUP SUBMIT');
            await signup();
        });
    }

    // Gắn listener login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        console.log('FOUND loginForm');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('LOGIN SUBMIT');
            await loginWithEmail();
        });
    }
});

function displayError(inputId, message) {
    const errorElement = document.getElementById(`${inputId}Error`);
    const inputElement = document.getElementById(inputId);

    if (errorElement && inputElement) {
        errorElement.textContent = '';
        errorElement.classList.remove('active');
        inputElement.classList.remove('error');

        if (message) {
            errorElement.textContent = message;
            errorElement.classList.add('active');
            inputElement.classList.add('error');
        }
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPassword(password) {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    return passwordRegex.test(password);
}

async function signup() {
    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const birthday = document.getElementById('signupBirthday').value;

    // Xóa lỗi cũ
    displayError('signupUsername', null);
    displayError('signupEmail', null);
    displayError('signupPassword', null);
    displayError('confirmPassword', null);
    displayError('signupBirthday', null);

    let hasError = false;

    if (!username) { 
        displayError('signupUsername', 'Vui lòng nhập Tên người dùng.'); 
        hasError = true; 
    }
    if (!email) { 
        displayError('signupEmail', 'Vui lòng nhập Email.'); 
        hasError = true; 
    } else if (!isValidEmail(email)) { 
        displayError('signupEmail', 'Định dạng Email không hợp lệ.'); 
        hasError = true; 
    }
    
    if (!password) { 
        displayError('signupPassword', 'Vui lòng nhập Mật khẩu.'); 
        hasError = true; 
    } else if (!isValidPassword(password)) { 
        displayError('signupPassword', 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt.'); 
        hasError = true; 
    }
    
    if (!confirmPassword) { 
        displayError('confirmPassword', 'Vui lòng nhập lại Mật khẩu.'); 
        hasError = true; 
    } else if (password !== confirmPassword) {
        displayError('confirmPassword', 'Mật khẩu xác nhận không khớp.'); 
        hasError = true; 
    }
    
    if (!birthday) { 
        displayError('signupBirthday', 'Vui lòng nhập Ngày sinh.'); 
        hasError = true; 
    }
    
    if (hasError) return;

    try {
        // Kiểm tra username trùng lặp
        const { count: usernameCount, error: usernameCheckError } = await supabase
            .from('users')
            .select('username', { count: 'exact' })
            .eq('username', username);

        if (usernameCheckError) throw new Error(`Lỗi kiểm tra tên người dùng: ${usernameCheckError.message}`);

        if (usernameCount > 0) {
            displayError('signupUsername', 'Tên người dùng này đã tồn tại.');
            return;
        }

        console.log('📝 Signing up user (email confirmation disabled)...');
        
        const { data, error } = await supabase.auth.signUp({ 
            email, 
            password,
            options: {
                data: {
                    username: username,
                    birthday: birthday
                }
            }
        });

        if (error) {
            console.error('Signup error:', error);
            if (error.message.includes('already registered')) {
                displayError('signupEmail', 'Email này đã được đăng ký.');
            } else {
                displayError('signupEmail', `Đăng ký thất bại: ${error.message}`);
            }
            return;
        }

        console.log('Signup success:', data.user.email);
        console.log('User ID:', data.user.id);

        // Insert vào users table - CRITICAL: Phải thành công trước khi redirect
        const userRecord = {
            id: data.user.id,
            email: email,
            username: username,
            birthday: birthday,
            avatar_url: 'https://lezswjtnlsmznkgrzgmu.supabase.co/storage/v1/object/public/cover/449bd474-7a51-4c22-b4a4-2ad8736d6fad/default-avatar.png',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        console.log('📝 Attempting to insert user record:', userRecord);
        
        // Try insert first, then upsert if exists
        const { data: insertData, error: insertError } = await supabase
            .from('users')
            .insert(userRecord)
            .select()
            .single();

        if (insertError) {
            console.error('❌ Insert failed, trying upsert...', insertError);
            
            // Try upsert as fallback
            const { data: upsertData, error: upsertError } = await supabase
                .from('users')
                .upsert(userRecord, { onConflict: 'id' })
                .select()
                .single();
            
            if (upsertError) {
                console.error('❌ Upsert also failed:', upsertError);
                console.error('Error details:', {
                    message: upsertError.message,
                    details: upsertError.details,
                    hint: upsertError.hint,
                    code: upsertError.code
                });
                
                // BLOCK user - không cho tiếp tục nếu không insert được
                alert('Đăng ký thành công nhưng không thể tạo profile. Vui lòng liên hệ admin.');
                return;
            } else {
                console.log('✅ Users table populated via upsert:', upsertData);
            }
        } else {
            console.log('✅ Users table populated via insert:', insertData);
        }

        const basePath = getBasePath();
        alert('Đăng ký thành công! Bạn có thể đăng nhập ngay.');
        window.location.href = basePath + 'index.html';
        return;

    } catch (error) {
        console.error('Lỗi hệ thống khi đăng ký:', error);
        console.error('Exact error:', error.message);
        displayError('signupEmail', `Lỗi hệ thống: ${error.message}`);
    }
}

async function loginWithEmail() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const loginBtn = document.querySelector('#loginForm button[type="submit"]') || document.getElementById('loginBtn');
    const basePath = getBasePath();

    displayError('loginEmail', null); 
    displayError('loginPassword', null);

    if (!email || !password) {
        if (!email) displayError('loginEmail', 'Vui lòng nhập Email.');
        if (!password) displayError('loginPassword', 'Vui lòng nhập Mật khẩu.');
        return;
    }

    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Đang đăng nhập...';
    }

    try {
        console.log('Starting signInWithPassword for', email);
        const { data: { user }, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            console.error('Login error:', error);
            const errMsg = error.message.includes('Invalid') 
                ? 'Email hoặc mật khẩu không chính xác.' 
                : `Đăng nhập thất bại: ${error.message}`;
            displayError('loginPassword', errMsg);
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Đăng nhập';
            }
            return;
        }

        console.log('signIn success, user:', user.email);

        // Await session
        const { data: { session } } = await supabase.auth.getSession();
        window.currentUser = session?.user || user;

        // Dispatch
        window.dispatchEvent(new CustomEvent('SUPABASE_SESSION_RESTORED', { detail: { session } }));
        window.dispatchEvent(new CustomEvent('SUPABASE_AUTH_CHANGE', { detail: { event: 'SIGNED_IN', session } }));

        // Clear form
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';

        displayError('loginPassword', 'Đăng nhập thành công! Đang chuyển hướng...');

        // Check email confirmed
        if (user.app_metadata?.provider === 'email' && !user.email_confirmed_at) {
            alert('Email chưa xác nhận! Vui lòng kiểm tra mail.');
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Đăng nhập';
            }
            return;
        }

        console.log('Email confirmed OK');

        // === SỬA TẠI ĐÂY: DÙNG Promise.race ĐỂ GIỚI HẠN THỜI GIAN ===
        const timeoutPromise = (ms) => new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), ms)
        );

        let profile = null;
        try {
            const { data: selectData, error: selectError } = await Promise.race([
                supabase
                    .from('users')
                    .select('username, birthday, avatar_url')
                    .eq('id', user.id)
                    .single(),
                timeoutPromise(3000) // 3 giây
            ]);
            profile = selectData;
            if (selectError && selectError.code !== 'PGRST116') {
                console.error('Select profile error:', selectError);
            }
        } catch (e) {
            if (e.message !== 'Timeout') console.warn('Select profile failed:', e);
        }

        const username = profile?.username || user.user_metadata?.username || email.split('@')[0];
        const birthday = profile?.birthday || user.user_metadata?.birthday || null;

        // Upsert với timeout
        try {
            await Promise.race([
                supabase
                    .from('users')
                    .upsert({
                        id: user.id,
                        email: user.email,
                        username,
                        birthday,
                        avatar_url: profile?.avatar_url || 'https://lezswjtnlsmznkgrzgmu.supabase.co/storage/v1/object/public/cover/449bd474-7a51-4c22-b4a4-2ad8736d6fad/default-avatar.png',
                        updated_at: new Date().toISOString()
                    }),
                timeoutPromise(3000)
            ]);
            console.log('Profile upserted');
        } catch (e) {
            if (e.message !== 'Timeout') console.warn('Upsert failed:', e);
            else console.log('Upsert timeout - continue');
        }

        setTimeout(async () => {
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Đăng nhập';
            }
            // Đảm bảo session đã lưu trước khi redirect
            let tries = 0;
            let sessionReady = false;
            while (tries < 5 && !sessionReady) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session && session.user) sessionReady = true;
                else await new Promise(r => setTimeout(r, 200));
                tries++;
            }
            window.location.href = basePath + 'player.html';
        }, 300);

    } catch (error) {
        console.error('Lỗi hệ thống loginWithEmail:', error);
        displayError('loginPassword', `Lỗi hệ thống: ${error.message}`);
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Đăng nhập';
        }
    }
}

async function loginWithGoogle() {
    console.log('Login with Google called');
    
    try {
        const basePath = getBasePath();

        // Redirect về index của project path để Supabase xử lý code/token rồi mới điều hướng tiếp
        const redirectUrl = `${window.location.origin}${basePath}`; // e.g., https://.../manh-music/
        console.log('Google OAuth redirectTo →', redirectUrl);

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl
            }
        });

        if (error) throw error;
        console.log('Google OAuth initiated:', data);

    } catch (error) {
        console.error('Google login error:', error);
        alert('Lỗi đăng nhập Google: ' + error.message);
    }
}

async function logout() {
    try {
        console.log('Starting logout...');

        // 1. ĐÁNH DẤU LOGOUT NGAY LẬP TỨC
        localStorage.setItem('manh-music-logout', 'true');
        localStorage.setItem('manh-music-logout-time', Date.now().toString());

        // 2. Gọi signOut
        const timeoutMs = 3000;
        let signOutError = null;

        try {
            const result = await Promise.race([
                supabase.auth.signOut({ scope: 'local' }).then(() => ({ success: true })),
                new Promise(resolve => setTimeout(() => resolve({ timeout: true }), timeoutMs))
            ]);

            if (result.timeout) {
                console.warn('signOut timed out');
            } else {
                console.log('Supabase signOut success');
            }
        } catch (err) {
            signOutError = err;
            console.error('signOut error:', err);
        }

        // 3. FORCE CLEAR ALL AUTH DATA
        const keysToRemove = Object.keys(localStorage).filter(key =>
            key.startsWith('sb-') ||
            key.includes('supabase.auth') ||
            key.includes('token')
        );

        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log('Removed:', key);
        });

        // 4. Clear cache
        const cacheKeys = [
            'cachedPlaylists', 'cachedHistoryTracks', 'cachedRecommendedTracks',
            'cachedProfile', 'cachedPlaylistTracks', 'cachedRecommendationsPlaylistId'
        ];
        cacheKeys.forEach(key => window[key] = null);
        window.userSessionLoaded = false;

        console.log('Logout cleanup complete');

        const basePath = getBasePath();
        window.location.replace(basePath + 'index.html');

    } catch (error) {
        console.error('Lỗi logout:', error);
        localStorage.setItem('manh-music-logout', 'true');
        const basePath = getBasePath();
        window.location.replace(basePath + 'index.html');
    }
}

supabase.auth.onAuthStateChange((event, session) => {
    console.log('AUTH STATE CHANGED:', event, session?.user?.email || 'no user');

    if (event === 'SIGNED_IN' && session?.user) {
        window.currentUser = session.user;
        // Tự động redirect nếu đang ở index.html
        if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
            const basePath = getBasePath();
            window.location.href = basePath + 'player.html';
        }
        // Dispatch để sync
        window.dispatchEvent(new CustomEvent('SUPABASE_AUTH_CHANGE', { detail: { event, session } }));
    }

    if (event === 'SIGNED_OUT') {
        window.currentUser = null;
        const basePath = getBasePath();
        window.location.href = basePath + 'index.html';
    }
});

window.authFunctions = {
    signup,
    loginWithEmail, 
    loginWithGoogle,
    logout
};

// Also export for module consumers so app.js can import directly and avoid relying on globals
export { signup, loginWithEmail, loginWithGoogle, logout };