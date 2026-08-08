<?php
/**
 * POST /api/chat/broadcast
 * Body: { body, msg_type: 'broadcast'|'announcement', expires_at?: ISO8601 }
 *
 * LGU_Admin   → broadcast/announcement to ALL evacuees
 * Barangay_Official → broadcast to evacuees in their barangay only
 *
 * Auth: LGU session
 */
require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/lgu_auth.php';
require_once __DIR__ . '/../../services/BroadcastService.php';

header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }

requireLguAuth();
$lguUser  = $GLOBALS['lgu_user'];
$senderId = (int)$lguUser['id'];
$role     = $lguUser['role'];
$senderBarangayId = $lguUser['barangay_id'] ? (int)$lguUser['barangay_id'] : null;

$body    = json_decode(file_get_contents('php://input'), true) ?? [];
$msgBody = trim($body['body'] ?? '');
$msgType = trim($body['msg_type'] ?? 'broadcast');
$expiresRaw = $body['expires_at'] ?? null;

if ($msgBody === '') errorValidation(['body' => 'body is required.']);
if (!in_array($msgType, ['broadcast', 'announcement'], true)) {
    errorValidation(['msg_type' => 'msg_type must be broadcast or announcement.']);
}
// Only LGU_Admin can send announcements
if ($msgType === 'announcement' && $role !== 'LGU_Admin') {
    errorForbidden();
}

$expiresAt = null;
if ($expiresRaw) {
    $ts = strtotime($expiresRaw);
    if ($ts === false) errorValidation(['expires_at' => 'Invalid expires_at datetime.']);
    $expiresAt = date('Y-m-d H:i:s', $ts);
}

$pdo = Database::getInstance();
$now = date('Y-m-d H:i:s');

// Determine target evacuees
if ($role === 'LGU_Admin') {
    $stmt = $pdo->query('SELECT id FROM users WHERE token_hash IS NOT NULL');
    $targetBarangayId = null;
} else {
    // Barangay_Official — scope to their barangay
    if (!$senderBarangayId) errorForbidden();
    $stmt = $pdo->prepare('SELECT id FROM users WHERE token_hash IS NOT NULL AND barangay_id = ?');
    $stmt->execute([$senderBarangayId]);
    $targetBarangayId = $senderBarangayId;
}
$evacuees = $stmt->fetchAll(PDO::FETCH_COLUMN);

$insertStmt = $pdo->prepare(
    'INSERT INTO chat_messages (sender_type, sender_id, recipient_type, recipient_id, body, msg_type, expires_at, barangay_id, sent_at, delivered_at)
     VALUES (\'lgu\', ?, \'evacuee\', ?, ?, ?, ?, ?, ?, ?)'
);

// Fetch sender info for display
$senderRow = $pdo->prepare('SELECT username, barangay_id FROM lgu_accounts WHERE id = ? LIMIT 1');
$senderRow->execute([$senderId]);
$senderInfo = $senderRow->fetch();
$senderBarangayName = null;
if ($senderInfo['barangay_id']) {
    $bRow = $pdo->prepare('SELECT name FROM barangays WHERE id = ? LIMIT 1');
    $bRow->execute([$senderInfo['barangay_id']]);
    $bData = $bRow->fetch();
    $senderBarangayName = $bData['name'] ?? null;
}

$insertedIds = [];
foreach ($evacuees as $evacueeId) {
    $insertStmt->execute([$senderId, (int)$evacueeId, $msgBody, $msgType, $expiresAt, $targetBarangayId, $now, $now]);
    $insertedIds[] = (int)$pdo->lastInsertId();
}

broadcastEvent([
    'type'              => 'chat_message',
    'msg_type'          => $msgType,
    'sender_type'       => 'lgu',
    'sender_id'         => $senderId,
    'sender_name'       => $senderInfo['username'] ?? '',
    'sender_role'       => $role,
    'sender_barangay'   => $senderBarangayName,
    'body'              => $msgBody,
    'expires_at'        => $expiresAt,
    'barangay_id'       => $targetBarangayId,
    'sent_at'           => date('c'),
    'recipients'        => count($evacuees),
]);

jsonSuccess(['sent_to' => count($evacuees), 'msg_type' => $msgType, 'expires_at' => $expiresAt], 201);
