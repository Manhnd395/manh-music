// public/env.js
(() => {
  window.SUPABASE_URL = '__VITE_SUPABASE_URL__';
  window.SUPABASE_ANON_KEY = '__VITE_SUPABASE_ANON_KEY__';
  window.GROQ_API_KEY = '__VITE_GROQ_API_KEY__';

  console.log('ENV INJECTED:', {
    url: window.SUPABASE_URL,
    keyLength: window.SUPABASE_ANON_KEY?.length || 0,
  });

  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    console.error('MISSING SUPABASE CONFIG!');
  }
})();