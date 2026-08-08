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

// ── Evacuees and LGU roles may list reports ───────────────────────────────────

$role = $auth['role'] ?? '';
$allowedRoles = ['evacuee', 'LGU_Admin', 'Barangay_Official'];

if (!in_array($role, $allowedRoles, true)) {
    errorForbidden();
}

// ── Parse optional query filters ─────────────────────────────────────────────

$validFloodLevels = ['Low', 'Moderate', 'High', 'Critical'];

$floodLevelFilter = isset($_GET['flood_level']) ? trim($_GET['flood_level']) : null;
$barangayIdFilter = isset($_GET['barangay_id']) ? (int)$_GET['barangay_id'] : null;

if ($floodLevelFilter !== null && !in_array($floodLevelFilter, $validFloodLevels, true)) {
    errorValidation(['flood_level' => 'flood_level must be one of: Low, Moderate, High, Critical.']);
}

if ($barangayIdFilter !== null && $barangayIdFilter < 1) {
    errorValidation(['barangay_id' => 'barangay_id must be a positive integer.']);
}

// ── Build query ───────────────────────────────────────────────────────────────

$pdo    = Database::getInstance();
$where  = [];
$params = [];

if ($floodLevelFilter !== null) {
    $where[]  = 'r.flood_level = ?';
    $params[] = $floodLevelFilter;
}

if ($barangayIdFilter !== null) {
    $where[]  = 'u.barangay_id = ?';
    $params[] = $barangayIdFilter;
}

$whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

$sql = "SELECT r.id, r.user_id, r.flood_level, r.description, r.photo_path,
               r.lat, r.lng, r.submitted_at
        FROM reports r
        JOIN users u ON u.id = r.user_id
        {$whereClause}
        ORDER BY r.submitted_at DESC";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$reports = $stmt->fetchAll();

// Cast numeric fields
foreach ($reports as &$report) {
    $report['id']      = (int)$report['id'];
    $report['user_id'] = (int)$report['user_id'];
    $report['lat']     = (float)$report['lat'];
    $report['lng']     = (float)$report['lng'];
}
unset($report);

// ── Compute counts by flood level ─────────────────────────────────────────────

$countSql = "SELECT r.flood_level, COUNT(*) AS cnt
             FROM reports r
             JOIN users u ON u.id = r.user_id
             {$whereClause}
             GROUP BY r.flood_level";

$countStmt = $pdo->prepare($countSql);
$countStmt->execute($params);
$countRows = $countStmt->fetchAll();

$countsByFloodLevel = ['Low' => 0, 'Moderate' => 0, 'High' => 0, 'Critical' => 0];
foreach ($countRows as $row) {
    $countsByFloodLevel[$row['flood_level']] = (int)$row['cnt'];
}

jsonSuccess([
    'reports'              => $reports,
    'counts_by_flood_level' => $countsByFloodLevel,
]);
