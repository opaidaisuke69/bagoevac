<?php
require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

// Verify the token is valid before invalidating it
requireAuth();

$user_id = (int)($GLOBALS['auth_user']['user_id'] ?? 0);

$pdo = Database::getInstance();
$pdo->prepare('UPDATE users SET token_hash = NULL WHERE id = ?')
    ->execute([$user_id]);

jsonSuccess(['message' => 'Logged out successfully.']);
