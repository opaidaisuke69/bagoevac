<?php
/**
 * POST /api/users/create_lgu — LGU_Admin / Barangay_Official creates an evacuee.
 *
 * Mirrors self-registration (api/auth/register.php) but is admin-authenticated
 * and does NOT issue a token. Barangay_Official may only create evacuees in
 * their own barangay.
 *
 * Body: { full_name, username, password, age, address, barangay_id,
 *         contact_no, emerg_name, emerg_no, email?, lat?, lng? }
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/lgu_auth.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }

requireLguAuth();
$lguUser = $GLOBALS['lgu_user'];
$isAdmin = ($lguUser['role'] === 'LGU_Admin');
$myBrgy  = (int)($lguUser['barangay_id'] ?? 0);

if (!$isAdmin && $lguUser['role'] !== 'Barangay_Official') {
    errorForbidden();
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];

$full_name   = trim($body['full_name']  ?? '');
$username    = trim($body['username']   ?? '');
$email       = trim($body['email']      ?? '');
$age         = $body['age']             ?? null;
$address     = trim($body['address']    ?? '');
$barangay_id = $body['barangay_id']     ?? null;
$contact_no  = trim($body['contact_no'] ?? '');
$emerg_name  = trim($body['emerg_name'] ?? '');
$emerg_no    = trim($body['emerg_no']   ?? '');
$password    = $body['password']        ?? '';
$lat         = $body['lat']             ?? null;
$lng         = $body['lng']             ?? null;

// Barangay_Official is forced to their own barangay.
if (!$isAdmin) {
    $barangay_id = $myBrgy;
}

// ── Validation ────────────────────────────────────────────────────────────────
$errors = [];

if ($full_name === '') $errors['full_name'] = 'Full name is required.';

if ($username === '') {
    $errors['username'] = 'Username is required.';
} elseif (!preg_match('/^[a-zA-Z0-9._]{3,30}$/', $username)) {
    $errors['username'] = 'Username must be 3–30 characters (letters, numbers, . or _).';
}

if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Enter a valid email address.';
}

if ($age === null || $age === '') {
    $errors['age'] = 'Age is required.';
} elseif (!is_numeric($age) || (int)$age < 1 || (int)$age > 150) {
    $errors['age'] = 'Age must be between 1 and 150.';
}

if ($address === '') $errors['address'] = 'Address is required.';

if ($barangay_id === null || $barangay_id === '' || !is_numeric($barangay_id) || (int)$barangay_id < 1) {
    $errors['barangay_id'] = 'Barangay is required.';
}

if ($contact_no === '') $errors['contact_no'] = 'Contact number is required.';
if ($emerg_name === '') $errors['emerg_name'] = 'Emergency contact name is required.';
if ($emerg_no === '')   $errors['emerg_no']   = 'Emergency contact number is required.';

if (strlen($password) < 6) {
    $errors['password'] = 'Password must be at least 6 characters.';
}

if ($lat !== null && $lat !== '' && !is_numeric($lat)) $errors['lat'] = 'Latitude must be a number.';
if ($lng !== null && $lng !== '' && !is_numeric($lng)) $errors['lng'] = 'Longitude must be a number.';

if (!empty($errors)) {
    errorValidation($errors);
}

$pdo = Database::getInstance();

// ── Duplicate checks ──────────────────────────────────────────────────────────
$stmt = $pdo->prepare('SELECT id FROM users WHERE contact_no = ? LIMIT 1');
$stmt->execute([$contact_no]);
if ($stmt->fetch()) errorValidation(['contact_no' => 'This contact number is already registered.']);

$stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
$stmt->execute([$username]);
if ($stmt->fetch()) errorValidation(['username' => 'This username is already taken.']);

if ($email !== '') {
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    if ($stmt->fetch()) errorValidation(['email' => 'This email address is already registered.']);
}

// Verify barangay exists (and, for officials, matches their own).
$stmt = $pdo->prepare('SELECT id FROM barangays WHERE id = ? LIMIT 1');
$stmt->execute([(int)$barangay_id]);
if (!$stmt->fetch()) errorValidation(['barangay_id' => 'Invalid barangay selected.']);

// ── Insert ────────────────────────────────────────────────────────────────────
$password_hash = password_hash($password, PASSWORD_BCRYPT);
$lat_val = ($lat !== null && $lat !== '') ? (float)$lat : null;
$lng_val = ($lng !== null && $lng !== '') ? (float)$lng : null;

$stmt = $pdo->prepare(
    'INSERT INTO users (full_name, username, email, age, address, barangay_id, contact_no, emerg_name, emerg_no, password_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
$stmt->execute([
    $full_name,
    $username,
    $email !== '' ? $email : null,
    (int)$age,
    $address,
    (int)$barangay_id,
    $contact_no,
    $emerg_name,
    $emerg_no,
    $password_hash,
]);

$user_id = (int)$pdo->lastInsertId();

// Seed default status row (mirrors register.php).
$pdo->prepare('INSERT INTO status_updates (user_id, status) VALUES (?, \'Safe\')')->execute([$user_id]);

if ($lat_val !== null && $lng_val !== null) {
    $pdo->prepare('INSERT INTO locations (user_id, lat, lng) VALUES (?, ?, ?)')
        ->execute([$user_id, $lat_val, $lng_val]);
}

jsonSuccess([
    'id'          => $user_id,
    'full_name'   => $full_name,
    'username'    => $username,
    'barangay_id' => (int)$barangay_id,
], 201);
