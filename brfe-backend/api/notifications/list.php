<?php
/**
 * GET /api/notifications/list
 * Returns notifications for the authenticated evacuee, newest first.
 * Optional ?unread_only=1 to filter unread.
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

$pdo    = Database::getInstance();
$where  = ['user_id = ?'];
$params = [$userId];

if (!empty($_GET['unread_only'])) {
    $where[]  = 'is_read = 0';
}

$sql = 'SELECT id, type, title, body, data, is_read, created_at
        FROM notifications
        WHERE ' . implode(' AND ', $where) . '
        ORDER BY created_at DESC
        LIMIT 50';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

foreach ($rows as &$n) {
    $n['id']      = (int)$n['id'];
    $n['is_read'] = (bool)$n['is_read'];
    $n['data']    = $n['data'] ? json_decode($n['data'], true) : null;
}
unset($n);

// Unread count
$cStmt = $pdo->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0');
$cStmt->execute([$userId]);
$unreadCount = (int)$cStmt->fetchColumn();

jsonSuccess(['notifications' => $rows, 'unread_count' => $unreadCount]);
