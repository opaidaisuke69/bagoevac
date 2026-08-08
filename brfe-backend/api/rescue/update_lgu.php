<?php
/**
 * PUT /api/rescue/update — LGU web panel rescue update (session auth).
 * Body: { id, req_status, responder? }
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/lgu_auth.php';
require_once __DIR__ . '/../../services/BroadcastService.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    exit;
}

requireLguAuth();

$body      = json_decode(file_get_contents('php://input'), true) ?? [];
$id        = isset($body['id']) ? (int)$body['id'] : 0;
$newStatus = trim($body['req_status'] ?? '');
$responder = trim($body['responder'] ?? '');

if ($id < 1) { errorValidation(['id' => 'Valid rescue request ID required.']); }

$allowed = ['Ongoing', 'Completed'];
if (!in_array($newStatus, $allowed, true)) {
    errorValidation(['req_status' => 'req_status must be Ongoing or Completed.']);
}

$pdo  = Database::getInstance();
$stmt = $pdo->prepare('SELECT id, req_status FROM rescue_requests WHERE id = ? LIMIT 1');
$stmt->execute([$id]);
$req  = $stmt->fetch();
if (!$req) { errorNotFound(); }

$now = gmdate('Y-m-d H:i:s');

// Fetch user_id for this rescue request upfront
$rrRow = $pdo->prepare('SELECT user_id FROM rescue_requests WHERE id = ? LIMIT 1');
$rrRow->execute([$id]);
$rrData = $rrRow->fetch();
$evacueeId = $rrData ? (int)$rrData['user_id'] : null;

if ($newStatus === 'Ongoing') {
    if ($req['req_status'] !== 'Pending') {
        errorValidation(['req_status' => 'Only Pending requests can be set to Ongoing.']);
    }
    $responderId = (int)$GLOBALS['lgu_user']['id'];
    $pdo->prepare("UPDATE rescue_requests SET req_status='Ongoing', responder_id=? WHERE id=?")
        ->execute([$responderId, $id]);

    // Notify evacuee
    if ($evacueeId) {
        $pdo->prepare(
            "INSERT INTO notifications (user_id, type, title, body, data) VALUES (?, 'rescue_ongoing', ?, ?, ?)"
        )->execute([
            $evacueeId,
            'Rescue Request Accepted',
            'A responder is on the way to your location.',
            json_encode(['rescue_id' => $id]),
        ]);
    }
} else {
    if ($req['req_status'] !== 'Ongoing') {
        errorValidation(['req_status' => 'Only Ongoing requests can be Completed.']);
    }

    // Mark evacuee as Safe
    if ($evacueeId) {
        $uid = $evacueeId;
        $pdo->prepare('UPDATE users SET status = ? WHERE id = ?')->execute(['Safe', $uid]);
        $existSu = $pdo->prepare('SELECT id FROM status_updates WHERE user_id = ? LIMIT 1');
        $existSu->execute([$uid]);
        if ($existSu->fetch()) {
            $pdo->prepare('UPDATE status_updates SET status = ?, changed_at = ? WHERE user_id = ?')
                ->execute(['Safe', $now, $uid]);
        } else {
            $pdo->prepare('INSERT INTO status_updates (user_id, status, changed_at) VALUES (?, ?, ?)')
                ->execute([$uid, 'Safe', $now]);
        }
        broadcastEvent(['type' => 'status_change', 'userId' => $uid, 'status' => 'Safe', 'ts' => gmdate('c')]);

        // Notify evacuee
        $pdo->prepare(
            "INSERT INTO notifications (user_id, type, title, body, data) VALUES (?, 'rescue_completed', ?, ?, ?)"
        )->execute([
            $uid,
            'You Have Been Marked Safe',
            'Your rescue request has been completed. You are now marked as Safe.',
            json_encode(['rescue_id' => $id]),
        ]);
    }

    // Delete the rescue request now that it's completed
    $pdo->prepare('DELETE FROM rescue_requests WHERE id = ?')->execute([$id]);
}

broadcastEvent(['type' => 'rescue_status', 'id' => $id, 'req_status' => $newStatus, 'ts' => gmdate('c')]);
if ($evacueeId) {
    broadcastEvent(['type' => 'notification', 'user_id' => $evacueeId, 'ts' => gmdate('c')]);
}

jsonSuccess(['id' => $id, 'req_status' => $newStatus]);
