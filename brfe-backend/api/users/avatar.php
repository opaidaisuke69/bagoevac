<?php
require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); exit;
}

requireAuth();
$auth   = $GLOBALS['auth_user'];
$userId = (int)($auth['user_id'] ?? 0);

if (empty($_FILES['avatar'])) {
    errorValidation(['avatar' => 'No file uploaded.']);
}

$file  = $_FILES['avatar'];
$error = $file['error'] ?? UPLOAD_ERR_NO_FILE;

if ($error !== UPLOAD_ERR_OK) {
    errorValidation(['avatar' => 'Upload failed (code ' . $error . ').']);
}

// Validate type
$allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
$finfo   = finfo_open(FILEINFO_MIME_TYPE);
$mime    = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mime, $allowed, true)) {
    errorValidation(['avatar' => 'Only JPEG, PNG, WebP or GIF images are allowed.']);
}

// Max 5 MB
if ($file['size'] > 5 * 1024 * 1024) {
    errorValidation(['avatar' => 'Image must be under 5 MB.']);
}

$uploadDir = __DIR__ . '/../../uploads/avatars/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$ext      = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';
$filename = 'avatar_' . $userId . '_' . time() . '.' . strtolower($ext);
$destPath = $uploadDir . $filename;

if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    jsonError('UPLOAD_FAILED', 'Could not save the uploaded file.', 500);
}

// Delete old avatar if exists
$pdo  = Database::getInstance();
$stmt = $pdo->prepare('SELECT avatar_path FROM users WHERE id = ? LIMIT 1');
$stmt->execute([$userId]);
$row  = $stmt->fetch();
if ($row && $row['avatar_path']) {
    $oldPath = __DIR__ . '/../../' . $row['avatar_path'];
    if (file_exists($oldPath)) @unlink($oldPath);
}

$relativePath = 'uploads/avatars/' . $filename;
$pdo->prepare('UPDATE users SET avatar_path = ? WHERE id = ?')
    ->execute([$relativePath, $userId]);

$avatarUrl = rtrim(API_BASE_URL ?? '', '/') . '/' . $relativePath;

jsonSuccess(['avatar_path' => $relativePath, 'avatar_url' => $avatarUrl]);
