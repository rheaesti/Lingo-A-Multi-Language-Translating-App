-- Database Migration Script
-- Add password column to users table

-- Add password column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);

-- Update existing users with a default password (you should change this in production)
-- This is just for existing users who don't have passwords yet
UPDATE users 
SET password = '$2b$10$default.hash.for.existing.users' 
WHERE password IS NULL;

-- Make password column NOT NULL after setting default values
ALTER TABLE users ALTER COLUMN password SET NOT NULL;

-- Add index on password column for faster lookups (optional)
CREATE INDEX IF NOT EXISTS idx_users_password ON users(password);

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;
