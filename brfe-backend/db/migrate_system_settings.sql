-- System settings: simple key/value store for global flags (e.g. maintenance mode).
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key   VARCHAR(64) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL,
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Maintenance / shutdown mode. '0' = system online, '1' = shut down
-- (only Barangay_Official and LGU_Admin may log in).
INSERT INTO system_settings (setting_key, setting_value)
VALUES ('maintenance_mode', '0')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
