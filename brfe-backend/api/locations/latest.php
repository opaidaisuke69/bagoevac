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

// ── Resolve target user ID ────────────────────────────────────────────────────

$targetUserId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

if ($targetUserId < 1) {
    errorValidation(['user_id' => 'A valid user_id is required.']);
}

// ── Authorization ─────────────────────────────────────────────────────────────
// Evacuees may only fetch their own location.
// LGU accounts (LGU_Admin, Barangay_Official) may fetch any user's location.

$role = $auth['role'] ?? '';

if ($role === 'evacuee') {
    if ((int)$auth['user_id'] !== $targetUserId) {
        errorForbidden();
    }
} elseif (!in_array($role, ['LGU_Admin', 'Barangay_Official'], true)) {
    errorForbidden();
}

// ── Query most recent location ────────────────────────────────────────────────

$pdo  = Database::getInstance();
$stmt = $pdo->prepare(
    'SELECT id, user_id, lat, lng, recorded_at
       FROM locations
      WHERE user_id = ?
      ORDER BY recorded_at DESC, id DESC
      LIMIT 1'
);
$stmt->execute([$targetUserId]);
$row = $stmt->fetch();

if (!$row) {
    errorNotFound();
}

jsonSuccess([
    'id'          => (int)$row['id'],
    'user_id'     => (int)$row['user_id'],
    'lat'         => (float)$row['lat'],
    'lng'         => (float)$row['lng'],
    'recorded_at' => $row['recorded_at'],
]);
