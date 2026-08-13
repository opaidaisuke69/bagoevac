-- ══════════════════════════════════════════════════════════════════════════════
-- BRFE App System — Full Database Schema + Migrations + Seed
-- Bago Residents Flood Evacuees App
-- 
-- Run this ONCE on a fresh database to set everything up.
-- ══════════════════════════════════════════════════════════════════════════════

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
-- 2. users (evacuees)
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
-- 3. lgu_accounts (LGU_Admin and Barangay_Official)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lgu_accounts (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('LGU_Admin','Barangay_Official','Rescuer') NOT NULL,
    barangay_id   INT UNSIGNED,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (barangay_id) REFERENCES barangays(id)
);

-- ─────────────────────────────────────────────
-- 4. locations (one row per user, upserted)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    lat         DECIMAL(10,7) NOT NULL,
    lng         DECIMAL(10,7) NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_locations_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ─────────────────────────────────────────────
-- 5. status_updates (audit log of status changes)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS status_updates (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED NOT NULL,
    status     ENUM('Safe','Need_Assistance','In_Danger') NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ─────────────────────────────────────────────
-- 6. reports (disaster / flood reports)
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
-- 8. evacuation_centers (includes barangay_id from migration)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evacuation_centers (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    address      VARCHAR(500) NOT NULL,
    barangay_id  INT UNSIGNED NULL,
    lat          DECIMAL(10,7) NOT NULL,
    lng          DECIMAL(10,7) NOT NULL,
    max_capacity INT UNSIGNED NOT NULL,
    occupancy    INT UNSIGNED NOT NULL DEFAULT 0,
    op_status    ENUM('Open','Full','Closed') NOT NULL DEFAULT 'Open',
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_occupancy CHECK (occupancy <= max_capacity),
    CONSTRAINT fk_centers_barangay FOREIGN KEY (barangay_id) REFERENCES barangays(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────
-- 9. chat_messages (includes v2 columns: msg_type, expires_at, barangay_id)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
    id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sender_type    ENUM('evacuee','lgu') NOT NULL,
    sender_id      INT UNSIGNED NOT NULL,
    recipient_type ENUM('evacuee','lgu','broadcast') NOT NULL,
    recipient_id   INT UNSIGNED,
    body           TEXT NOT NULL,
    msg_type       ENUM('chat','broadcast','announcement') NOT NULL DEFAULT 'chat',
    expires_at     TIMESTAMP NULL DEFAULT NULL,
    barangay_id    INT UNSIGNED DEFAULT NULL,
    sent_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at   TIMESTAMP NULL DEFAULT NULL
);

-- ─────────────────────────────────────────────
-- 10. notifications
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED NOT NULL,
    type       VARCHAR(50) NOT NULL,
    title      VARCHAR(255) NOT NULL,
    body       TEXT NOT NULL,
    data       JSON DEFAULT NULL,
    is_read    TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);


-- ══════════════════════════════════════════════════════════════════════════════
-- SEED DATA
-- ══════════════════════════════════════════════════════════════════════════════

-- 24 Barangays of Bago City, Negros Occidental
INSERT INTO barangays (name, latitude, longitude) VALUES
    ('Abuanan',              10.5254, 122.9915),
    ('Alianza',              10.4734, 122.9301),
    ('Atipuluan',            10.5109, 122.9564),
    ('Bacong-Montilla',      10.5190, 123.0351),
    ('Bagroy',               10.4761, 122.8738),
    ('Balingasag',           10.5309, 122.8440),
    ('Binubuhan',            10.4566, 123.0083),
    ('Busay',                10.5372, 122.8847),
    ('Calumangan',           10.5598, 122.8765),
    ('Caridad',              10.4812, 122.9084),
    ('Dulao',                10.5482, 122.9537),
    ('Ilijan',               10.4526, 123.0553),
    ('Lag-Asan',             10.5233, 122.8395),
    ('Ma-ao Barrio',         10.4896, 122.9897),
    ('Jorge L. Araneta',     10.4765, 122.9466),
    ('Mailum',               10.4618, 123.0493),
    ('Malingin',             10.4933, 122.9175),
    ('Napoles',              10.5128, 122.8980),
    ('Pacol',                10.4953, 122.8672),
    ('Poblacion',            10.5381, 122.8359),
    ('Sagasa',               10.4709, 122.8924),
    ('Sampinit',             10.5428, 122.8515),
    ('Tabunan',              10.5739, 122.9393),
    ('Taloc',                10.5716, 122.9119);

-- Default LGU Admin account
-- Username: admin | Password: Admin@1234
INSERT INTO lgu_accounts (username, password_hash, role, barangay_id) VALUES
    (
        'admin',
        '$2y$12$iirMiXeqi0uTU995HqWvb.prRi.X9cgmTO7aqRrXPSR8.vNea8YiO',
        'LGU_Admin',
        NULL
    );

-- Sample Barangay Official account
-- Username: brgy_poblacion | Password: Brgy@1234
-- Assigned to Poblacion (barangay_id = 20)
INSERT INTO lgu_accounts (username, password_hash, role, barangay_id) VALUES
    (
        'brgy_poblacion',
        '$2y$10$MmjoRkF8Nzo40xn0w14nr.Qafeu4W7Jr/UVHiYub6C85/1kQAEjDm',
        'Barangay_Official',
        20
    );
