<?php
require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    exit;
}

requireAuth();

$auth = $GLOBALS['auth_user'];

// ── Auth: evacuee or LGU roles ────────────────────────────────────────────────

$role         = $auth['role'] ?? '';
$allowedRoles = ['evacuee', 'LGU_Admin', 'Barangay_Official'];

if (!in_array($role, $allowedRoles, true)) {
    errorForbidden();
}

// ── Fetch all evacuation centers ──────────────────────────────────────────────

$pdo  = Database::getInstance();
$stmt = $pdo->query(
    'SELECT id, name, address, lat, lng, max_capacity, occupancy, op_status, updated_at
     FROM evacuation_centers
     ORDER BY name ASC'
);
$centers = $stmt->fetchAll();

// ── Cast numeric fields ───────────────────────────────────────────────────────

foreach ($centers as &$c) {
    $c['id']           = (int)$c['id'];
    $c['lat']          = (float)$c['lat'];
    $c['lng']          = (float)$c['lng'];
    $c['max_capacity'] = (int)$c['max_capacity'];
    $c['occupancy']    = (int)$c['occupancy'];
}
unset($c);

jsonSuccess(['evacuation_centers' => $centers]);
