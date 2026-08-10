-- Add password salt columns for SHA-256 + salt password hashing
ALTER TABLE address ADD COLUMN password_salt TEXT;
ALTER TABLE users ADD COLUMN password_salt TEXT;
