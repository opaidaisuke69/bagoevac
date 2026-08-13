<?php
/**
 * PUT /api/rescue/update_lgu — Barangay assigns or completes a rescue request.
 * Body: { id, req_status, rescuer_id? }
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/lgu_auth.php';
require_once __DIR__ . '/../../services/BroadcastService.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') { http_response_code(405); exit; }

requireLguAuth();

$lguUser = $GLOBALS['lgu_user'];
$body    = json_decode(file_get_contents('php://input'), true) ?? [];
$id        = isset($body['id'])          ? (int)$body['id']           : 0;
$newStatus = trim($body['req_status']    ?? '');
$rescuerId = isset($body['rescuer_id'])  ? (int)$body['rescuer_id']   : null;

if ($id < 1) { errorValidation(['id' => 'Valid rescue request ID required.']); }

$allowed = ['Ongoing', 'Completed'];
if (!in_array($newStatus, $allowed, true)) {
    errorValidation(['req_status' => 'req_status must be Ongoing or Completed.']);
}

$pdo  = Database::getInstance();
$stmt = $pdo->prepare(
    'SELECT rr.id, rr.req_status, rr.user_id, u.barangay_id
     FROM rescue_requests rr
     LEFT JOIN users u ON u.id = rr.user_id
     WHERE rr.id = ? LIMIT 1'
);
$stmt->execute([$id]);
$req = $stmt->fetch();
if (!$req) { jsonError('NOT_FOUND', 'Rescue request not found.', 404); }

// Barangay_Official can only manage requests in their barangay
if ($lguUser['role'] === 'Barangay_Official') {
    if ((int)$req['barangay_id'] !== (int)($lguUser['barangay_id'] ?? 0)) {
        errorForbidden();
    }
}

$now       = gmdate('Y-m-d H:i:s');
$evacueeId = (int)$req['user_id'];

if ($newStatus === 'Ongoing') {
    if ($req['req_status'] !== 'Pending') {
        errorValidation(['req_status' => 'Only Pending requests can be set to Ongoing.']);
    }

    $responderId = $rescuerId ?? (int)$lguUser['id'];
    $pdo->prepare("UPDATE rescue_requests SET req_status='Ongoing', responder_id=? WHERE id=?")
        ->execute([$responderId, $id]);

    // Notify evacuee
    $pdo->prepare(
        "INSERT INTO notifications (user_id, type, title, body, data) VALUES (?, 'rescue_ongoing', ?, ?, ?)"
    )->execute([
        $evacueeId,
        'Rescue Assigned',
        'A rescuer has been assigned and is on the way to your location.',
        json_encode(['rescue_id' => $id]),
    ]);

} else {
    // Complete
    if ($req['req_status'] !== 'Ongoing') {
        errorValidation(['req_status' => 'Only Ongoing requests can be Completed.']);
    }

    $pdo->prepare("UPDATE rescue_requests SET req_status='Completed', completed_at=? WHERE id=?")
        ->execute([$now, $id]);

    // Mark evacuee as Safe
    $pdo->prepare('UPDATE users SET status = ? WHERE id = ?')->execute(['Safe', $evacueeId]);
    $existSu = $pdo->prepare('SELECT id FROM status_updates WHERE user_id = ? LIMIT 1');
    $existSu->execute([$evacueeId]);
    if ($existSu->fetch()) {
        $pdo->prepare('UPDATE status_updates SET status = ?, changed_at = ? WHERE user_id = ?')
            ->execute(['Safe', $now, $evacueeId]);
    } else {
        $pdo->prepare('INSERT INTO status_updates (user_id, status, changed_at) VALUES (?, ?, ?)')
            ->execute([$evacueeId, 'Safe', $now]);
    }

    broadcastEvent(['type' => 'status_change', 'userId' => $evacueeId, 'status' => 'Safe', 'ts' => gmdate('c')]);

    // Notify evacuee
    $pdo->prepare(
        "INSERT INTO notifications (user_id, type, title, body, data) VALUES (?, 'rescue_completed', ?, ?, ?)"
    )->execute([
        $evacueeId,
        'You Have Been Rescued',
        'Your rescue has been completed. You are now marked as Safe.',
        json_encode(['rescue_id' => $id]),
    ]);
}

broadcastEvent(['type' => 'rescue_status', 'id' => $id, 'req_status' => $newStatus, 'ts' => gmdate('c')]);
broadcastEvent(['type' => 'notification', 'user_id' => $evacueeId, 'ts' => gmdate('c')]);

jsonSuccess(['id' => $id, 'req_status' => $newStatus]);
