<?php
/**
 * GET /api/users/list-all
 * Returns ALL registered evacuees (regardless of online status) with last known GPS.
 * LGU_Admin: can filter by any barangay_id or see all.
 * Barangay_Official: scoped to their own barangay only (enforced server-side).
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/barangay_scope.php';

header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); exit; }

requireLguAuth();

$pdo    = Database::getInstance();
$where  = ['1=1'];
$params = [];

// Barangay scoping — Barangay_Official is locked to their barangay
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

$sql = 'SELECT u.id, u.full_name, u.age, u.contact_no, u.status,
               u.avatar_path, u.barangay_id,
               b.name AS barangay_name,
               l.lat AS latitude, l.lng AS longitude, l.recorded_at AS last_location_at
        FROM users u
        INNER JOIN barangays b ON b.id = u.barangay_id
        LEFT JOIN locations l ON l.user_id = u.id
        WHERE ' . implode(' AND ', $where) . '
        ORDER BY u.full_name ASC';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$users = $stmt->fetchAll();

foreach ($users as &$u) {
    $u['id']        = (int)$u['id'];
    $u['age']       = (int)$u['age'];
    $u['latitude']  = $u['latitude']  !== null ? (float)$u['latitude']  : null;
    $u['longitude'] = $u['longitude'] !== null ? (float)$u['longitude'] : null;
}
unset($u);

jsonSuccess(['data' => $users, 'total' => count($users)]);
