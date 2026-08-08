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

// ── Resolve target user ID ────────────────────────────────────────────────────

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if ($id < 1) {
    errorValidation(['id' => 'A valid user ID is required.']);
}

// ── Authorization: only the authenticated evacuee may update their own status ──

if ((int)$auth['user_id'] !== $id) {
    errorForbidden();
}

// ── Parse body ────────────────────────────────────────────────────────────────

$body   = json_decode(file_get_contents('php://input'), true) ?? [];
$status = $body['status'] ?? '';

// ── Validate status enum ──────────────────────────────────────────────────────

$allowed = ['Safe', 'Need_Assistance', 'In_Danger'];

if (!in_array($status, $allowed, true)) {
    errorValidation(['status' => 'Status must be one of: Safe, Need_Assistance, In_Danger.']);
}

// ── Verify user exists ────────────────────────────────────────────────────────

$pdo  = Database::getInstance();
$stmt = $pdo->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
$stmt->execute([$id]);
if (!$stmt->fetch()) {
    errorNotFound();
}

// ── Persist status change ─────────────────────────────────────────────────────

$now = date('Y-m-d H:i:s');

$pdo->prepare('UPDATE users SET status = ? WHERE id = ?')
    ->execute([$status, $id]);

// Upsert status_updates — one row per user, updated on each change
$existing = $pdo->prepare('SELECT id FROM status_updates WHERE user_id = ? LIMIT 1');
$existing->execute([$id]);

if ($existing->fetch()) {
    $pdo->prepare('UPDATE status_updates SET status = ?, changed_at = ? WHERE user_id = ?')
        ->execute([$status, $now, $id]);
} else {
    $pdo->prepare('INSERT INTO status_updates (user_id, status, changed_at) VALUES (?, ?, ?)')
        ->execute([$id, $status, $now]);
}

// ── Broadcast WebSocket event ─────────────────────────────────────────────────

broadcastEvent([
    'type'   => 'status_change',
    'userId' => $id,
    'status' => $status,
    'ts'     => gmdate('c'),
]);

jsonSuccess([
    'user_id'    => $id,
    'status'     => $status,
    'changed_at' => $now,
]);


