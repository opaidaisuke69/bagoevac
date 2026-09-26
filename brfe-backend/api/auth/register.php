<?php
require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../services/JwtService.php';
require_once __DIR__ . '/../../services/OtpService.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];

// ── Field validation ──────────────────────────────────────────────────────────

$errors = [];

$full_name   = trim($body['full_name']   ?? '');
$username    = trim($body['username']    ?? '');
$email       = trim($body['email']       ?? '');
$code        = trim($body['code']        ?? '');
$age         = $body['age']              ?? null;
$address     = trim($body['address']     ?? '');
$barangay_id = $body['barangay_id']      ?? null;
$contact_no  = trim($body['contact_no']  ?? '');
$emerg_name  = trim($body['emerg_name']  ?? '');
$emerg_no    = trim($body['emerg_no']    ?? '');
$password    = $body['password']         ?? '';
$lat         = $body['lat']              ?? null;
$lng         = $body['lng']              ?? null;

if ($full_name === '') {
    $errors['full_name'] = 'Full name is required.';
}

if ($username === '') {
    $errors['username'] = 'Username is required.';
} elseif (!preg_match('/^[a-zA-Z0-9._]{3,30}$/', $username)) {
    $errors['username'] = 'Username must be 3–30 characters (letters, numbers, . or _).';
}

if ($email === '') {
    $errors['email'] = 'Email address is required.';
} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Enter a valid email address.';
}

if ($code === '' || !preg_match('/^\d{6}$/', $code)) {
    $errors['code'] = 'Enter the 6-digit verification code sent to your email.';
}

if ($age === null || $age === '') {
    $errors['age'] = 'Age is required.';
} elseif (!is_numeric($age) || (int)$age < 1 || (int)$age > 150) {
    $errors['age'] = 'Age must be a valid number between 1 and 150.';
}

if ($address === '') {
    $errors['address'] = 'Address is required.';
}

if ($barangay_id === null || $barangay_id === '') {
    $errors['barangay_id'] = 'Barangay is required.';
} elseif (!is_numeric($barangay_id) || (int)$barangay_id < 1) {
    $errors['barangay_id'] = 'Barangay ID must be a positive integer.';
}

if ($contact_no === '') {
    $errors['contact_no'] = 'Contact number is required.';
}

if ($emerg_name === '') {
    $errors['emerg_name'] = 'Emergency contact name is required.';
}

if ($emerg_no === '') {
    $errors['emerg_no'] = 'Emergency contact number is required.';
}

if ($password === '') {
    $errors['password'] = 'Password is required.';
}

if ($lat !== null && $lat !== '' && !is_numeric($lat)) {
    $errors['lat'] = 'Latitude must be a valid number.';
}
if ($lng !== null && $lng !== '' && !is_numeric($lng)) {
    $errors['lng'] = 'Longitude must be a valid number.';
}

if (!empty($errors)) {
    errorValidation($errors);
}

// ── Duplicate checks ──────────────────────────────────────────────────────────

$pdo = Database::getInstance();

$stmt = $pdo->prepare('SELECT id FROM users WHERE contact_no = ? LIMIT 1');
$stmt->execute([$contact_no]);
if ($stmt->fetch()) {
    jsonError('DUPLICATE', 'This contact number is already registered.', 409);
}

$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    jsonError('DUPLICATE', 'This email address is already registered.', 409);
}

$stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
$stmt->execute([$username]);
if ($stmt->fetch()) {
    jsonError('DUPLICATE', 'This username is already taken.', 409);
}

// ── Verify barangay_id exists ─────────────────────────────────────────────────

$stmt = $pdo->prepare('SELECT id FROM barangays WHERE id = ? LIMIT 1');
$stmt->execute([(int)$barangay_id]);
if (!$stmt->fetch()) {
    jsonError('VALIDATION', 'Invalid barangay selected.', 422);
}

// ── Verify the email code (before creating anything) ──────────────────────────

$check = OtpService::verify($email, OtpService::PURPOSE_REGISTER, $code);
if (!$check['ok']) {
    $map = [
        'NOT_FOUND' => 'No verification code found for this email. Request a new one.',
        'EXPIRED'   => 'Your verification code has expired. Request a new one.',
        'TOO_MANY'  => 'Too many incorrect attempts. Request a new code.',
        'INVALID'   => 'Incorrect verification code. Please try again.',
    ];
    errorValidation(['code' => $map[$check['error']] ?? 'Invalid verification code.']);
}

// ── Insert user ───────────────────────────────────────────────────────────────

$password_hash = password_hash($password, PASSWORD_BCRYPT);

$lat_val = ($lat !== null && $lat !== '') ? (float)$lat : null;
$lng_val = ($lng !== null && $lng !== '') ? (float)$lng : null;

$stmt = $pdo->prepare(
    'INSERT INTO users (full_name, username, email, email_verified, age, address, barangay_id, contact_no, emerg_name, emerg_no, password_hash)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)'
);
$stmt->execute([
    $full_name,
    $username,
    $email,
    (int)$age,
    $address,
    (int)$barangay_id,
    $contact_no,
    $emerg_name,
    $emerg_no,
    $password_hash,
]);

$user_id = (int)$pdo->lastInsertId();

// Seed default status_updates row (idempotent — a stale row for this id must
// not break registration).
$pdo->prepare(
    'INSERT INTO status_updates (user_id, status) VALUES (?, \'Safe\')
     ON DUPLICATE KEY UPDATE status = VALUES(status)'
)->execute([$user_id]);

if ($lat_val !== null && $lng_val !== null) {
    // locations has a UNIQUE key on user_id — upsert so a pre-existing row
    // (e.g. from GPS posting) is updated instead of throwing a duplicate error.
    $pdo->prepare(
        'INSERT INTO locations (user_id, lat, lng) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE lat = VALUES(lat), lng = VALUES(lng)'
    )->execute([$user_id, $lat_val, $lng_val]);
}

// ── Issue JWT ─────────────────────────────────────────────────────────────────

$token = JwtService::encode([
    'user_id'    => $user_id,
    'contact_no' => $contact_no,
    'role'       => 'evacuee',
]);

$token_hash = hash('sha256', $token);
$pdo->prepare('UPDATE users SET token_hash = ? WHERE id = ?')
    ->execute([$token_hash, $user_id]);

jsonSuccess(['token' => $token], 201);
