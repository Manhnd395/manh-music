// public/supabase/client.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

console.log('📦 client.js loaded - initializing Supabase client');

const supabaseUrl = window.SUPABASE_URL;
const supabaseAnonKey = window.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase config missing');
}

// Thêm debug config nếu localhost (như web B)
if (window.location.hostname === 'localhost') {
    console.log('DEBUG: SUPABASE_URL:', supabaseUrl);
    console.log('DEBUG: ANON_KEY length:', supabaseAnonKey?.length || 0);
}


const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: localStorage, // Chuyển sang localStorage để tránh bị block
    autoRefreshToken: true,
    detectSessionInUrl: false // tự xử lý callback để chủ động thời điểm xoá token
  }
});window.supabase = supabase;
window.dispatchEvent(new Event('SUPABASE_CLIENT_READY'));

const OAUTH_PARAM_KEYS = ['code','state','access_token','refresh_token','expires_at','expires_in','token_type','provider_token','type'];

// Helper: Decode JWT để lấy user info (không cần verify vì chỉ dùng để hiển thị)
function decodeJWT(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Failed to decode JWT:', e);
        return null;
    }
}

const hasOAuthParamsInUrl = () => {
    const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    if (rawHash) {
        const hashParams = new URLSearchParams(rawHash);
        if (OAUTH_PARAM_KEYS.some(key => hashParams.has(key))) {
            return true;
        }
    }
    if (window.location.search) {
        const searchParams = new URLSearchParams(window.location.search.startsWith('?') ? window.location.search.slice(1) : window.location.search);
        if (OAUTH_PARAM_KEYS.some(key => searchParams.has(key))) {
            return true;
        }
    }
    return false;
};

const cleanupOAuthParams = () => {
    if (!hasOAuthParamsInUrl()) return;

    const url = new URL(window.location.href);
    let hashChanged = false;
    if (url.hash) {
        const hashParams = new URLSearchParams(url.hash.slice(1));
        OAUTH_PARAM_KEYS.forEach(key => {
            if (hashParams.has(key)) {
                hashParams.delete(key);
                hashChanged = true;
            }
        });
        url.hash = hashParams.toString() ? `#${hashParams.toString()}` : '';
    }

    let searchChanged = false;
    OAUTH_PARAM_KEYS.forEach(key => {
        if (url.searchParams.has(key)) {
            url.searchParams.delete(key);
            searchChanged = true;
        }
    });

    if (hashChanged || searchChanged) {
        const newPath = url.pathname + (url.search ? url.search : '') + (url.hash ? url.hash : '');
        window.history.replaceState({}, document.title, newPath);
    }
};

async function captureSessionFromUrl() {
    // Hợp nhất hash và query để hỗ trợ cả implicit flow lẫn PKCE
    const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const rawSearch = window.location.search.startsWith('?') ? window.location.search.slice(1) : window.location.search;
    const hashParams = new URLSearchParams(rawHash);
    const searchParams = new URLSearchParams(rawSearch);

    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const code = hashParams.get('code') || searchParams.get('code');

    const hasOAuthParams = accessToken || refreshToken || code;
    if (!hasOAuthParams) return null;

    console.log('🔐 Detected OAuth params in URL - syncing Supabase session (manual flow)');
    console.log('  → access_token:', accessToken ? `${accessToken.substring(0, 20)}... (length: ${accessToken.length})` : 'none');
    console.log('  → refresh_token:', refreshToken ? `${refreshToken.substring(0, 20)}... (length: ${refreshToken.length})` : 'none');
    console.log('  → code:', code ? `${code.substring(0, 20)}...` : 'none');

    try {
        if (accessToken && refreshToken) {
            console.log('🔄 Attempting setSession with tokens from hash...');
            
            // STRATEGY 1: Thử setSession bình thường
            try {
                const setSessionPromise = supabase.auth.setSession({ 
                    access_token: accessToken, 
                    refresh_token: refreshToken 
                });
                
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('setSession timeout after 5s')), 5000)
                );
                
                const { data, error } = await Promise.race([setSessionPromise, timeoutPromise]);
                
                if (error) {
                    console.error('❌ setSession failed:', error);
                    throw error;
                }
                
                console.log('✅ Session stored from URL fragment for', data.session?.user?.email ?? 'unknown user');
                window.currentUser = data.session?.user ?? null;
                localStorage.removeItem('manh-music-logout');
                localStorage.removeItem('manh-music-logout-time');
                cleanupOAuthParams();
                
                window.dispatchEvent(new CustomEvent('SUPABASE_AUTH_CHANGE', { 
                    detail: { event: 'SIGNED_IN', session: data.session } 
                }));
                
                return { session: data.session };
                
            } catch (setSessionError) {
                console.warn('⚠️ setSession failed, trying fallback: manual storage write');
                
                // STRATEGY 2: FALLBACK - Ghi trực tiếp vào localStorage VÀ decode JWT
                try {
                    const storageKey = `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;
                    const sessionData = {
                        access_token: accessToken,
                        refresh_token: refreshToken,
                        expires_at: Math.floor(Date.now() / 1000) + 3600,
                        expires_in: 3600,
                        token_type: 'bearer'
                    };
                    
                    localStorage.setItem(storageKey, JSON.stringify(sessionData));
                    console.log('✅ Manually wrote session to localStorage');
                    
                    // Decode JWT để lấy user info
                    const payload = decodeJWT(accessToken);
                    if (!payload) {
                        throw new Error('Failed to decode access token');
                    }
                    
                    console.log('✅ Decoded JWT payload:', payload.email);
                    
                    // Tạo mock session object từ JWT payload
                    const mockSession = {
                        access_token: accessToken,
                        refresh_token: refreshToken,
                        expires_at: payload.exp,
                        expires_in: 3600,
                        token_type: 'bearer',
                        user: {
                            id: payload.sub,
                            email: payload.email,
                            email_confirmed_at: payload.email_verified ? new Date().toISOString() : null,
                            phone: payload.phone || '',
                            created_at: new Date(payload.iat * 1000).toISOString(),
                            updated_at: new Date().toISOString(),
                            app_metadata: payload.app_metadata || {},
                            user_metadata: payload.user_metadata || {},
                            aud: payload.aud,
                            role: payload.role
                        }
                    };
                    
                    window.currentUser = mockSession.user;
                    console.log('✅ Created mock session from JWT for', mockSession.user.email);
                    
                    cleanupOAuthParams();
                    
                    // Dispatch SIGNED_IN event với mock session
                    window.dispatchEvent(new CustomEvent('SUPABASE_AUTH_CHANGE', { 
                        detail: { event: 'SIGNED_IN', session: mockSession } 
                    }));
                    
                    // Thử refresh trong background (không await để không block)
                    supabase.auth.refreshSession().then(({ data, error }) => {
                        if (data?.session) {
                            console.log('🔄 Background refresh succeeded, upgrading to real session');
                            window.currentUser = data.session.user;
                            window.dispatchEvent(new CustomEvent('SUPABASE_AUTH_CHANGE', { 
                                detail: { event: 'TOKEN_REFRESHED', session: data.session } 
                            }));
                        } else if (error) {
                            console.warn('⚠️ Background refresh failed, using mock session:', error.message);
                        }
                    }).catch(err => {
                        console.warn('⚠️ Background refresh exception, using mock session:', err.message);
                    });
                    
                    return { session: mockSession };
                    
                } catch (fallbackError) {
                    console.error('❌ Fallback strategy also failed:', fallbackError);
                    return { error: fallbackError };
                }
            }
        }

        if (code) {
            console.log('🔄 Attempting exchangeCodeForSession with code...');
            const exchangePromise = supabase.auth.exchangeCodeForSession(code);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('exchangeCode timeout after 5s')), 5000)
            );
            
            const { data, error } = await Promise.race([exchangePromise, timeoutPromise]);
            
            if (error) {
                console.error('❌ Failed to exchange code for session:', error);
                return { error };
            }
            console.log('✅ Session exchanged from authorization code for', data.session?.user?.email ?? 'unknown user');
            window.currentUser = data.session?.user ?? null;
            localStorage.removeItem('manh-music-logout');
            localStorage.removeItem('manh-music-logout-time');
            cleanupOAuthParams();
            
            window.dispatchEvent(new CustomEvent('SUPABASE_AUTH_CHANGE', { 
                detail: { event: 'SIGNED_IN', session: data.session } 
            }));
            
            return { session: data.session };
        }
    } catch (err) {
        console.error('❌ Unexpected error while capturing OAuth session:', err);
        return { error: err };
    }

    return null;
}

// ✅ Kiểm tra session (bước lấy dữ liệu)
(async function restoreSessionAndNotify() {
    const captureResult = await captureSessionFromUrl();
    console.log('📊 captureSessionFromUrl result:', captureResult);

    const logoutFlag = localStorage.getItem('manh-music-logout');
    if (logoutFlag === 'true') {
        console.log('Detected recent logout — clearing auth & skipping restore');
        localStorage.removeItem('manh-music-logout');
        localStorage.removeItem('manh-music-logout-time');

        // Xóa mọi key auth
        Object.keys(localStorage).forEach(key => {
            if (key.includes('sb-') || key.includes('supabase.auth') || key.includes('token')) {
                localStorage.removeItem(key);
            }
        });

        window.dispatchEvent(new CustomEvent('SUPABASE_SESSION_RESTORED', { detail: { session: null } }));
        return;
    }
    
    // Nếu vừa capture session thành công, dùng session đó luôn
    if (captureResult?.session) {
        console.log('✅ Using freshly captured session:', captureResult.session.user.email);
        window.dispatchEvent(new CustomEvent('SUPABASE_SESSION_RESTORED', { detail: { session: captureResult.session } }));
        return;
    }
    
    // Nếu capture thất bại hoàn toàn
    if (captureResult?.error) {
        console.error('❌ OAuth capture failed completely:', captureResult.error);
    }
    
    try {
        const { data, error } = await supabase.auth.getSession();
        let session = data?.session ?? null;
        console.log('client.js getSession result:', session?.user?.email ?? null, error ?? null);
        
        if (session?.user) {
            window.currentUser = session.user;
            console.log('✅ Client session restored & dispatched:', session.user.email);
            cleanupOAuthParams();
            
            // Force refresh session nếu cần (cho token expire hoặc stale)
            const now = Math.floor(Date.now() / 1000);
            if (session.expires_at < now + 300) {  // Nếu expire trong 5 phút
                console.log('🔄 Token near expiry - refreshing session');
                const { data: { session: refreshed }, error: refreshErr } = await supabase.auth.refreshSession({ refresh_token: session.refresh_token });
                if (refreshErr) {
                    console.error('❌ Refresh failed:', refreshErr);
                    // Clear nếu fail
                    localStorage.removeItem('sb-lezswjtnlsmznkgrzgmu-auth-token');
                } else if (refreshed?.user) {
                    window.currentUser = refreshed.user;
                    console.log('🔄 Client session refreshed:', refreshed.user.email);
                    session = refreshed;  // Update cho dispatch
                }
            }
            
            // Quick RLS test: Check nếu user có thể query self (verify auth/RLS)
            supabase.from('users').select('id').eq('id', session.user.id).single().then(({ data, error }) => {
                if (error) {
                    console.warn('⚠️ Quick RLS test failed in client.js:', error.message);
                } else {
                    console.log('✅ Client RLS quick test OK');
                }
            }).catch(quickErr => console.warn('Quick test failed:', quickErr));
            
            window.dispatchEvent(new CustomEvent('SUPABASE_SESSION_RESTORED', { detail: { session } }));
        } else {
            console.warn('❌ No session in client.js - clearing storage if corrupt');
            const authKey = localStorage.getItem('sb-lezswjtnlsmznkgrzgmu-auth-token');
            if (authKey) {  // Nếu có nhưng parse fail
                try {
                    JSON.parse(authKey);  // Test parse
                } catch {
                    localStorage.removeItem('sb-lezswjtnlsmznkgrzgmu-auth-token');
                    console.log('🔄 Cleared corrupt auth token');
                }
            }
            window.dispatchEvent(new CustomEvent('SUPABASE_SESSION_RESTORED', { detail: { session: null, error } }));
        }
    } catch (err) {
        console.warn('Error getting session:', err);
        window.dispatchEvent(new CustomEvent('SUPABASE_SESSION_RESTORED', { detail: { session: null, error: err } }));
    }
})();

const checkLogoutFlag = () => {
    if (localStorage.getItem('manh-music-logout') === 'true') {
        console.log('Global logout flag detected — blocking auth');
        return true;
    }
    return false;
};

supabase.auth.onAuthStateChange((event, session) => {
    if (localStorage.getItem('manh-music-logout') === 'true') {
        console.log('onAuthStateChange ignored due to logout flag');
        return;
    }
    console.log('client.js AUTH STATE CHANGED:', event, session?.user?.email ?? 'no user', 'at', new Date().toISOString());
    window.currentUser = session?.user ?? null;
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        cleanupOAuthParams();
    }
    window.dispatchEvent(new CustomEvent('SUPABASE_AUTH_CHANGE', { detail: { event, session } }));
});

export { supabase };
export default supabase;