<?php
/**
 * GET /api/users/list — List all evacuees (LGU use only).
 * Supports filter params: status, barangay_id
 * Barangay_Official is scoped to their own barangay via barangay_scope middleware.
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/barangay_scope.php'; // also loads lgu_auth

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    exit;
}

requireLguAuth();

$pdo    = Database::getInstance();
// "Online" = sent a GPS update within the last 5 minutes
$where  = ['1=1', 'l.recorded_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)'];
$params = [];

// Barangay scoping
$scope = getBarangayScopeClause('u');
if ($scope['clause'] !== '') {
    $where[]  = ltrim($scope['clause'], 'AND ');
    $params   = array_merge($params, $scope['params']);
} elseif (!empty($_GET['barangay_id'])) {
    $where[]  = 'u.barangay_id = ?';
    $params[] = (int)$_GET['barangay_id'];
}

if (!empty($_GET['status'])) {
    $allowed = ['Safe', 'Need_Assistance', 'In_Danger'];
    if (in_array($_GET['status'], $allowed, true)) {
        $where[]  = 'u.status = ?';
        $params[] = $_GET['status'];
    }
}

$sql = 'SELECT u.id, u.full_name, u.age, u.address, u.contact_no,
               u.emerg_name, u.emerg_no, u.status, u.created_at,
               u.avatar_path, u.barangay_id,
               b.name AS barangay_name,
               l.lat AS latitude, l.lng AS longitude, l.recorded_at AS last_location_at
        FROM users u
        INNER JOIN barangays b ON b.id = u.barangay_id
        INNER JOIN locations l ON l.user_id = u.id
        WHERE ' . implode(' AND ', $where) . '
        ORDER BY u.full_name ASC';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$users = $stmt->fetchAll();

foreach ($users as &$u) {
    $u['id']  = (int)$u['id'];
    $u['age'] = (int)$u['age'];
}
unset($u);

jsonSuccess(['data' => $users, 'total' => count($users)]);
