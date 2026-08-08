<?php
/**
 * GET /api/lgu/accounts — List LGU/Barangay accounts
 * Supports filters: ?barangay_id=X&role=Y
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/lgu_auth.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    exit;
}

requireLguAuth();

$user = $GLOBALS['lgu_user'];

$pdo = Database::getInstance();

$sql = 'SELECT la.id, la.username, la.role, la.barangay_id, la.created_at,
               b.name AS barangay_name
        FROM lgu_accounts la
        LEFT JOIN barangays b ON la.barangay_id = b.id
        WHERE 1=1';
$params = [];

// Barangay_Official can only see accounts in their own barangay
if ($user['role'] === 'Barangay_Official') {
    $sql .= ' AND la.barangay_id = ?';
    $params[] = $user['barangay_id'];
} elseif (!empty($_GET['barangay_id'])) {
    $sql .= ' AND la.barangay_id = ?';
    $params[] = (int)$_GET['barangay_id'];
}

if (!empty($_GET['role'])) {
    $sql .= ' AND la.role = ?';
    $params[] = $_GET['role'];
}

$sql .= ' ORDER BY la.created_at DESC';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$accounts = $stmt->fetchAll();

jsonSuccess(['data' => $accounts]);
