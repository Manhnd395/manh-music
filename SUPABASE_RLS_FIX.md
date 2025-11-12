# Fix Supabase Users Table RLS Policy

## Vấn đề hiện tại

Khi signup, có lỗi 400 khi insert vào `users` table:
```
Failed to load resource: the server responded with a status of 400
Upsert users error: Object
```

## Nguyên nhân

RLS (Row Level Security) policy không cho phép user mới tạo insert vào `users` table.

## Giải pháp

### Bước 1: Vào Supabase SQL Editor

Vào **Supabase Dashboard** → Your Project → **SQL Editor**

### Bước 2: Chạy SQL Commands sau

#### 2.1 Enable RLS (nếu chưa enable)

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

#### 2.2 Tạo Policy cho INSERT (signup)

```sql
-- Policy: Cho phép user mới tạo insert record của chính họ
CREATE POLICY "Users can insert their own record on signup"
ON users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);
```

#### 2.3 Tạo Policy cho SELECT (read)

```sql
-- Policy: Cho phép mọi authenticated user đọc thông tin users (cần cho app features)
CREATE POLICY "Authenticated users can read all users"
ON users
FOR SELECT
TO authenticated
USING (true);
```

#### 2.4 Tạo Policy cho UPDATE (profile edit)

```sql
-- Policy: User chỉ có thể update profile của chính họ
CREATE POLICY "Users can update their own profile"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
```

#### 2.5 Tạo Policy cho DELETE (nếu cần)

```sql
-- Policy: User có thể delete account của chính họ
CREATE POLICY "Users can delete their own account"
ON users
FOR DELETE
TO authenticated
USING (auth.uid() = id);
```

### Bước 3: Verify Policies

Chạy query này để xem tất cả policies:

```sql
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'users';
```

### Bước 4: Test

1. Đăng ký tài khoản mới
2. Check console logs - không còn lỗi 400
3. Verify record được tạo trong `users` table

---

## Alternative: Disable RLS (NOT RECOMMENDED for production)

Nếu chỉ test local/dev, có thể tạm disable RLS:

```sql
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

**⚠️ Warning:** Không nên disable RLS trong production vì bất kỳ ai cũng có thể read/write table!

---

## Best Practices

1. **Always enable RLS** trong production
2. **Principle of least privilege**: User chỉ access được data của họ
3. **Test policies thoroughly** trước khi deploy
4. **Document policies** để team hiểu logic
5. **Review policies regularly** khi thêm features mới

---

## Schema Reference

Đảm bảo `users` table có đúng columns:

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    birthday DATE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Troubleshooting

### Lỗi: "new row violates row-level security policy"

→ Check WITH CHECK clause trong INSERT policy

### Lỗi: "permission denied for table users"

→ RLS đang enabled nhưng không có policy nào match

### User không thấy data của người khác

→ Check SELECT policy - có thể cần `USING (true)` để cho phép read all

### Policy không apply

→ Clear cache, refresh, hoặc reconnect Supabase client

