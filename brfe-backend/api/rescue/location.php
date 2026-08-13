<?php
/**
 * POST /api/rescue/location — Rescuer posts their current GPS
 * GET  /api/rescue/location?rescue_id=X — Evacuee/anyone gets rescuer location for a rescue
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../services/JwtService.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// Auth
$header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
    jsonError('AUTH_REQUIRED', 'Authorization required.', 401);
}
try {
    $payload = JwtService::verify($m[1]);
} catch (\Exception $e) {
    jsonError('AUTH_INVALID', $e->getMessage(), 401);
}

$pdo = Database::getInstance();

// ── POST: Rescuer updates their location ──────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $lat = isset($body['lat']) ? (float)$body['lat'] : null;
    $lng = isset($body['lng']) ? (float)$body['lng'] : null;
    $rescueId = isset($body['rescue_id']) ? (int)$body['rescue_id'] : null;

    if (!$lat || !$lng) {
        jsonError('VALIDATION', 'lat and lng are required.', 422);
    }

    $rescuerId = (int)$payload['user_id'];

    // Store rescuer location (upsert into a simple table or update rescue_requests)
    // We'll store it in a lightweight way: update the rescue_requests with rescuer coords
    // Add rescuer_lat/rescuer_lng columns concept — but to avoid migration, use a cache approach
    // Simpler: store in a JSON file or use an in-memory approach
    // Best approach: use a dedicated table or add to locations table with a flag

    // Use the locations table pattern — store rescuer location keyed by their lgu_accounts id
    // We'll use a simple file-based cache for real-time (avoids DB migration)
    $cacheDir = __DIR__ . '/../../cache/rescuer_locations/';
    if (!is_dir($cacheDir)) mkdir($cacheDir, 0755, true);

    $data = [
        'rescuer_id' => $rescuerId,
        'rescue_id' => $rescueId,
        'lat' => $lat,
        'lng' => $lng,
        'updated_at' => date('c'),
    ];

    file_put_contents($cacheDir . $rescuerId . '.json', json_encode($data));

    jsonSuccess(['ok' => true]);
}

// ── GET: Get rescuer location for a specific rescue ───────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rescueId = isset($_GET['rescue_id']) ? (int)$_GET['rescue_id'] : 0;

    if (!$rescueId) {
        jsonError('VALIDATION', 'rescue_id is required.', 422);
    }

    // Find the responder for this rescue
    $stmt = $pdo->prepare('SELECT responder_id FROM rescue_requests WHERE id = ? LIMIT 1');
    $stmt->execute([$rescueId]);
    $rescue = $stmt->fetch();

    if (!$rescue || !$rescue['responder_id']) {
        jsonSuccess(['rescuer' => null, 'message' => 'No rescuer assigned yet']);
    }

    $rescuerId = (int)$rescue['responder_id'];
    $cacheFile = __DIR__ . '/../../cache/rescuer_locations/' . $rescuerId . '.json';

    if (!file_exists($cacheFile)) {
        jsonSuccess(['rescuer' => null, 'message' => 'Rescuer location not available']);
    }

    $data = json_decode(file_get_contents($cacheFile), true);

    // Check if location is stale (more than 30 seconds old)
    $updatedAt = strtotime($data['updated_at'] ?? '');
    if ($updatedAt && (time() - $updatedAt) > 30) {
        jsonSuccess(['rescuer' => null, 'message' => 'Rescuer location expired']);
    }

    // Get rescuer name
    $rStmt = $pdo->prepare('SELECT username FROM lgu_accounts WHERE id = ? LIMIT 1');
    $rStmt->execute([$rescuerId]);
    $rescuerInfo = $rStmt->fetch();

    jsonSuccess([
        'rescuer' => [
            'id' => $rescuerId,
            'name' => $rescuerInfo['username'] ?? 'Rescuer',
            'lat' => (float)$data['lat'],
            'lng' => (float)$data['lng'],
            'updated_at' => $data['updated_at'],
        ]
    ]);
}

http_response_code(405);
exit;
