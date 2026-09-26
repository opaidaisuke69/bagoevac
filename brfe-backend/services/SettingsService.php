<?php
/**
 * SettingsService — read/write global key/value flags in system_settings.
 * Fails safe: if the table is missing or a read errors, treats the value as absent.
 */

require_once __DIR__ . '/../config/database.php';

class SettingsService
{
    public static function get(string $key, ?string $default = null): ?string
    {
        try {
            $pdo  = Database::getInstance();
            $stmt = $pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1');
            $stmt->execute([$key]);
            $row = $stmt->fetch();
            return $row ? (string)$row['setting_value'] : $default;
        } catch (\Throwable $e) {
            return $default;
        }
    }

    public static function set(string $key, string $value): void
    {
        $pdo = Database::getInstance();
        $stmt = $pdo->prepare(
            'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
        );
        $stmt->execute([$key, $value]);
    }

    public static function isMaintenance(): bool
    {
        return self::get('maintenance_mode', '0') === '1';
    }
}
