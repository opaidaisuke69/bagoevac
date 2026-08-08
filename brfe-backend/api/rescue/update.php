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

// ── LGU roles only ────────────────────────────────────────────────────────────

$role = $auth['role'] ?? '';
$lguRoles = ['LGU_Admin', 'Barangay_Official'];

if (!in_array($role, $lguRoles, true)) {
    errorForbidden();
}

// ── Resolve rescue request ID ─────────────────────────────────────────────────

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if ($id < 1) {
    errorValidation(['id' => 'A valid rescue request ID is required.']);
}

// ── Parse body ────────────────────────────────────────────────────────────────

$body        = json_decode(file_get_contents('php://input'), true) ?? [];
$responderId = isset($body['responder_id']) ? $body['responder_id'] : null;
$action      = isset($body['action'])       ? trim($body['action']) : null;

// ── Fetch the existing rescue request ────────────────────────────────────────

$pdo  = Database::getInstance();
$stmt = $pdo->prepare('SELECT id, req_status FROM rescue_requests WHERE id = ? LIMIT 1');
$stmt->execute([$id]);
$request = $stmt->fetch();

if (!$request) {
    errorNotFound();
}

$currentStatus = $request['req_status'];

// ── Apply state machine transitions ──────────────────────────────────────────

$now         = gmdate('Y-m-d H:i:s');
$newStatus   = $currentStatus;
$completedAt = null;

if ($responderId !== null) {
    // Pending → Ongoing: requires a valid responder_id
    if ($currentStatus !== 'Pending') {
        errorValidation(['responder_id' => 'A responder can only be assigned to a Pending request.']);
    }

    $responderId = (int)$responderId;

    // Validate that the responder exists in lgu_accounts
    $chk = $pdo->prepare('SELECT id FROM lgu_accounts WHERE id = ? LIMIT 1');
    $chk->execute([$responderId]);
    if (!$chk->fetch()) {
        errorFkViolation();
    }

    $pdo->prepare(
        'UPDATE rescue_requests SET req_status = \'Ongoing\', responder_id = ? WHERE id = ?'
    )->execute([$responderId, $id]);

    $newStatus = 'Ongoing';

} elseif ($action === 'complete') {
    // Ongoing → Completed
    if ($currentStatus !== 'Ongoing') {
        errorValidation(['action' => 'Only an Ongoing request can be marked as completed.']);
    }

    $pdo->prepare(
        'UPDATE rescue_requests SET req_status = \'Completed\', completed_at = ? WHERE id = ?'
    )->execute([$now, $id]);

    $newStatus   = 'Completed';
    $completedAt = $now;

} else {
    errorValidation(['body' => 'Provide responder_id to assign a responder, or action=complete to close the request.']);
}

// ── Fetch updated record for response ─────────────────────────────────────────

$stmt = $pdo->prepare(
    'SELECT id, user_id, lat, lng, status_at_request, req_status, responder_id, requested_at, completed_at
     FROM rescue_requests WHERE id = ? LIMIT 1'
);
$stmt->execute([$id]);
$updated = $stmt->fetch();

$updated['id']           = (int)$updated['id'];
$updated['user_id']      = (int)$updated['user_id'];
$updated['lat']          = (float)$updated['lat'];
$updated['lng']          = (float)$updated['lng'];
$updated['responder_id'] = $updated['responder_id'] !== null ? (int)$updated['responder_id'] : null;

// ── Broadcast WebSocket event ─────────────────────────────────────────────────

broadcastEvent([
    'type'        => 'rescue_status',
    'requestId'   => $id,
    'status'      => $newStatus,
    'responderId' => $updated['responder_id'],
    'ts'          => gmdate('c'),
]);

jsonSuccess($updated);
