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

requireAuth();

$auth = $GLOBALS['auth_user'];
$userId = (int)($auth['user_id'] ?? 0);

$body = json_decode(file_get_contents('php://input'), true) ?? [];

$current  = $body['current_password']  ?? '';
$newPass  = $body['new_password']      ?? '';
$confirm  = $body['confirm_password']  ?? '';

$errors = [];

if ($current === '') $errors['current_password'] = 'Current password is required.';
if ($newPass === '') $errors['new_password'] = 'New password is required.';
elseif (strlen($newPass) < 6) $errors['new_password'] = 'Password must be at least 6 characters.';
if ($confirm === '') $errors['confirm_password'] = 'Please confirm your new password.';
elseif ($newPass !== $confirm) $errors['confirm_password'] = 'Passwords do not match.';

if (!empty($errors)) {
    errorValidation($errors);
}

$pdo  = Database::getInstance();
$stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ? LIMIT 1');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user || !password_verify($current, $user['password_hash'])) {
    errorValidation(['current_password' => 'Current password is incorrect.']);
}

$newHash = password_hash($newPass, PASSWORD_DEFAULT);
$pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    ->execute([$newHash, $userId]);

jsonSuccess(['message' => 'Password changed successfully.']);
