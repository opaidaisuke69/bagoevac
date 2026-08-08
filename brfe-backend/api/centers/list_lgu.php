<?php
/** GET /api/centers/list_lgu — List evacuation centers (LGU session auth). */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/lgu_auth.php';

header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); exit; }
requireLguAuth();

$pdo  = Database::getInstance();
$rows = $pdo->query(
    'SELECT id, name, address, lat AS latitude, lng AS longitude,
            max_capacity, occupancy, op_status, barangay_id, updated_at
     FROM evacuation_centers ORDER BY name ASC'
)->fetchAll();

foreach ($rows as &$c) {
    $c['id']           = (int)$c['id'];
    $c['latitude']     = (float)$c['latitude'];
    $c['longitude']    = (float)$c['longitude'];
    $c['max_capacity'] = (int)$c['max_capacity'];
    $c['occupancy']    = (int)$c['occupancy'];
    $c['barangay_id']  = $c['barangay_id'] !== null ? (int)$c['barangay_id'] : null;
}
unset($c);

jsonSuccess(['data' => $rows]);
