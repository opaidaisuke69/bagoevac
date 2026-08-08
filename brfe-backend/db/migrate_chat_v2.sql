-- Migration: chat_messages v2 — add msg_type, expires_at, barangay_id
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS msg_type   ENUM('chat','broadcast','announcement') NOT NULL DEFAULT 'chat' AFTER body,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP NULL DEFAULT NULL AFTER msg_type,
  ADD COLUMN IF NOT EXISTS barangay_id INT UNSIGNED DEFAULT NULL AFTER expires_at;
