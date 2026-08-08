<?php
/**
 * GET /api/chat/threads_lgu — List evacuees who have chatted with LGU (session auth).
 * Returns list of evacuees with their latest message for thread list display.
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/lgu_auth.php';

header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); exit; }
requireLguAuth();

$pdo = Database::getInstance();

// Get all evacuees that have at least one message
$stmt = $pdo->query(
    'SELECT DISTINCT u.id, u.full_name, u.contact_no, u.status,
            (SELECT body FROM chat_messages cm
             WHERE (cm.sender_id = u.id AND cm.sender_type = \'evacuee\')
                OR (cm.recipient_id = u.id AND cm.recipient_type = \'evacuee\')
             ORDER BY cm.sent_at DESC LIMIT 1) AS last_message,
            (SELECT sent_at FROM chat_messages cm
             WHERE (cm.sender_id = u.id AND cm.sender_type = \'evacuee\')
                OR (cm.recipient_id = u.id AND cm.recipient_type = \'evacuee\')
             ORDER BY cm.sent_at DESC LIMIT 1) AS last_message_at
     FROM users u
     ORDER BY last_message_at DESC, u.full_name ASC'
);
$threads = $stmt->fetchAll();

foreach ($threads as &$t) { $t['id'] = (int)$t['id']; }
unset($t);

jsonSuccess(['data' => $threads]);
