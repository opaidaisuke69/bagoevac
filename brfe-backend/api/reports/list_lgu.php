<?php
/** GET /api/reports/list_lgu — List disaster reports for LGU web panel (session auth). */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/barangay_scope.php'; // also loads lgu_auth

header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); exit; }
requireLguAuth();

$pdo    = Database::getInstance();
$where  = ['1=1'];
$params = [];

// Barangay scoping — Barangay_Official locked to their barangay
$scope = getBarangayScopeClause('u');
if ($scope['clause'] !== '') {
    $where[]  = ltrim($scope['clause'], 'AND ');
    $params   = array_merge($params, $scope['params']);
} elseif (!empty($_GET['barangay_id'])) {
    $where[]  = 'u.barangay_id = ?';
    $params[] = (int)$_GET['barangay_id'];
}

$validLevels = ['Low', 'Moderate', 'High', 'Critical'];
if (!empty($_GET['flood_level']) && in_array($_GET['flood_level'], $validLevels, true)) {
    $where[]  = 'r.flood_level = ?';
    $params[] = $_GET['flood_level'];
}

$sql = 'SELECT r.id, r.user_id, r.flood_level, r.description, r.photo_path,
               r.lat AS latitude, r.lng AS longitude, r.submitted_at,
               u.full_name, u.status AS user_status, b.name AS barangay_name
        FROM reports r
        JOIN users u ON u.id = r.user_id
        LEFT JOIN barangays b ON b.id = u.barangay_id
        WHERE ' . implode(' AND ', $where) . '
        ORDER BY r.submitted_at DESC';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$reports = $stmt->fetchAll();

foreach ($reports as &$r) {
    $r['id']        = (int)$r['id'];
    $r['user_id']   = (int)$r['user_id'];
    $r['latitude']  = (float)$r['latitude'];
    $r['longitude'] = (float)$r['longitude'];
}
unset($r);

// Counts by flood level
$cntStmt = $pdo->prepare(
    'SELECT r.flood_level, COUNT(*) AS cnt FROM reports r JOIN users u ON u.id = r.user_id WHERE ' . implode(' AND ', $where) . ' GROUP BY r.flood_level'
);
$cntStmt->execute($params);
$counts = ['Low' => 0, 'Moderate' => 0, 'High' => 0, 'Critical' => 0];
foreach ($cntStmt->fetchAll() as $row) { $counts[$row['flood_level']] = (int)$row['cnt']; }

jsonSuccess(['data' => $reports, 'counts' => $counts]);
