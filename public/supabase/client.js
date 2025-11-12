// public/supabase/client.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

console.log('📦 client.js loaded - initializing Supabase client');

const supabaseUrl = window.SUPABASE_URL;
const supabaseAnonKey = window.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase config missing');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true, // Re-enable this, it's the correct way.
    flowType: 'implicit'
  }
});window.supabase = supabase;
export default supabase;
window.dispatchEvent(new Event('SUPABASE_CLIENT_READY'));

// This IIFE (Immediately Invoked Function Expression) runs on script load.
// Its only job is to get the session from the SDK and announce it.
(async () => {
    console.log('Client.js: Attempting to get session from SDK...');
    // getSession() with detectSessionInUrl:true handles OAuth callbacks AND localStorage.
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        console.error('Client.js: Error getting session:', error);
        return;
    }

    if (session) {
        console.log(`✅ Client.js: Session restored for ${session.user.email}.`);
        window.currentUser = session.user;
        // Dispatch one clear event that the session is ready.
        document.dispatchEvent(new CustomEvent('SUPABASE_SESSION_RESTORED', {
            detail: { session, source: 'SDK' }
        }));
    } else {
        console.log('ℹ️ Client.js: No active session found by SDK.');
        // Also dispatch, so other scripts know there is no session.
         document.dispatchEvent(new CustomEvent('SUPABASE_SESSION_RESTORED', {
            detail: { session: null, source: 'SDK' }
        }));
    }

    // Clean up URL after the SDK has processed it.
    const url = new URL(window.location.href);
    if (url.hash.includes('access_token') || url.searchParams.has('code')) {
        console.log('🧹 Client.js: Cleaning OAuth params from URL.');
        // Use replaceState to avoid adding to browser history
        window.history.replaceState({}, document.title, url.pathname);
    }
})();