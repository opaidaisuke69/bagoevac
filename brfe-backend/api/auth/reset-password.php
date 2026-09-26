<?php
/**
 * POST /api/auth/reset-password
 * Verifies a reset code and sets a new password.
 * Body: { email, code, password }
 */

require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../services/OtpService.php';

header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }

$body     = json_decode(file_get_contents('php://input'), true) ?? [];
$email    = strtolower(trim($body['email'] ?? ''));
$code     = trim($body['code'] ?? '');
$password = $body['password'] ?? '';

$errors = [];
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Enter a valid email address.';
}
if ($code === '' || !preg_match('/^\d{6}$/', $code)) {
    $errors['code'] = 'Enter the 6-digit code.';
}
if ($password === '' || strlen($password) < 6) {
    $errors['password'] = 'Password must be at least 6 characters.';
}
if (!empty($errors)) {
    errorValidation($errors);
}

$pdo  = Database::getInstance();
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$user = $stmt->fetch();

// Verify the code (consumes it on success).
$check = OtpService::verify($email, OtpService::PURPOSE_RESET, $code);
if (!$check['ok']) {
    $map = [
        'NOT_FOUND' => 'No reset request found. Request a new code.',
        'EXPIRED'   => 'This code has expired. Request a new one.',
        'TOO_MANY'  => 'Too many attempts. Request a new code.',
        'INVALID'   => 'Incorrect code. Please try again.',
    ];
    jsonError('CODE_' . $check['error'], $map[$check['error']] ?? 'Invalid code.', 400);
}

// The code was valid. Update the password if the user still exists.
if ($user) {
    $hash = password_hash($password, PASSWORD_BCRYPT);
    // Invalidate existing sessions by clearing the stored token hash.
    $pdo->prepare('UPDATE users SET password_hash = ?, token_hash = NULL WHERE id = ?')
        ->execute([$hash, (int)$user['id']]);
}

jsonSuccess(['ok' => true, 'message' => 'Your password has been reset. You can now sign in.']);
