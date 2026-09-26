<?php
/**
 * GET /api/system/status — public system status for the mobile app.
 *
 * No auth required so the app can check it at the login screen and while
 * a session is active. Returns whether the system is shut down (maintenance).
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../services/SettingsService.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); exit; }

$down = SettingsService::isMaintenance();

jsonSuccess([
    'maintenance_mode' => $down,
    'online'           => !$down,
    'message'          => $down
        ? 'The system is temporarily shut down by the LGU administrator. Please try again later.'
        : 'System is online.',
]);
