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
    detectSessionInUrl: true, // Để Supabase tự xử lý OAuth callback
    flowType: 'implicit' // Explicit về flow type
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

// ✅ Kiểm tra session (bước lấy dữ liệu)
(async function restoreSessionAndNotify() {
    // Đợi Supabase xử lý OAuth callback tự động (nếu có)
    await new Promise(resolve => setTimeout(resolve, 500));
    
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