<?php
require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    exit;
}

requireAuth();

$auth = $GLOBALS['auth_user'];
$role = $auth['role'] ?? '';

$id = isset($_GET['id']) ? (int)$_GET['id'] : (int)($auth['user_id'] ?? 0);

if ($id < 1) {
    errorValidation(['id' => 'A valid user ID is required.']);
}

if ($role === 'evacuee' && (int)$auth['user_id'] !== $id) {
    errorForbidden();
}

if ($role !== 'evacuee' && $role !== 'LGU_Admin' && $role !== 'Barangay_Official') {
    errorForbidden();
}

$pdo  = Database::getInstance();
$stmt = $pdo->prepare(
    'SELECT id, full_name, username, email, age, address, barangay_id, contact_no,
            emerg_name, emerg_no, status, avatar_path, created_at
     FROM users
     WHERE id = ?
     LIMIT 1'
);
$stmt->execute([$id]);
$user = $stmt->fetch();

if (!$user) {
    errorNotFound();
}

$user['id']          = (int)$user['id'];
$user['age']         = (int)$user['age'];
$user['barangay_id'] = (int)$user['barangay_id'];

jsonSuccess($user);
