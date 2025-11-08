// public/env.js
// ⚙️ Tự động inject env từ Vite vào window (chạy trước client.js)
(function () {
  const env = {
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    GROQ_API_KEY: import.meta.env.VITE_GROQ_API_KEY,
  };

  // Gán vào window
  window.SUPABASE_URL = env.SUPABASE_URL;
  window.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
  window.GROQ_API_KEY = env.GROQ_API_KEY;

  // Debug local
  if (window.location.hostname === 'localhost') {
    console.log('ENV INJECTED:', {
      SUPABASE_URL: env.SUPABASE_URL,
      ANON_KEY: env.SUPABASE_ANON_KEY?.length > 20 ? 'OK' : 'TOO SHORT',
    });
  }
})();