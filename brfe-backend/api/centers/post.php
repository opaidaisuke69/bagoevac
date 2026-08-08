<?php
require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../services/BroadcastService.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

requireAuth();

$auth = $GLOBALS['auth_user'];

// ── LGU_Admin only ────────────────────────────────────────────────────────────

if (($auth['role'] ?? '') !== 'LGU_Admin') {
    errorForbidden();
}

// ── Parse body ────────────────────────────────────────────────────────────────

$body = json_decode(file_get_contents('php://input'), true) ?? [];

$name         = isset($body['name'])         ? trim($body['name'])         : null;
$address      = isset($body['address'])      ? trim($body['address'])      : null;
$lat          = isset($body['lat'])          ? $body['lat']                : null;
$lng          = isset($body['lng'])          ? $body['lng']                : null;
$maxCapacity  = isset($body['max_capacity']) ? $body['max_capacity']       : null;

// ── Validate required fields ──────────────────────────────────────────────────

$errors = [];

if (empty($name)) {
    $errors['name'] = 'name is required.';
}

if (empty($address)) {
    $errors['address'] = 'address is required.';
}

if ($lat === null || !is_numeric($lat)) {
    $errors['lat'] = 'lat must be a valid number.';
}

if ($lng === null || !is_numeric($lng)) {
    $errors['lng'] = 'lng must be a valid number.';
}

if ($maxCapacity === null || !is_numeric($maxCapacity) || (int)$maxCapacity < 1) {
    $errors['max_capacity'] = 'max_capacity must be a positive integer.';
}

if (!empty($errors)) {
    errorValidation($errors);
}

$lat         = (float)$lat;
$lng         = (float)$lng;
$maxCapacity = (int)$maxCapacity;

// ── Insert evacuation center ──────────────────────────────────────────────────

$pdo  = Database::getInstance();
$now  = gmdate('Y-m-d H:i:s');

$stmt = $pdo->prepare(
    'INSERT INTO evacuation_centers (name, address, lat, lng, max_capacity, occupancy, op_status, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, \'Open\', ?)'
);
$stmt->execute([$name, $address, $lat, $lng, $maxCapacity, $now]);

$centerId = (int)$pdo->lastInsertId();

// ── Broadcast WebSocket event ─────────────────────────────────────────────────

broadcastEvent([
    'type'     => 'center_update',
    'centerId' => $centerId,
    'ts'       => gmdate('c'),
]);

jsonSuccess([
    'id'           => $centerId,
    'name'         => $name,
    'address'      => $address,
    'lat'          => $lat,
    'lng'          => $lng,
    'max_capacity' => $maxCapacity,
    'occupancy'    => 0,
    'op_status'    => 'Open',
    'updated_at'   => $now,
], 201);
