<?php
/**
 * GET  /api/chat/messages?with=:userId  — fetch thread between auth user and specified user
 * POST /api/chat/messages               — send a message
 *
 * Auth: JWT Bearer (evacuee) OR PHP session (LGU) — dual-auth via tryAuth()
 */

require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../services/JwtService.php';
require_once __DIR__ . '/../../services/BroadcastService.php';

header('Content-Type: application/json; charset=utf-8');

// ── Dual-auth helper ──────────────────────────────────────────────────────────

/**
 * Try JWT Bearer first, then fall back to LGU session.
 * Returns ['type' => 'evacuee'|'lgu', 'id' => int, 'role' => string]
 * Calls errorAuthInvalid() / errorSessionExpired() on failure.
 */
function tryAuth(): array
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

    if (strpos($header, 'Bearer ') === 0) {
        $token = substr($header, 7);
        try {
            $payload = JwtService::verify($token);
        } catch (\Exception $e) {
            if (strpos($e->getMessage(), 'expired') !== false) {
                errorSessionExpired();
            }
            errorAuthInvalid();
        }
        return [
            'type' => 'evacuee',
            'id'   => (int)$payload['user_id'],
            'role' => $payload['role'] ?? 'evacuee',
        ];
    }

    // Fall back to LGU session
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    $lguUser = $_SESSION['lgu_user'] ?? null;

    if ($lguUser === null) {
        errorAuthInvalid();
    }

    $timeout = defined('LGU_SESSION_TIMEOUT') ? LGU_SESSION_TIMEOUT : 3600;
    if ((time() - (int)$lguUser['last_activity']) > $timeout) {
        unset($_SESSION['lgu_user']);
        errorSessionExpired();
    }

    $_SESSION['lgu_user']['last_activity'] = time();

    return [
        'type' => 'lgu',
        'id'   => (int)$lguUser['id'],
        'role' => $lguUser['role'] ?? 'lgu',
    ];
}

// ── Route ─────────────────────────────────────────────────────────────────────

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    handleGet();
} elseif ($method === 'POST') {
    handlePost();
} else {
    http_response_code(405);
    exit;
}

// ── GET handler ───────────────────────────────────────────────────────────────

function handleGet(): void
{
    $auth = tryAuth();
    $pdo  = Database::getInstance();

    $selfType = $auth['type'];
    $selfId   = $auth['id'];

    $withId = isset($_GET['with']) ? (int)$_GET['with'] : 0;

    if ($withId > 0) {
        // Fetch thread between self and a specific user
        $stmt = $pdo->prepare(
            'SELECT cm.id, cm.sender_type, cm.sender_id, cm.recipient_type, cm.recipient_id, cm.body, cm.sent_at,
                    COALESCE(u.full_name, CONCAT("LGU #", la.id)) AS sender_name,
                    COALESCE(u.status, la.role) AS sender_role
             FROM chat_messages cm
             LEFT JOIN users u ON cm.sender_type = "evacuee" AND cm.sender_id = u.id
             LEFT JOIN lgu_accounts la ON cm.sender_type = "lgu" AND cm.sender_id = la.id
             WHERE (cm.sender_type = ? AND cm.sender_id = ? AND cm.recipient_id = ?)
                OR (cm.sender_id = ? AND cm.recipient_id = ? AND cm.recipient_type = ?)
             ORDER BY cm.sent_at ASC
             LIMIT 200'
        );
        $stmt->execute([$selfType, $selfId, $withId, $withId, $selfId, $selfType]);
    } else {
        // Broadcast / group chat — return recent messages visible to this user
        $stmt = $pdo->prepare(
            'SELECT cm.id, cm.sender_type, cm.sender_id, cm.recipient_type, cm.recipient_id, cm.body, cm.sent_at,
                    COALESCE(u.full_name, la.username) AS sender_name,
                    COALESCE(u.status, la.role) AS sender_role,
                    u.avatar_path AS avatar_path
             FROM chat_messages cm
             LEFT JOIN users u ON cm.sender_type = "evacuee" AND cm.sender_id = u.id
             LEFT JOIN lgu_accounts la ON cm.sender_type = "lgu" AND cm.sender_id = la.id
             WHERE cm.recipient_type = "broadcast"
                OR (cm.recipient_type = ? AND cm.recipient_id = ?)
                OR (cm.sender_type = ? AND cm.sender_id = ?)
             ORDER BY cm.sent_at ASC
             LIMIT 200'
        );
        $stmt->execute([$selfType, $selfId, $selfType, $selfId]);
    }

    $messages = $stmt->fetchAll();

    // Cast IDs
    foreach ($messages as &$m) {
        $m['id']        = (int)$m['id'];
        $m['sender_id'] = (int)$m['sender_id'];
    }
    unset($m);

    // Mark undelivered messages addressed to the requesting user as delivered now
    $now = date('Y-m-d H:i:s');
    $pdo->prepare(
        'UPDATE chat_messages SET delivered_at = ?
         WHERE recipient_type = ? AND recipient_id = ? AND delivered_at IS NULL'
    )->execute([$now, $selfType, $selfId]);

    jsonSuccess($messages);
}

// ── POST handler ──────────────────────────────────────────────────────────────

function handlePost(): void
{
    $auth = tryAuth();
    $pdo  = Database::getInstance();

    $body    = json_decode(file_get_contents('php://input'), true) ?? [];
    $msgBody = isset($body['body']) ? trim($body['body'])
             : (isset($body['message']) ? trim($body['message']) : null);

    if ($msgBody === null || $msgBody === '') {
        errorValidation(['body' => 'Message body is required.']);
    }

    $senderType = $auth['type'];
    $senderId   = $auth['id'];

    // Evacuees send to broadcast (visible to all LGU)
    $recipientType = $body['recipient_type'] ?? 'broadcast';
    $recipientId   = isset($body['recipient_id']) ? (int)$body['recipient_id'] : null;

    $now = date('Y-m-d H:i:s');

    $stmt = $pdo->prepare(
        'INSERT INTO chat_messages (sender_type, sender_id, recipient_type, recipient_id, body, sent_at)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$senderType, $senderId, $recipientType, $recipientId, $msgBody, $now]);
    $messageId = (int)$pdo->lastInsertId();

    // Get sender name + avatar
    if ($senderType === 'evacuee') {
        $row = $pdo->prepare('SELECT full_name AS name, avatar_path FROM users WHERE id = ? LIMIT 1');
    } else {
        $row = $pdo->prepare('SELECT username AS name, NULL AS avatar_path FROM lgu_accounts WHERE id = ? LIMIT 1');
    }
    $row->execute([$senderId]);
    $senderRow  = $row->fetch();
    $senderName = $senderRow['name'] ?? 'Unknown';
    $avatarPath = $senderRow['avatar_path'] ?? null;

    broadcastEvent([
        'type'          => 'chat_message',
        'id'            => $messageId,
        'sender_type'   => $senderType,
        'sender_id'     => $senderId,
        'sender_name'   => $senderName,
        'avatar_path'   => $avatarPath,
        'recipient_type'=> $recipientType,
        'recipient_id'  => $recipientId,
        'body'          => $msgBody,
        'sent_at'       => date('c'),
    ]);

    jsonSuccess([
        'id'             => $messageId,
        'sender_type'    => $senderType,
        'sender_id'      => $senderId,
        'sender_name'    => $senderName,
        'avatar_path'    => $avatarPath,
        'recipient_type' => $recipientType,
        'recipient_id'   => $recipientId,
        'body'           => $msgBody,
        'sent_at'        => $now,
    ], 201);
}
