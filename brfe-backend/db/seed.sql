-- BRFE App System — Seed Data
-- Bago Residents Flood Evacuees App
-- Coordinates sourced from PhilAtlas (philatlas.com)

-- ─────────────────────────────────────────────
-- 24 Barangays of Bago City, Negros Occidental
-- ─────────────────────────────────────────────
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
    ('Don Jorge L. Araneta', 10.4765, 122.9466),
    ('Dulao',                10.5482, 122.9537),
    ('Ilijan',               10.4526, 123.0553),
    ('Lag-asan',             10.5233, 122.8395),
    ('Ma-ao',                10.4896, 122.9897),
    ('Mailum',               10.4618, 123.0493),
    ('Malingin',             10.4933, 122.9175),
    ('Napoles',              10.5128, 122.8980),
    ('Pacol',                10.4953, 122.8672),
    ('Poblacion',            10.5381, 122.8359),
    ('Rizal',                10.4709, 122.8924),
    ('Sampinit',             10.5428, 122.8515),
    ('Tabunan',              10.5739, 122.9393),
    ('Taloc',                10.5716, 122.9119);

-- ─────────────────────────────────────────────
-- LGU Admin account
-- Username : admin
-- Password : Admin@1234  (bcrypt hash below)
-- Role     : LGU_Admin   (barangay_id = NULL → all-access)
--
-- To regenerate the hash in PHP:
--   echo password_hash('Admin@1234', PASSWORD_BCRYPT);
-- ─────────────────────────────────────────────
INSERT INTO lgu_accounts (username, password_hash, role, barangay_id) VALUES
    (
        'admin',
        '$2y$12$iirMiXeqi0uTU995HqWvb.prRi.X9cgmTO7aqRrXPSR8.vNea8YiO',
        'LGU_Admin',
        NULL
    );
