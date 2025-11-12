# Hướng dẫn cấu hình Email Templates trong Supabase

## Bước 1: Whitelist Redirect URLs

Vào **Supabase Dashboard** → Project của bạn → **Authentication** → **URL Configuration**

Thêm các URLs sau vào **Redirect URLs**:
```
https://manhnd395.github.io/manh-music/
https://manhnd395.github.io/manh-music/index.html
https://manhnd395.github.io/manh-music/player.html
```

**Site URL** (nếu chưa set):
```
https://manhnd395.github.io/manh-music/
```

---

## Bước 2: Customize Email Templates

Vào **Authentication** → **Email Templates**

### 2.1 Confirm Signup Template

Chọn **"Confirm signup"** template, thay đổi nội dung:

```html
<h2>Chào mừng đến với ManhMusic! 🎵</h2>

<p>Xin chào {{ .Email }},</p>

<p>Cảm ơn bạn đã đăng ký tài khoản ManhMusic. Vui lòng xác nhận email của bạn bằng cách click vào nút bên dưới:</p>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{ .ConfirmationURL }}" 
     style="background-color: #1db954; 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 25px;
            font-weight: bold;
            display: inline-block;">
    Xác nhận Email
  </a>
</p>

<p>Hoặc copy link sau vào trình duyệt:</p>
<p style="word-break: break-all; color: #666;">{{ .ConfirmationURL }}</p>

<p><strong>Lưu ý:</strong> Link này sẽ hết hạn sau 24 giờ.</p>

<hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />

<p style="color: #999; font-size: 12px;">
  Nếu bạn không đăng ký tài khoản ManhMusic, vui lòng bỏ qua email này.
</p>

<p style="color: #999; font-size: 12px;">
  © 2025 ManhMusic. All rights reserved.
</p>
```

**Subject line:**
```
Xác nhận email của bạn - ManhMusic 🎵
```

### 2.2 Magic Link Template (nếu dùng)

Chọn **"Magic Link"** template:

```html
<h2>Đăng nhập vào ManhMusic 🎵</h2>

<p>Xin chào,</p>

<p>Click vào nút bên dưới để đăng nhập vào tài khoản ManhMusic của bạn:</p>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{ .Token }}" 
     style="background-color: #1db954; 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 25px;
            font-weight: bold;
            display: inline-block;">
    Đăng nhập ngay
  </a>
</p>

<p>Hoặc copy link sau:</p>
<p style="word-break: break-all; color: #666;">{{ .Token }}</p>

<p><strong>Lưu ý:</strong> Link này chỉ sử dụng được 1 lần và hết hạn sau 1 giờ.</p>

<hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />

<p style="color: #999; font-size: 12px;">
  Nếu bạn không yêu cầu đăng nhập, vui lòng bỏ qua email này.
</p>
```

**Subject:**
```
Magic Link đăng nhập - ManhMusic 🎵
```

### 2.3 Reset Password Template

```html
<h2>Đặt lại mật khẩu ManhMusic 🔒</h2>

<p>Xin chào,</p>

<p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản ManhMusic. Click vào nút bên dưới:</p>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{ .ConfirmationURL }}" 
     style="background-color: #e74c3c; 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 25px;
            font-weight: bold;
            display: inline-block;">
    Đặt lại mật khẩu
  </a>
</p>

<p>Link hết hạn sau 1 giờ.</p>

<p style="color: #999; font-size: 12px;">
  Nếu bạn không yêu cầu đặt lại mật khẩu, có thể ai đó đã cố truy cập tài khoản của bạn. 
  Vui lòng bảo mật thông tin cá nhân.
</p>
```

**Subject:**
```
Đặt lại mật khẩu - ManhMusic 🔒
```

---

## Bước 3: Cấu hình SMTP (Tùy chọn - Nâng cao)

Nếu muốn gửi email từ domain riêng thay vì Supabase's default:

Vào **Project Settings** → **Auth** → **SMTP Settings**

Configure với:
- **Gmail**: Dùng App Password
- **SendGrid**, **Mailgun**, **AWS SES**, etc.

Example Gmail SMTP:
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP User: your-email@gmail.com
SMTP Password: [App Password - tạo từ Google Account Security]
SMTP Sender Name: ManhMusic
SMTP Sender Email: your-email@gmail.com
```

---

## Bước 4: Test

1. Đăng ký tài khoản mới
2. Check email inbox (và spam folder)
3. Click link xác nhận
4. Verify redirect về đúng `/manh-music/index.html`

---

## Troubleshooting

### Vấn đề: Email không đến

- Check **spam folder**
- Verify SMTP settings nếu dùng custom SMTP
- Check Supabase logs: Dashboard → Logs → Auth logs

### Vấn đề: Link redirect sai (404)

- Verify **Redirect URLs** đã được thêm đúng
- Check **Site URL** trong Auth settings
- Ensure `emailRedirectTo` trong code match với whitelist URLs

### Vấn đề: "otp_expired" error

- Link đã quá 24h → Yêu cầu gửi lại email
- Hoặc link đã được sử dụng rồi → Đăng ký/reset password lại

---

## Best Practices

1. **Always whitelist** production URLs trước khi deploy
2. **Test email flow** trong staging environment
3. **Monitor auth logs** để catch errors sớm
4. **Customize templates** để match brand identity
5. **Set clear expiry times** và communicate với users

