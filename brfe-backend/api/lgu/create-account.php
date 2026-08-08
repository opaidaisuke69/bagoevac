<?php
/**
 * POST /api/lgu/create-account — Create a new LGU/Barangay/Rescuer account
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/lgu_auth.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

requireLguAuth();

$user = $GLOBALS['lgu_user'];
$body = json_decode(file_get_contents('php://input'), true) ?? [];

$username   = trim($body['username'] ?? '');
$password   = $body['password'] ?? '';
$role       = $body['role'] ?? '';
$barangayId = $body['barangay_id'] ?? null;

// Validate
$errors = [];

if ($username === '') {
    $errors['username'] = 'Username is required.';
}

if (strlen($password) < 6) {
    $errors['password'] = 'Password must be at least 6 characters.';
}

$validRoles = ['Barangay_Official', 'Rescuer'];
if (!in_array($role, $validRoles, true)) {
    $errors['role'] = 'Invalid role.';
}

if (!$barangayId) {
    $errors['barangay_id'] = 'Barangay is required.';
}

// Permission checks
if ($user['role'] === 'Barangay_Official') {
    // Can only create Rescuer accounts in their own barangay
    if ($role !== 'Rescuer') {
        $errors['role'] = 'You can only create Rescuer accounts.';
    }
    if ((int)$barangayId !== (int)$user['barangay_id']) {
        $errors['barangay_id'] = 'You can only create accounts in your own barangay.';
    }
} elseif ($user['role'] !== 'LGU_Admin') {
    errorForbidden();
}

if (!empty($errors)) {
    errorValidation($errors);
}

$pdo = Database::getInstance();

// Check duplicate username
$check = $pdo->prepare('SELECT id FROM lgu_accounts WHERE username = ? LIMIT 1');
$check->execute([$username]);
if ($check->fetch()) {
    errorValidation(['username' => 'Username already exists.']);
}

// Create account
$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = $pdo->prepare(
    'INSERT INTO lgu_accounts (username, password_hash, role, barangay_id) VALUES (?, ?, ?, ?)'
);
$stmt->execute([$username, $hash, $role, (int)$barangayId]);

$newId = (int)$pdo->lastInsertId();

jsonSuccess([
    'id'          => $newId,
    'username'    => $username,
    'role'        => $role,
    'barangay_id' => (int)$barangayId,
], 201);
