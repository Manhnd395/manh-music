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
    storage: localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: false, // Tắt vì không hoạt động, tự xử lý thủ công
    flowType: 'implicit'
  }
});window.supabase = supabase;
window.dispatchEvent(new Event('SUPABASE_CLIENT_READY'));

const OAUTH_PARAM_KEYS = ['code','state','access_token','refresh_token','expires_at','expires_in','token_type','provider_token','type'];

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
        console.log('🧹 Cleaned OAuth params from URL');
    }
};

// Manual capture vì detectSessionInUrl không hoạt động
async function manualCaptureSession() {
    const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const hashParams = new URLSearchParams(rawHash);
    
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    
    if (!accessToken || !refreshToken) return null;
    
    console.log('🔧 Manual session capture starting...');
    console.log('  → access_token length:', accessToken.length);
    console.log('  → refresh_token length:', refreshToken.length);
    
    try {
        // QUAN TRỌNG: Dùng setSession() của Supabase SDK để lưu đúng cách
        console.log('🔄 Calling supabase.auth.setSession()...');
        
        // Timeout protection
        const setSessionPromise = supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        });
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('setSession timeout')), 3000)
        );
        
        const { data, error } = await Promise.race([setSessionPromise, timeoutPromise]);
        
        if (error) {
            console.error('❌ setSession failed:', error);
            // Fallback: Gọi API thủ công
            console.log('⚠️ Trying API fallback...');
            return await manualApiCapture(accessToken, refreshToken);
        }
        
        if (data?.session) {
            console.log('✅ Session set via SDK for', data.session.user.email);
            window.currentUser = data.session.user;
            localStorage.removeItem('manh-music-logout');
            localStorage.removeItem('manh-music-logout-time');
            cleanupOAuthParams();
            
            window.dispatchEvent(new CustomEvent('SUPABASE_AUTH_CHANGE', { 
                detail: { event: 'SIGNED_IN', session: data.session } 
            }));
            
            return data.session;
        }
        
        return null;
        
    } catch (error) {
        console.error('❌ Manual capture exception:', error);
        // Fallback
        console.log('⚠️ Exception caught, using API fallback...');
        return await manualApiCapture(accessToken, refreshToken);
    }
}

// Fallback: Direct API call
async function manualApiCapture(accessToken, refreshToken) {
    try {
        console.log('🔧 Fallback: Direct API call...');
        const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'apikey': supabaseAnonKey
            }
        });
        
        if (!response.ok) {
            throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        }
        
        const user = await response.json();
        console.log('✅ User fetched from API:', user.email);
        
        // Lưu vào localStorage theo format Supabase
        const storageKey = `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;
        const sessionData = {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
            token_type: 'bearer',
            user: user
        };
        
        localStorage.setItem(storageKey, JSON.stringify(sessionData));
        localStorage.removeItem('manh-music-logout');
        localStorage.removeItem('manh-music-logout-time');
        console.log('✅ Session saved to localStorage via fallback');
        
        window.currentUser = user;
        cleanupOAuthParams();
        
        // Fire event
        window.dispatchEvent(new CustomEvent('SUPABASE_AUTH_CHANGE', { 
            detail: { event: 'SIGNED_IN', session: sessionData } 
        }));
        
        return sessionData;
        
    } catch (error) {
        console.error('❌ Fallback API capture failed:', error);
        return null;
    }
}

// ✅ Kiểm tra session (bước lấy dữ liệu)
(async function restoreSessionAndNotify() {
    // Nếu có OAuth params trong URL, xử lý thủ công
    const hasOAuthTokens = hasOAuthParamsInUrl();
    if (hasOAuthTokens) {
        console.log('🔐 OAuth params detected in URL:', window.location.hash.substring(0, 100) + '...');
        const capturedSession = await manualCaptureSession();
        
        if (capturedSession) {
            console.log('✅ Manual capture succeeded, dispatching event');
            window.dispatchEvent(new CustomEvent('SUPABASE_SESSION_RESTORED', { 
                detail: { session: capturedSession } 
            }));
            return;
        } else {
            console.error('❌ Manual capture failed');
        }
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
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
    
    try {
        const { data, error } = await supabase.auth.getSession();
        let session = data?.session ?? null;
        console.log('client.js getSession result:', session?.user?.email ?? null, error ?? null);
        
        // Debug: Check localStorage
        const storageKey = `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;
        const storedData = localStorage.getItem(storageKey);
        console.log('📦 localStorage check:', {
            hasData: !!storedData,
            dataLength: storedData?.length || 0,
            sessionFromGet: !!session
        });
        
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
    console.log('🔔 client.js AUTH STATE CHANGED:', event, session?.user?.email ?? 'no user', 'at', new Date().toISOString());
    
    // Log chi tiết để debug
    if (event === 'SIGNED_IN') {
        console.log('📊 Session details:', {
            hasSession: !!session,
            hasUser: !!session?.user,
            userId: session?.user?.id,
            email: session?.user?.email,
            provider: session?.user?.app_metadata?.provider
        });
    }
    
    window.currentUser = session?.user ?? null;
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        cleanupOAuthParams();
    }
    window.dispatchEvent(new CustomEvent('SUPABASE_AUTH_CHANGE', { detail: { event, session } }));
});

export { supabase };
export default supabase;