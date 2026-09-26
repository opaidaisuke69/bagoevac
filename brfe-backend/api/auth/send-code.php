<?php
/**
 * POST /api/auth/send-code
 * Sends a 6-digit email-verification code for NEW account registration.
 * Body: { email, full_name? }
 *
 * Fails if the email is already registered (so we don't leak codes to
 * existing accounts and to give the user a clear message).
 */

require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../services/OtpService.php';
require_once __DIR__ . '/../../services/MailService.php';

header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }

$body      = json_decode(file_get_contents('php://input'), true) ?? [];
$email     = strtolower(trim($body['email'] ?? ''));
$full_name = trim($body['full_name'] ?? '');

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    errorValidation(['email' => 'Enter a valid email address.']);
}

$pdo = Database::getInstance();

// Block if already registered.
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    jsonError('DUPLICATE', 'This email address is already registered.', 409);
}

try {
    $result = OtpService::issue($email, OtpService::PURPOSE_REGISTER);
} catch (\RuntimeException $e) {
    if (strncmp($e->getMessage(), 'COOLDOWN:', 9) === 0) {
        $wait = (int)substr($e->getMessage(), 9);
        jsonError('COOLDOWN', "Please wait {$wait}s before requesting another code.", 429);
    }
    jsonError('SERVER', 'Could not generate a verification code.', 500);
}

// The code is already stored, so it's valid immediately. Respond to the client
// now and send the (slow) email afterwards — this avoids mobile network
// timeouts caused by SMTP latency.
$code = $result['code'];
jsonSuccessThen(
    [
        'ok'         => true,
        'message'    => 'Verification code sent.',
        'expires_in' => OTP_TTL_SECONDS,
    ],
    function () use ($email, $code, $full_name) {
        MailService::sendRegistrationCode($email, $code, $full_name);
    }
);
