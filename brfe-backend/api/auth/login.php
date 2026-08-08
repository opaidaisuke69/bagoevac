<?php
require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../services/JwtService.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];

$identifier = trim($body['identifier'] ?? '');
$password   = $body['password'] ?? '';

if ($identifier === '' || $password === '') {
    jsonError('AUTH_INVALID', 'Username/email and password are required.', 401);
}

$pdo  = Database::getInstance();
$stmt = $pdo->prepare(
    'SELECT id, username, contact_no, email, password_hash, barangay_id FROM users
     WHERE username = ? OR email = ?
     LIMIT 1'
);
$stmt->execute([$identifier, $identifier]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    jsonError('AUTH_INVALID', 'Invalid username or password.', 401);
}

$token = JwtService::encode([
    'user_id'     => (int)$user['id'],
    'username'    => $user['username'],
    'contact_no'  => $user['contact_no'],
    'role'        => 'evacuee',
    'barangay_id' => $user['barangay_id'] ? (int)$user['barangay_id'] : null,
]);

$token_hash = hash('sha256', $token);
$pdo->prepare('UPDATE users SET token_hash = ? WHERE id = ?')
    ->execute([$token_hash, (int)$user['id']]);

jsonSuccess(['token' => $token]);
