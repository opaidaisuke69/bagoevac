<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../services/JwtService.php';
require_once __DIR__ . '/../../api/response.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$username = trim($body['username'] ?? '');
$password = $body['password'] ?? '';

if ($username === '' || $password === '') {
    jsonError('VALIDATION', 'Username and password are required.', 422);
}

$pdo = Database::getInstance();
$stmt = $pdo->prepare(
    'SELECT a.id, a.username, a.password_hash, a.role, a.barangay_id, b.name AS barangay_name
     FROM lgu_accounts a
     LEFT JOIN barangays b ON b.id = a.barangay_id
     WHERE a.username = ? LIMIT 1'
);
$stmt->execute([$username]);
$account = $stmt->fetch();

if (!$account || !password_verify($password, $account['password_hash'])) {
    jsonError('AUTH_FAILED', 'Invalid username or password.', 401);
}

$tokenPayload = [
    'user_id'       => (int)$account['id'],
    'username'      => $account['username'],
    'role'          => $account['role'],
    'barangay_id'   => $account['barangay_id'] !== null ? (int)$account['barangay_id'] : null,
    'barangay_name' => $account['barangay_name'] ?? null,
];

$token = JwtService::encode($tokenPayload);

jsonSuccess([
    'token' => $token,
    'user'  => $tokenPayload,
]);
