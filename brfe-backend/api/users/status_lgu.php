<?php
/**
 * PUT /api/users/status_lgu?id=<userId>
 *
 * Lets an LGU_Admin (or Barangay_Official for their own barangay) change an
 * evacuee's status to Safe / Need_Assistance / In_Danger.
 *
 * Body: { "status": "Safe" | "Need_Assistance" | "In_Danger" }
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/lgu_auth.php';
require_once __DIR__ . '/../../services/BroadcastService.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: PUT, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') { http_response_code(405); exit; }

requireLguAuth();

$lguUser    = $GLOBALS['lgu_user'];
$isAdmin    = ($lguUser['role'] === 'LGU_Admin');
$barangayId = (int)($lguUser['barangay_id'] ?? 0);

// ── Resolve target user ───────────────────────────────────────────────────────
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($id < 1) {
    errorValidation(['id' => 'A valid user ID is required.']);
}

// ── Validate status ───────────────────────────────────────────────────────────
$body    = json_decode(file_get_contents('php://input'), true) ?? [];
$status  = $body['status'] ?? '';
$allowed = ['Safe', 'Need_Assistance', 'In_Danger'];
if (!in_array($status, $allowed, true)) {
    errorValidation(['status' => 'Status must be one of: Safe, Need_Assistance, In_Danger.']);
}

// ── Verify user exists (and enforce barangay scope for non-admins) ────────────
$pdo  = Database::getInstance();
$stmt = $pdo->prepare('SELECT id, barangay_id FROM users WHERE id = ? LIMIT 1');
$stmt->execute([$id]);
$target = $stmt->fetch();
if (!$target) {
    jsonError('NOT_FOUND', 'Evacuee not found.', 404);
}

if (!$isAdmin) {
    // Barangay officials may only change evacuees registered in their barangay.
    if (!$barangayId || (int)$target['barangay_id'] !== $barangayId) {
        errorForbidden();
    }
}

// ── Persist status change ─────────────────────────────────────────────────────
$now = date('Y-m-d H:i:s');

$pdo->prepare('UPDATE users SET status = ? WHERE id = ?')->execute([$status, $id]);

// Upsert status_updates — one row per user, updated on each change
$existing = $pdo->prepare('SELECT id FROM status_updates WHERE user_id = ? LIMIT 1');
$existing->execute([$id]);
if ($existing->fetch()) {
    $pdo->prepare('UPDATE status_updates SET status = ?, changed_at = ? WHERE user_id = ?')
        ->execute([$status, $now, $id]);
} else {
    $pdo->prepare('INSERT INTO status_updates (user_id, status, changed_at) VALUES (?, ?, ?)')
        ->execute([$id, $status, $now]);
}

// ── Broadcast WebSocket event ─────────────────────────────────────────────────
broadcastEvent([
    'type'   => 'status_change',
    'userId' => $id,
    'status' => $status,
    'ts'     => gmdate('c'),
]);

jsonSuccess([
    'user_id'    => $id,
    'status'     => $status,
    'changed_at' => $now,
]);
