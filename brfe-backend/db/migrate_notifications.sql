-- Migration: add notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED NOT NULL,
    type       VARCHAR(50) NOT NULL,          -- e.g. rescue_ongoing, rescue_completed, status_safe
    title      VARCHAR(255) NOT NULL,
    body       TEXT NOT NULL,
    data       JSON DEFAULT NULL,             -- extra payload (rescue_id, etc.)
    is_read    TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
