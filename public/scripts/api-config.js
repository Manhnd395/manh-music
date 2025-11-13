// API Configuration và Setup Guide

/* 
HƯỚNG DẪN CẤU HÌNH API KEYS:

1. GROQ API (AI Chat):
   - Đăng ký tại: https://console.groq.com/
   - Tạo API key mới  
   - Thêm vào env.js: window.GROQ_API_KEY = 'your-actual-groq-api-key';
   - Model được dùng: llama3-8b-8192 (nhanh và ổn định)

2. Genius API (Lyrics): 
   - Đăng ký tại: https://genius.com/api-clients
   - Tạo Client Access Token
   - Key đã được hardcode trong ui.js (có thể thay đổi nếu cần)

CÁCH KIỂM TRA:
- Mở Developer Tools (F12)
- Kiểm tra Console log khi test AI chat hoặc lyrics
- Tìm các log "✅" cho success hoặc "❌" cho errors

TROUBLESHOOTING:
- 401/403 errors: API key không đúng
- 429 errors: Hết quota, đợi hoặc dùng key khác
- Timeout: Network chậm, sẽ fallback tự động
- CORS: Đã setup proxy, không cần lo

STATUS HIỆN TẠI:
✅ Error handling đã được cải thiện
✅ Multiple fallback proxy cho Genius 
✅ Timeout protection (8-10s)
✅ User-friendly error messages bằng tiếng Việt
✅ Caching để tránh spam requests
*/

// Test API availability
async function testAPIs() {
    console.log('🧪 Testing API configurations...');
    
    // Test GROQ
    const groqKey = window.GROQ_API_KEY;
    if (groqKey && groqKey !== '__VITE_GROQ_API_KEY__' && groqKey.length > 10) {
        console.log('✅ GROQ API key looks valid');
    } else {
        console.warn('⚠️ GROQ API key not configured properly');
    }
    
    // Test Genius (via proxy)
    try {
        const testUrl = 'https://corsproxy.io/?' + encodeURIComponent('https://api.genius.com/search?q=test');
        const response = await fetch(testUrl);
        if (response.ok) {
            console.log('✅ Genius proxy accessible');
        } else {
            console.warn('⚠️ Genius proxy may have issues');
        }
    } catch (e) {
        console.warn('⚠️ Genius proxy test failed:', e.message);
    }
}

// Auto-run test on load
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', testAPIs);
}