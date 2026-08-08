<?php
require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/boundary.php';
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

// ── Only evacuees may submit disaster reports ─────────────────────────────────

if (($auth['role'] ?? '') !== 'evacuee') {
    errorForbidden();
}

$userId = (int)$auth['user_id'];

// ── Parse body — support both JSON and multipart/form-data ───────────────────

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';

if (strpos($contentType, 'multipart/form-data') !== false) {
    $body = $_POST;
} else {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
}

$floodLevel  = isset($body['flood_level'])  ? trim($body['flood_level'])  : null;
$description = isset($body['description'])  ? trim($body['description'])  : null;
$lat         = isset($body['lat'])          ? $body['lat']                : null;
$lng         = isset($body['lng'])          ? $body['lng']                : null;
$status      = isset($body['status'])       ? trim($body['status'])       : null;

// ── Validate fields ───────────────────────────────────────────────────────────

$errors = [];

$validStatuses    = ['Need_Assistance', 'In_Danger'];
$validFloodLevels = ['Low', 'Moderate', 'High', 'Critical'];

if ($status === null || $status === '') {
    $errors['status'] = 'status is required.';
} elseif (!in_array($status, $validStatuses, true)) {
    $errors['status'] = 'status must be Need_Assistance or In_Danger.';
}

if ($floodLevel === null || $floodLevel === '') {
    $errors['flood_level'] = 'flood_level is required.';
} elseif (!in_array($floodLevel, $validFloodLevels, true)) {
    $errors['flood_level'] = 'flood_level must be one of: Low, Moderate, High, Critical.';
}

if ($description === null || $description === '') {
    $errors['description'] = 'description is required.';
}

if ($lat === null || !is_numeric($lat)) {
    $errors['lat'] = 'lat is required and must be a number.';
}

if ($lng === null || !is_numeric($lng)) {
    $errors['lng'] = 'lng is required and must be a number.';
}

if (!empty($errors)) {
    errorValidation($errors);
}

$lat = (float)$lat;
$lng = (float)$lng;

// ── Boundary check ────────────────────────────────────────────────────────────

if (!BagoBoundary::contains($lat, $lng)) {
    errorBoundaryViolation([
        'lat' => 'Coordinates are outside the Bago City operational boundary.',
        'lng' => 'Coordinates are outside the Bago City operational boundary.',
    ]);
}

// ── Handle optional photo upload ──────────────────────────────────────────────

$photoPath = null;

if (isset($_FILES['photo']) && $_FILES['photo']['error'] !== UPLOAD_ERR_NO_FILE) {
    $file = $_FILES['photo'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        errorValidation(['photo' => 'Photo upload failed with error code: ' . $file['error']]);
    }

    $allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    $mime         = mime_content_type($file['tmp_name']);

    if (!in_array($mime, $allowedMimes, true)) {
        errorValidation(['photo' => 'Photo must be a jpg, jpeg, png, or gif image.']);
    }

    $extMap = [
        'image/jpeg' => 'jpg',
        'image/jpg'  => 'jpg',
        'image/png'  => 'png',
        'image/gif'  => 'gif',
    ];
    $ext      = $extMap[$mime] ?? 'jpg';
    $filename = $userId . '_' . time() . '.' . $ext;

    $uploadDir = __DIR__ . '/../../public/uploads/reports/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $destPath = $uploadDir . $filename;
    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        jsonError('UPLOAD_FAILED', 'Failed to save the uploaded photo.', 500);
    }

    $photoPath = 'uploads/reports/' . $filename;
}

// ── Insert report ─────────────────────────────────────────────────────────────

$now = gmdate('Y-m-d H:i:s');
$pdo = Database::getInstance();

$stmt = $pdo->prepare(
    'INSERT INTO reports (user_id, flood_level, description, photo_path, lat, lng, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)'
);
$stmt->execute([$userId, $floodLevel, $description, $photoPath, $lat, $lng, $now]);

$reportId = (int)$pdo->lastInsertId();

// ── Update user status ────────────────────────────────────────────────────────
$pdo->prepare('UPDATE users SET status = ? WHERE id = ?')->execute([$status, $userId]);

$existing = $pdo->prepare('SELECT id FROM status_updates WHERE user_id = ? LIMIT 1');
$existing->execute([$userId]);
if ($existing->fetch()) {
    $pdo->prepare('UPDATE status_updates SET status = ?, changed_at = ? WHERE user_id = ?')
        ->execute([$status, $now, $userId]);
} else {
    $pdo->prepare('INSERT INTO status_updates (user_id, status, changed_at) VALUES (?, ?, ?)')
        ->execute([$userId, $status, $now]);
}

// ── Auto-create rescue request for Need_Assistance / In_Danger ───────────────
// Only create if there is no existing Pending or Ongoing request for this user
$existingRescue = $pdo->prepare(
    "SELECT id FROM rescue_requests WHERE user_id = ? AND req_status IN ('Pending','Ongoing') LIMIT 1"
);
$existingRescue->execute([$userId]);
$rescueId = null;
if (!$existingRescue->fetch()) {
    $rStmt = $pdo->prepare(
        "INSERT INTO rescue_requests (user_id, lat, lng, status_at_request, req_status, requested_at)
         VALUES (?, ?, ?, ?, 'Pending', ?)"
    );
    $rStmt->execute([$userId, $lat, $lng, $status, $now]);
    $rescueId = (int)$pdo->lastInsertId();
}

// ── Broadcast WebSocket event ─────────────────────────────────────────────────

broadcastEvent([
    'type'         => 'disaster_report',
    'reportId'     => $reportId,
    'userId'       => $userId,
    'flood_level'  => $floodLevel,
    'lat'          => $lat,
    'lng'          => $lng,
    'submitted_at' => gmdate('c'),
]);

if ($rescueId) {
    broadcastEvent([
        'type'      => 'rescue_request',
        'requestId' => $rescueId,
        'userId'    => $userId,
        'lat'       => $lat,
        'lng'       => $lng,
        'status'    => $status,
        'ts'        => gmdate('c'),
    ]);
}

jsonSuccess([
    'id'           => $reportId,
    'user_id'      => $userId,
    'flood_level'  => $floodLevel,
    'description'  => $description,
    'photo_path'   => $photoPath,
    'lat'          => $lat,
    'lng'          => $lng,
    'submitted_at' => $now,
], 201);
