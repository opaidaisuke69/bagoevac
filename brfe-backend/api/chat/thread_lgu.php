<?php
/**
 * GET  /api/chat/thread_lgu?with=<evacuee_id>  — fetch thread
 * POST /api/chat/thread_lgu                     — send chat message to evacuee
 * GET  /api/chat/thread_lgu?feed=1              — fetch broadcast/announcement feed
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/lgu_auth.php';
require_once __DIR__ . '/../../services/BroadcastService.php';

header('Content-Type: application/json; charset=utf-8');
requireLguAuth();

$lgu    = $GLOBALS['lgu_user'];
$method = $_SERVER['REQUEST_METHOD'];
$pdo    = Database::getInstance();

if ($method === 'GET') {
    $withId = isset($_GET['with']) ? (int)$_GET['with'] : 0;
    $feed   = !empty($_GET['feed']);

    if ($feed) {
        // Return broadcast/announcement feed visible to this LGU account
        $now = date('Y-m-d H:i:s');
        $myBarangayId = isset($lgu['barangay_id']) ? (int)$lgu['barangay_id'] : 0;
        $isAdmin = ($lgu['role'] === 'LGU_Admin');

        if ($isAdmin) {
            // LGU Admin sees all broadcasts/announcements
            $stmt = $pdo->prepare(
                "SELECT cm.id, cm.sender_type, cm.sender_id, cm.body, cm.msg_type,
                        cm.expires_at, cm.barangay_id, cm.sent_at,
                        la.username AS sender_name, la.role AS sender_role,
                        b.name AS sender_barangay
                 FROM chat_messages cm
                 LEFT JOIN lgu_accounts la ON la.id = cm.sender_id AND cm.sender_type = 'lgu'
                 LEFT JOIN barangays b ON b.id = la.barangay_id
                 WHERE cm.msg_type IN ('broadcast','announcement')
                   AND (cm.expires_at IS NULL OR cm.expires_at > ?)
                 GROUP BY cm.body, cm.sender_id, cm.msg_type, cm.sent_at
                 ORDER BY cm.sent_at DESC
                 LIMIT 100"
            );
            $stmt->execute([$now]);
        } else {
            // Barangay Official sees only their own barangay's broadcasts + city-wide (barangay_id IS NULL)
            $stmt = $pdo->prepare(
                "SELECT cm.id, cm.sender_type, cm.sender_id, cm.body, cm.msg_type,
                        cm.expires_at, cm.barangay_id, cm.sent_at,
                        la.username AS sender_name, la.role AS sender_role,
                        b.name AS sender_barangay
                 FROM chat_messages cm
                 LEFT JOIN lgu_accounts la ON la.id = cm.sender_id AND cm.sender_type = 'lgu'
                 LEFT JOIN barangays b ON b.id = la.barangay_id
                 WHERE cm.msg_type IN ('broadcast','announcement')
                   AND (cm.expires_at IS NULL OR cm.expires_at > ?)
                   AND (cm.barangay_id = ? OR cm.barangay_id IS NULL)
                 GROUP BY cm.body, cm.sender_id, cm.msg_type, cm.sent_at
                 ORDER BY cm.sent_at DESC
                 LIMIT 100"
            );
            $stmt->execute([$now, $myBarangayId]);
        }

        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) { $r['id'] = (int)$r['id']; }
        unset($r);
        jsonSuccess(['data' => $rows]);
    }

    if ($withId < 1) errorValidation(['with' => 'Valid evacuee ID required.']);

    $stmt = $pdo->prepare(
        "SELECT cm.id, cm.sender_type, cm.sender_id, cm.body, cm.msg_type, cm.sent_at,
                CASE WHEN cm.sender_type = 'evacuee' THEN u.full_name
                     ELSE la.username END AS sender_name,
                la.role AS sender_role,
                b.name AS sender_barangay
         FROM chat_messages cm
         LEFT JOIN users u ON u.id = cm.sender_id AND cm.sender_type = 'evacuee'
         LEFT JOIN lgu_accounts la ON la.id = cm.sender_id AND cm.sender_type = 'lgu'
         LEFT JOIN barangays b ON b.id = la.barangay_id
         WHERE cm.msg_type = 'chat'
           AND ((cm.sender_type = 'evacuee' AND cm.sender_id = ? AND cm.recipient_type = 'lgu')
             OR (cm.sender_type = 'lgu' AND cm.sender_id = ? AND cm.recipient_id = ?)
             OR (cm.sender_type = 'lgu' AND cm.recipient_type = 'evacuee' AND cm.recipient_id = ?))
         ORDER BY cm.sent_at ASC"
    );
    $stmt->execute([$withId, $lgu['id'], $withId, $withId]);
    $messages = $stmt->fetchAll();
    foreach ($messages as &$m) { $m['id'] = (int)$m['id']; }
    unset($m);
    jsonSuccess(['data' => $messages]);

} elseif ($method === 'POST') {
    $body        = json_decode(file_get_contents('php://input'), true) ?? [];
    $recipientId = isset($body['recipient_id']) ? (int)$body['recipient_id'] : 0;
    $message     = trim($body['message'] ?? '');

    if ($recipientId < 1) errorValidation(['recipient_id' => 'Valid evacuee ID required.']);
    if ($message === '')  errorValidation(['message' => 'Message cannot be empty.']);

    $now = date('Y-m-d H:i:s');
    $stmt = $pdo->prepare(
        "INSERT INTO chat_messages (sender_type, sender_id, recipient_type, recipient_id, body, msg_type, sent_at)
         VALUES ('lgu', ?, 'evacuee', ?, ?, 'chat', ?)"
    );
    $stmt->execute([$lgu['id'], $recipientId, $message, $now]);
    $msgId = (int)$pdo->lastInsertId();

    // Fetch sender barangay for display
    $bRow = $pdo->prepare('SELECT b.name FROM lgu_accounts la LEFT JOIN barangays b ON b.id = la.barangay_id WHERE la.id = ? LIMIT 1');
    $bRow->execute([$lgu['id']]);
    $bData = $bRow->fetch();

    broadcastEvent([
        'type'            => 'chat_message',
        'msg_type'        => 'chat',
        'id'              => $msgId,
        'sender_type'     => 'lgu',
        'sender_id'       => $lgu['id'],
        'sender_name'     => $lgu['username'],
        'sender_role'     => $lgu['role'],
        'sender_barangay' => $bData['name'] ?? null,
        'recipient_id'    => $recipientId,
        'body'            => $message,
        'sent_at'         => $now,
    ]);

    jsonSuccess(['id' => $msgId, 'sent_at' => $now], 201);

} else {
    http_response_code(405); exit;
}
