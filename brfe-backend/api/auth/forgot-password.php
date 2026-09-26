<?php
/**
 * POST /api/auth/forgot-password
 * Sends a password-reset code to the account email — if it exists.
 * Body: { email }
 *
 * Always returns success (even for unknown emails) to avoid leaking which
 * addresses have accounts. A code is only actually sent for real accounts.
 */

require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../services/OtpService.php';
require_once __DIR__ . '/../../services/MailService.php';

header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }

$body  = json_decode(file_get_contents('php://input'), true) ?? [];
$email = strtolower(trim($body['email'] ?? ''));

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    errorValidation(['email' => 'Enter a valid email address.']);
}

$pdo  = Database::getInstance();
$stmt = $pdo->prepare('SELECT id, full_name FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$user = $stmt->fetch();

$codeToSend = null;
$sendName   = '';
if ($user) {
    try {
        $result     = OtpService::issue($email, OtpService::PURPOSE_RESET);
        $codeToSend = $result['code'];
        $sendName   = $user['full_name'] ?? '';
    } catch (\RuntimeException $e) {
        // Cooldown or generation error — swallow so the response stays uniform.
        if (strncmp($e->getMessage(), 'COOLDOWN:', 9) === 0) {
            $wait = (int)substr($e->getMessage(), 9);
            jsonError('COOLDOWN', "Please wait {$wait}s before requesting another code.", 429);
        }
    }
}

// Uniform response regardless of whether the email exists. Send the (slow)
// email after the response is flushed so the client never waits on SMTP.
jsonSuccessThen(
    [
        'ok'         => true,
        'message'    => 'If that email is registered, a reset code has been sent.',
        'expires_in' => OTP_TTL_SECONDS,
    ],
    function () use ($email, $codeToSend, $sendName) {
        if ($codeToSend !== null) {
            MailService::sendPasswordResetCode($email, $codeToSend, $sendName);
        }
    }
);
