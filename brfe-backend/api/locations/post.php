<?php
/**
 * POST /api/locations/post
 * Upserts the evacuee's current position — INSERT on first call,
 * UPDATE on every subsequent call. One row per user, no table growth.
 */

require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/boundary.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../services/BroadcastService.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }

requireAuth();
$auth = $GLOBALS['auth_user'];
if (($auth['role'] ?? '') !== 'evacuee') { errorForbidden(); }

$userId = (int)$auth['user_id'];

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$lat  = isset($body['lat']) ? $body['lat'] : null;
$lng  = isset($body['lng']) ? $body['lng'] : null;

$errors = [];
if ($lat === null || !is_numeric($lat)) $errors['lat'] = 'lat is required.';
if ($lng === null || !is_numeric($lng)) $errors['lng'] = 'lng is required.';
if (!empty($errors)) errorValidation($errors);

$lat = (float)$lat;
$lng = (float)$lng;

if (!BagoBoundary::contains($lat, $lng)) {
    errorBoundaryViolation();
}

$pdo = Database::getInstance();
$now = date('Y-m-d H:i:s');

// ── Upsert: always one row per user ───────────────────────────────────────────
// Uses INSERT ... ON DUPLICATE KEY UPDATE — requires UNIQUE(user_id).
// If the unique key is missing, falls back to explicit check.
$existing = $pdo->prepare('SELECT id FROM locations WHERE user_id = ? LIMIT 1');
$existing->execute([$userId]);

if ($existing->fetch()) {
    $pdo->prepare(
        'UPDATE locations SET lat = ?, lng = ?, recorded_at = ? WHERE user_id = ?'
    )->execute([$lat, $lng, $now, $userId]);
} else {
    $pdo->prepare(
        'INSERT INTO locations (user_id, lat, lng, recorded_at) VALUES (?, ?, ?, ?)'
    )->execute([$userId, $lat, $lng, $now]);
}

// ── Broadcast real-time location to LGU dashboard ─────────────────────────────
$userRow = $pdo->prepare('SELECT full_name, status, avatar_path, barangay_id FROM users WHERE id = ? LIMIT 1');
$userRow->execute([$userId]);
$userInfo = $userRow->fetch();

broadcastEvent([
    'type'        => 'location_update',
    'user_id'     => $userId,
    'lat'         => $lat,
    'lng'         => $lng,
    'latitude'    => $lat,
    'longitude'   => $lng,
    'full_name'   => $userInfo['full_name']   ?? '',
    'status'      => $userInfo['status']      ?? 'Safe',
    'avatar_path' => $userInfo['avatar_path'] ?? null,
    'barangay_id' => $userInfo['barangay_id'] ? (int)$userInfo['barangay_id'] : null,
    'recorded_at' => date('c'),
]);

jsonSuccess(['user_id' => $userId, 'lat' => $lat, 'lng' => $lng, 'recorded_at' => $now]);
