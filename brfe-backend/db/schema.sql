-- BRFE App System — Database Schema
-- Bago Residents Flood Evacuees App
-- MySQL DDL — run in order (barangays first, then tables with FK references)

SET FOREIGN_KEY_CHECKS = 1;

-- ─────────────────────────────────────────────
-- 1. barangays
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS barangays (
    id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name      VARCHAR(100) NOT NULL UNIQUE,
    latitude  DECIMAL(9,7),
    longitude DECIMAL(10,7)
);

-- ─────────────────────────────────────────────
-- 2. users  (evacuees)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name     VARCHAR(255) NOT NULL,
    username      VARCHAR(50) NOT NULL UNIQUE,
    email         VARCHAR(255) UNIQUE DEFAULT NULL,
    age           TINYINT UNSIGNED NOT NULL,
    address       VARCHAR(500) NOT NULL,
    barangay_id   INT UNSIGNED NOT NULL,
    contact_no    VARCHAR(20) NOT NULL UNIQUE,
    emerg_name    VARCHAR(255) NOT NULL,
    emerg_no      VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status        ENUM('Safe','Need_Assistance','In_Danger') NOT NULL DEFAULT 'Safe',
    token_hash    VARCHAR(255),
    avatar_path   VARCHAR(500) DEFAULT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (barangay_id) REFERENCES barangays(id)
);

-- ─────────────────────────────────────────────
-- 3. lgu_accounts  (LGU_Admin and Barangay_Official)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lgu_accounts (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('LGU_Admin','Barangay_Official') NOT NULL,
    barangay_id   INT UNSIGNED,  -- NULL = all-access (LGU_Admin)
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (barangay_id) REFERENCES barangays(id)
);

-- ─────────────────────────────────────────────
-- 4. locations  (latest GPS position per user — one row per user, upserted)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL UNIQUE,  -- one row per user
    lat         DECIMAL(10,7) NOT NULL,
    lng         DECIMAL(10,7) NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ─────────────────────────────────────────────
-- 5. status_updates  (audit log of status changes)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS status_updates (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED NOT NULL,
    status     ENUM('Safe','Need_Assistance','In_Danger') NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ─────────────────────────────────────────────
-- 6. reports  (disaster / flood reports)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      INT UNSIGNED NOT NULL,
    flood_level  ENUM('Low','Moderate','High','Critical') NOT NULL,
    description  TEXT NOT NULL,
    photo_path   VARCHAR(500),
    lat          DECIMAL(10,7) NOT NULL,
    lng          DECIMAL(10,7) NOT NULL,
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ─────────────────────────────────────────────
-- 7. rescue_requests
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rescue_requests (
    id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id           INT UNSIGNED NOT NULL,
    lat               DECIMAL(10,7) NOT NULL,
    lng               DECIMAL(10,7) NOT NULL,
    status_at_request ENUM('Safe','Need_Assistance','In_Danger') NOT NULL,
    req_status        ENUM('Pending','Ongoing','Completed') NOT NULL DEFAULT 'Pending',
    responder_id      INT UNSIGNED,
    requested_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at      TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (responder_id) REFERENCES lgu_accounts(id)
);

-- ─────────────────────────────────────────────
-- 8. evacuation_centers
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evacuation_centers (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    address      VARCHAR(500) NOT NULL,
    lat          DECIMAL(10,7) NOT NULL,
    lng          DECIMAL(10,7) NOT NULL,
    max_capacity INT UNSIGNED NOT NULL,
    occupancy    INT UNSIGNED NOT NULL DEFAULT 0,
    op_status    ENUM('Open','Full','Closed') NOT NULL DEFAULT 'Open',
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_occupancy CHECK (occupancy <= max_capacity)
);

-- ─────────────────────────────────────────────
-- 9. chat_messages
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
    id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sender_type    ENUM('evacuee','lgu') NOT NULL,
    sender_id      INT UNSIGNED NOT NULL,
    recipient_type ENUM('evacuee','lgu','broadcast') NOT NULL,
    recipient_id   INT UNSIGNED,  -- NULL for broadcast
    body           TEXT NOT NULL,
    sent_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at   TIMESTAMP NULL DEFAULT NULL
);
