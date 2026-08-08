<?php
require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../services/BroadcastService.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    exit;
}

requireAuth();

$auth = $GLOBALS['auth_user'];

// ── LGU roles only (LGU_Admin or Barangay_Official) ──────────────────────────

$role     = $auth['role'] ?? '';
$lguRoles = ['LGU_Admin', 'Barangay_Official'];

if (!in_array($role, $lguRoles, true)) {
    errorForbidden();
}

// ── Resolve center ID ─────────────────────────────────────────────────────────

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if ($id < 1) {
    errorValidation(['id' => 'A valid evacuation center ID is required.']);
}

// ── Fetch existing center ─────────────────────────────────────────────────────

$pdo  = Database::getInstance();
$stmt = $pdo->prepare(
    'SELECT id, name, address, lat, lng, max_capacity, occupancy, op_status
     FROM evacuation_centers WHERE id = ? LIMIT 1'
);
$stmt->execute([$id]);
$center = $stmt->fetch();

if (!$center) {
    errorNotFound();
}

// ── Parse body ────────────────────────────────────────────────────────────────

$body = json_decode(file_get_contents('php://input'), true) ?? [];

$name        = isset($body['name'])         ? trim($body['name'])   : $center['name'];
$address     = isset($body['address'])      ? trim($body['address']): $center['address'];
$lat         = isset($body['lat'])          ? $body['lat']          : $center['lat'];
$lng         = isset($body['lng'])          ? $body['lng']          : $center['lng'];
$maxCapacity = isset($body['max_capacity']) ? $body['max_capacity'] : $center['max_capacity'];
$occupancy   = isset($body['occupancy'])    ? $body['occupancy']    : $center['occupancy'];
$opStatus    = isset($body['op_status'])    ? trim($body['op_status']) : $center['op_status'];

// ── Validate ──────────────────────────────────────────────────────────────────

$errors = [];

if (empty($name)) {
    $errors['name'] = 'name cannot be empty.';
}

if (empty($address)) {
    $errors['address'] = 'address cannot be empty.';
}

if (!is_numeric($lat)) {
    $errors['lat'] = 'lat must be a valid number.';
}

if (!is_numeric($lng)) {
    $errors['lng'] = 'lng must be a valid number.';
}

if (!is_numeric($maxCapacity) || (int)$maxCapacity < 1) {
    $errors['max_capacity'] = 'max_capacity must be a positive integer.';
}

if (!is_numeric($occupancy) || (int)$occupancy < 0) {
    $errors['occupancy'] = 'occupancy must be a non-negative integer.';
}

$validStatuses = ['Open', 'Full', 'Closed'];
if (!in_array($opStatus, $validStatuses, true)) {
    $errors['op_status'] = 'op_status must be one of: Open, Full, Closed.';
}

if (!empty($errors)) {
    errorValidation($errors);
}

$lat         = (float)$lat;
$lng         = (float)$lng;
$maxCapacity = (int)$maxCapacity;
$occupancy   = (int)$occupancy;

// ── Capacity check ────────────────────────────────────────────────────────────

if ($occupancy > $maxCapacity) {
    errorCapacityExceeded();
}

// ── Update record ─────────────────────────────────────────────────────────────

$stmt = $pdo->prepare(
    'UPDATE evacuation_centers
     SET name = ?, address = ?, lat = ?, lng = ?, max_capacity = ?, occupancy = ?, op_status = ?
     WHERE id = ?'
);
$stmt->execute([$name, $address, $lat, $lng, $maxCapacity, $occupancy, $opStatus, $id]);

// ── Fetch updated record ──────────────────────────────────────────────────────

$stmt = $pdo->prepare(
    'SELECT id, name, address, lat, lng, max_capacity, occupancy, op_status, updated_at
     FROM evacuation_centers WHERE id = ? LIMIT 1'
);
$stmt->execute([$id]);
$updated = $stmt->fetch();

$updated['id']           = (int)$updated['id'];
$updated['lat']          = (float)$updated['lat'];
$updated['lng']          = (float)$updated['lng'];
$updated['max_capacity'] = (int)$updated['max_capacity'];
$updated['occupancy']    = (int)$updated['occupancy'];

// ── Broadcast WebSocket event ─────────────────────────────────────────────────

broadcastEvent([
    'type'      => 'center_update',
    'centerId'  => $id,
    'op_status' => $updated['op_status'],
    'occupancy' => $updated['occupancy'],
    'ts'        => gmdate('c'),
]);

jsonSuccess($updated);
