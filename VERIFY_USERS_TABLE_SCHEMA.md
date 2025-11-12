# Verify Users Table Schema

## ✅ Required Columns in `users` table

Vào **Supabase Dashboard** → **Table Editor** → `users` table

Đảm bảo có đủ các columns sau:

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `uuid` | Primary Key, References `auth.users(id) ON DELETE CASCADE` | - |
| `email` | `text` | UNIQUE, NOT NULL | - |
| `username` | `text` | UNIQUE, NOT NULL | - |
| `birthday` | `date` | NULL | - |
| `avatar_url` | `text` | NULL | - |
| `created_at` | `timestamptz` | NOT NULL | `NOW()` |
| `updated_at` | `timestamptz` | NOT NULL | `NOW()` |

---

## 🔧 SQL để tạo/verify table

Nếu chưa có table hoặc thiếu columns, chạy SQL này:

```sql
-- Create users table nếu chưa có
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    birthday DATE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies nếu có (để recreate clean)
DROP POLICY IF EXISTS "Users can insert their own record on signup" ON users;
DROP POLICY IF EXISTS "Authenticated users can read all users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can delete their own account" ON users;

-- Policy INSERT (cho signup)
CREATE POLICY "Users can insert their own record on signup"
ON users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Policy SELECT (read all users)
CREATE POLICY "Authenticated users can read all users"
ON users
FOR SELECT
TO authenticated
USING (true);

-- Policy UPDATE (edit own profile)
CREATE POLICY "Users can update their own profile"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy DELETE (delete own account)
CREATE POLICY "Users can delete their own account"
ON users
FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- Create indexes cho performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
```

---

## 🧪 Test Insert

Sau khi chạy SQL trên, test insert thủ công:

```sql
-- Test insert (replace với user ID thật từ auth.users)
INSERT INTO users (id, email, username, birthday, avatar_url, created_at, updated_at)
VALUES (
  'YOUR_USER_ID_HERE',
  'test@example.com',
  'test_user',
  '2000-01-01',
  'https://lezswjtnlsmznkgrzgmu.supabase.co/storage/v1/object/public/cover/449bd474-7a51-4c22-b4a4-2ad8736d6fad/default-avatar.png',
  NOW(),
  NOW()
);
```

Nếu insert thành công → Schema và policies OK ✅

---

## 📝 Next Steps

1. Chạy SQL verify/create table + policies
2. Test signup với account mới
3. Check Table Editor - verify record được tạo
4. Check console logs cho detailed errors nếu fail

