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

// ── Only evacuees may submit rescue requests ──────────────────────────────────

if (($auth['role'] ?? '') !== 'evacuee') {
    errorForbidden();
}

$userId = (int)$auth['user_id'];

// ── Parse body ────────────────────────────────────────────────────────────────

$body = json_decode(file_get_contents('php://input'), true) ?? [];

$lat = isset($body['lat']) ? $body['lat'] : (isset($body['latitude']) ? $body['latitude'] : null);
$lng = isset($body['lng']) ? $body['lng'] : (isset($body['longitude']) ? $body['longitude'] : null);

// ── Require a valid GPS fix (lat and lng must be present and numeric) ─────────

if ($lat === null || !is_numeric($lat) || $lng === null || !is_numeric($lng)) {
    errorNoGpsFix();
}

$lat = (float)$lat;
$lng = (float)$lng;

// ── Fetch the evacuee's current status ────────────────────────────────────────

$pdo  = Database::getInstance();
$stmt = $pdo->prepare('SELECT status FROM users WHERE id = ? LIMIT 1');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user) {
    errorNotFound();
}

$statusAtRequest = $user['status'];

// ── Insert rescue request ─────────────────────────────────────────────────────

$now = gmdate('Y-m-d H:i:s');

$stmt = $pdo->prepare(
    'INSERT INTO rescue_requests (user_id, lat, lng, status_at_request, req_status, requested_at)
     VALUES (?, ?, ?, ?, \'Pending\', ?)'
);
$stmt->execute([$userId, $lat, $lng, $statusAtRequest, $now]);

$requestId = (int)$pdo->lastInsertId();

// ── Broadcast WebSocket event ─────────────────────────────────────────────────

broadcastEvent([
    'type'      => 'rescue_request',
    'requestId' => $requestId,
    'userId'    => $userId,
    'lat'       => $lat,
    'lng'       => $lng,
    'ts'        => gmdate('c'),
]);

jsonSuccess([
    'id'               => $requestId,
    'user_id'          => $userId,
    'lat'              => $lat,
    'lng'              => $lng,
    'status_at_request' => $statusAtRequest,
    'req_status'       => 'Pending',
    'requested_at'     => $now,
], 201);
