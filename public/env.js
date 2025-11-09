// public/env.js
(() => {
  window.SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  window.SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  window.GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

  console.log('ENV INJECTED:', {
    supabase_url: !!window.SUPABASE_URL,
    supabase_key: window.SUPABASE_ANON_KEY?.length || 0,
    groq_key: window.GROQ_API_KEY?.length || 0,
  });

  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY || !window.GROQ_API_KEY) {
    console.error('MISSING CONFIG! Check GitHub Secrets.');
  }
})();