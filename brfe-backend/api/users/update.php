<?php
require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    exit;
}

requireAuth();

$auth = $GLOBALS['auth_user'];

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if ($id < 1) {
    errorValidation(['id' => 'A valid user ID is required.']);
}

if ((int)$auth['user_id'] !== $id) {
    errorForbidden();
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];

// ── Field validation ──────────────────────────────────────────────────────────

$errors = [];

$full_name   = trim($body['full_name']   ?? '');
$username    = isset($body['username']) ? trim($body['username']) : null;
$email       = isset($body['email'])    ? trim($body['email'])    : null;
$age         = $body['age']              ?? null;
$address     = trim($body['address']     ?? '');
$barangay_id = $body['barangay_id']      ?? null;
$emerg_name  = trim($body['emerg_name']  ?? '');
$emerg_no    = trim($body['emerg_no']    ?? '');

if ($full_name === '') {
    $errors['full_name'] = 'Full name is required.';
}

if ($username === null || $username === '') {
    $errors['username'] = 'Username is required.';
} elseif (!preg_match('/^[a-zA-Z0-9._]{3,30}$/', $username)) {
    $errors['username'] = 'Username must be 3–30 characters (letters, numbers, . or _).';
}

if ($email !== null && $email !== '') {
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Enter a valid email address.';
    }
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

if ($emerg_name === '') {
    $errors['emerg_name'] = 'Emergency contact name is required.';
}

if ($emerg_no === '') {
    $errors['emerg_no'] = 'Emergency contact number is required.';
}

if (!empty($errors)) {
    errorValidation($errors);
}

// ── Uniqueness checks ─────────────────────────────────────────────────────────

$pdo = Database::getInstance();

$stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1');
$stmt->execute([$username, $id]);
if ($stmt->fetch()) {
    errorValidation(['username' => 'This username is already taken.']);
}

if ($email !== null && $email !== '') {
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1');
    $stmt->execute([$email, $id]);
    if ($stmt->fetch()) {
        errorValidation(['email' => 'This email address is already in use.']);
    }
}

// ── Verify barangay_id exists ─────────────────────────────────────────────────

$stmt = $pdo->prepare('SELECT id FROM barangays WHERE id = ? LIMIT 1');
$stmt->execute([(int)$barangay_id]);
if (!$stmt->fetch()) {
    errorFkViolation();
}

$stmt = $pdo->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
$stmt->execute([$id]);
if (!$stmt->fetch()) {
    errorNotFound();
}

// ── Persist update ────────────────────────────────────────────────────────────

$stmt = $pdo->prepare(
    'UPDATE users
     SET full_name = ?, username = ?, email = ?, age = ?, address = ?, barangay_id = ?,
         emerg_name = ?, emerg_no = ?
     WHERE id = ?'
);
$stmt->execute([
    $full_name,
    $username,
    ($email !== null && $email !== '') ? $email : null,
    (int)$age,
    $address,
    (int)$barangay_id,
    $emerg_name,
    $emerg_no,
    $id,
]);

// ── Return updated profile ────────────────────────────────────────────────────

$stmt = $pdo->prepare(
    'SELECT id, full_name, username, email, age, address, barangay_id, contact_no,
            emerg_name, emerg_no, status, avatar_path, created_at
     FROM users
     WHERE id = ?
     LIMIT 1'
);
$stmt->execute([$id]);
$user = $stmt->fetch();

$user['id']          = (int)$user['id'];
$user['age']         = (int)$user['age'];
$user['barangay_id'] = (int)$user['barangay_id'];

jsonSuccess($user);
