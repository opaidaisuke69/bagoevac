<?php
/**
 * GET  /api/lgu/settings           — read system settings (any LGU role)
 * POST /api/lgu/settings           — update settings (LGU_Admin only)
 *   Body: { "maintenance_mode": true|false }
 *
 * maintenance_mode = shutdown: when ON, only Barangay_Official and LGU_Admin
 * may log in; evacuees and rescuers are blocked.
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/lgu_auth.php';
require_once __DIR__ . '/../../services/SettingsService.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

requireLguAuth();
$lguUser = $GLOBALS['lgu_user'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    jsonSuccess([
        'maintenance_mode' => SettingsService::isMaintenance(),
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Only the LGU_Admin can shut down / bring back the system.
    if (($lguUser['role'] ?? '') !== 'LGU_Admin') {
        errorForbidden();
    }

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    if (array_key_exists('maintenance_mode', $body)) {
        $on = filter_var($body['maintenance_mode'], FILTER_VALIDATE_BOOLEAN);
        SettingsService::set('maintenance_mode', $on ? '1' : '0');
    }

    jsonSuccess([
        'maintenance_mode' => SettingsService::isMaintenance(),
    ]);
}

http_response_code(405);
exit;
