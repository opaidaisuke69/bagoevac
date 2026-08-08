<?php
/**
 * PUT /api/notifications/read
 * Body: { id? } — if id omitted, marks ALL as read for the user.
 */
require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') { http_response_code(405); exit; }

requireAuth();
$auth   = $GLOBALS['auth_user'];
$userId = (int)$auth['user_id'];

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$id   = isset($body['id']) ? (int)$body['id'] : null;

$pdo = Database::getInstance();

if ($id) {
    $pdo->prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
        ->execute([$id, $userId]);
} else {
    $pdo->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?')
        ->execute([$userId]);
}

jsonSuccess(['ok' => true]);
