-- ============================================
-- Migration 016: Force Password Change on First Login
-- ============================================
-- Adds must_change_password flag to users table.
-- New users start with must_change_password = 1 (true).
-- After the user changes their password, the flag is reset to 0.
-- On login, the frontend checks this flag and forces a password change.

ALTER TABLE users
  ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 1
    AFTER status,
    COMMENT 'When 1, the user must change their password on next login';

-- Existing users should not be forced to change password (backward compatibility)
UPDATE users SET must_change_password = 0;

-- Add index for efficient lookups
CREATE INDEX idx_users_must_change_password ON users(must_change_password);
