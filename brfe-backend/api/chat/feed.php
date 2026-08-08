<?php
/**
 * GET /api/chat/feed
 * Returns active broadcasts and announcements for the authenticated evacuee.
 * Filters: announcements (all) + broadcasts scoped to evacuee's barangay or global.
 * Excludes expired messages.
 */
require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); exit; }

requireAuth();
$auth   = $GLOBALS['auth_user'];
$userId = (int)$auth['user_id'];

$pdo = Database::getInstance();
$now = date('Y-m-d H:i:s');

// Get evacuee's barangay
$bStmt = $pdo->prepare('SELECT barangay_id FROM users WHERE id = ? LIMIT 1');
$bStmt->execute([$userId]);
$evacuee = $bStmt->fetch();
$evacueeBarangayId = $evacuee ? (int)$evacuee['barangay_id'] : null;

$stmt = $pdo->prepare(
    "SELECT cm.id, cm.sender_id, cm.body, cm.msg_type, cm.expires_at, cm.barangay_id, cm.sent_at,
            la.username AS sender_name, la.role AS sender_role,
            b.name AS sender_barangay
     FROM chat_messages cm
     LEFT JOIN lgu_accounts la ON la.id = cm.sender_id AND cm.sender_type = 'lgu'
     LEFT JOIN barangays b ON b.id = la.barangay_id
     WHERE cm.msg_type IN ('broadcast','announcement')
       AND cm.recipient_id = ?
       AND (cm.expires_at IS NULL OR cm.expires_at > ?)
     ORDER BY cm.sent_at DESC
     LIMIT 50"
);
$stmt->execute([$userId, $now]);
$rows = $stmt->fetchAll();

foreach ($rows as &$r) {
    $r['id']        = (int)$r['id'];
    $r['sender_id'] = (int)$r['sender_id'];
}
unset($r);

jsonSuccess(['data' => $rows]);
