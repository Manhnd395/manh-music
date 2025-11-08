// public/env.js
// Inject env từ Vite vào window — HOẠT ĐỘNG TRÊN LOCAL + NETLIFY
(() => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const groq = import.meta.env.VITE_GROQ_API_KEY;

  // GÁN LUÔN — KHÔNG ĐIỀU KIỆN
  window.SUPABASE_URL = url;
  window.SUPABASE_ANON_KEY = key;
  window.GROQ_API_KEY = groq;

  // DEBUG CHO CẢ NETLIFY (tạm thời)
  console.log('ENV INJECTED:', {
    SUPABASE_URL: url,
    ANON_KEY_LENGTH: key?.length || 0,
    GROQ_OK: !!groq
  });

  // Cảnh báo nếu thiếu
  if (!url || !key) {
    console.error('MISSING SUPABASE CONFIG!', { url, key });
  }
})();