-- ─────────────────────────────────────────────────────────────────────────────
-- Email verification + password reset (OTP codes)
--
-- Adds:
--   • users.email_verified flag
--   • email_verifications table — one active code per (email, purpose)
--
-- Purposes:
--   'register'       — verify an email before an account is created
--   'password_reset' — verify ownership before resetting a password
--
-- Codes are stored HASHED (SHA-256), never in plaintext. A row is upserted per
-- (email, purpose); resending overwrites the previous code.
-- Run:  mysql -u root brfe_db < migrate_email_verification.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Mark whether a user's email has been verified.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER email;

-- 2. OTP store.
CREATE TABLE IF NOT EXISTS email_verifications (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    purpose     ENUM('register','password_reset') NOT NULL DEFAULT 'register',
    code_hash   CHAR(64) NOT NULL,               -- SHA-256 of the 6-digit code
    attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
    expires_at  DATETIME NOT NULL,
    last_sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_email_purpose (email, purpose),
    KEY idx_expires (expires_at)
);
