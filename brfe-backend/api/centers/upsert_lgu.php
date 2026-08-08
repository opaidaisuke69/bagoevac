<?php
/**
 * POST /api/centers/upsert_lgu — Create or update an evacuation center (LGU session auth).
 * Body: { id?, name, address, latitude, longitude, max_capacity, occupancy, op_status }
 * id present → update; id absent → create (LGU_Admin only).
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/lgu_auth.php';
require_once __DIR__ . '/../../services/BroadcastService.php';

header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }
requireLguAuth();

$user = $GLOBALS['lgu_user'];
$body = json_decode(file_get_contents('php://input'), true) ?? [];

$id          = isset($body['id']) ? (int)$body['id'] : 0;
$name        = trim($body['name']        ?? '');
$address     = trim($body['address']     ?? '');
$lat         = isset($body['latitude'])  ? (float)$body['latitude']  : null;
$lng         = isset($body['longitude']) ? (float)$body['longitude'] : null;
$maxCap      = isset($body['max_capacity']) ? (int)$body['max_capacity'] : null;
$occupancy   = isset($body['occupancy'])    ? (int)$body['occupancy']    : null;
$opStatus    = trim($body['op_status']   ?? '');
$barangayId  = isset($body['barangay_id']) && $body['barangay_id'] !== '' ? (int)$body['barangay_id'] : null;

$validStatuses = ['Open', 'Full', 'Closed'];
$errors = [];
if ($name === '')                                    $errors['name']         = 'Name is required.';
if ($address === '')                                 $errors['address']      = 'Address is required.';
if ($lat === null)                                   $errors['latitude']     = 'Latitude is required.';
if ($lng === null)                                   $errors['longitude']    = 'Longitude is required.';
if ($maxCap === null || $maxCap < 1)                 $errors['max_capacity'] = 'Max capacity must be ≥ 1.';
if ($occupancy === null || $occupancy < 0)           $errors['occupancy']    = 'Occupancy must be ≥ 0.';
if (!in_array($opStatus, $validStatuses, true))      $errors['op_status']    = 'op_status must be Open, Full, or Closed.';
if (!empty($errors)) errorValidation($errors);

if ($occupancy > $maxCap) errorCapacityExceeded();

$pdo = Database::getInstance();

if ($id > 0) {
    // Update
    $pdo->prepare(
        'UPDATE evacuation_centers SET name=?, address=?, lat=?, lng=?, max_capacity=?, occupancy=?, op_status=?, barangay_id=? WHERE id=?'
    )->execute([$name, $address, $lat, $lng, $maxCap, $occupancy, $opStatus, $barangayId, $id]);
} else {
    // Create — LGU_Admin only
    if ($user['role'] !== 'LGU_Admin') errorForbidden();
    $stmt = $pdo->prepare(
        'INSERT INTO evacuation_centers (name, address, lat, lng, max_capacity, occupancy, op_status, barangay_id) VALUES (?,?,?,?,?,?,?,?)'
    );
    $stmt->execute([$name, $address, $lat, $lng, $maxCap, $occupancy, $opStatus, $barangayId]);
    $id = (int)$pdo->lastInsertId();
}

broadcastEvent(['type' => 'center_update', 'id' => $id, 'op_status' => $opStatus, 'occupancy' => $occupancy, 'ts' => gmdate('c')]);

jsonSuccess(['id' => $id, 'op_status' => $opStatus, 'occupancy' => $occupancy]);
