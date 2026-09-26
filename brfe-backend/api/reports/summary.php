<?php
/**
 * GET /api/reports/summary — aggregated report data for the LGU admin.
 *
 * Returns city-wide (LGU_Admin) or barangay-scoped (Barangay_Official) counts
 * for evacuees, rescuers, barangays, rescue requests and flood reports, plus a
 * per-barangay breakdown suitable for exporting.
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/barangay_scope.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); exit; }

requireLguAuth();

$pdo   = Database::getInstance();
$scope = getBarangayScope(); // null = all (admin), int = official's barangay

// Helper to add optional barangay scoping to a query.
$scopeClause = $scope !== null ? ' AND barangay_id = ' . (int)$scope : '';

// ── Evacuees (users) ──────────────────────────────────────────────────────────
$evacuees = ['total' => 0, 'safe' => 0, 'need' => 0, 'danger' => 0];
$rows = $pdo->query(
    "SELECT status, COUNT(*) AS cnt FROM users WHERE 1=1{$scopeClause} GROUP BY status"
)->fetchAll(PDO::FETCH_ASSOC);
foreach ($rows as $r) {
    $evacuees['total'] += (int)$r['cnt'];
    if ($r['status'] === 'Safe') $evacuees['safe'] = (int)$r['cnt'];
    elseif ($r['status'] === 'Need_Assistance') $evacuees['need'] = (int)$r['cnt'];
    elseif ($r['status'] === 'In_Danger') $evacuees['danger'] = (int)$r['cnt'];
}

// ── Rescuers (lgu_accounts role=Rescuer) ──────────────────────────────────────
$rescuerScope = $scope !== null ? ' AND barangay_id = ' . (int)$scope : '';
$rescuers = [
    'total' => (int)$pdo->query(
        "SELECT COUNT(*) FROM lgu_accounts WHERE role = 'Rescuer'{$rescuerScope}"
    )->fetchColumn(),
];

// ── Barangay officials ────────────────────────────────────────────────────────
$officials = [
    'total' => (int)$pdo->query(
        "SELECT COUNT(*) FROM lgu_accounts WHERE role = 'Barangay_Official'{$rescuerScope}"
    )->fetchColumn(),
];

// ── Rescue requests ───────────────────────────────────────────────────────────
$rescues = ['pending' => 0, 'ongoing' => 0, 'completed' => 0, 'total' => 0];
$rescueScopeJoin = $scope !== null ? ' AND u.barangay_id = ' . (int)$scope : '';
$rows = $pdo->query(
    "SELECT rr.req_status, COUNT(*) AS cnt
     FROM rescue_requests rr JOIN users u ON u.id = rr.user_id
     WHERE 1=1{$rescueScopeJoin} GROUP BY rr.req_status"
)->fetchAll(PDO::FETCH_ASSOC);
foreach ($rows as $r) {
    $rescues['total'] += (int)$r['cnt'];
    $key = strtolower($r['req_status']);
    if (isset($rescues[$key])) $rescues[$key] = (int)$r['cnt'];
}

// ── Flood reports (by level) ──────────────────────────────────────────────────
$reports = ['Low' => 0, 'Moderate' => 0, 'High' => 0, 'Critical' => 0, 'total' => 0];
$rows = $pdo->query(
    "SELECT r.flood_level, COUNT(*) AS cnt
     FROM reports r JOIN users u ON u.id = r.user_id
     WHERE 1=1{$rescueScopeJoin} GROUP BY r.flood_level"
)->fetchAll(PDO::FETCH_ASSOC);
foreach ($rows as $r) {
    $reports['total'] += (int)$r['cnt'];
    if (isset($reports[$r['flood_level']])) $reports[$r['flood_level']] = (int)$r['cnt'];
}

// ── Per-barangay breakdown ────────────────────────────────────────────────────
$brgyWhere = $scope !== null ? 'WHERE b.id = ' . (int)$scope : '';
$perBarangay = $pdo->query(
    "SELECT b.id, b.name,
        (SELECT COUNT(*) FROM users u WHERE u.barangay_id = b.id) AS evacuees,
        (SELECT COUNT(*) FROM users u WHERE u.barangay_id = b.id AND u.status = 'Safe') AS safe,
        (SELECT COUNT(*) FROM users u WHERE u.barangay_id = b.id AND u.status = 'Need_Assistance') AS need_help,
        (SELECT COUNT(*) FROM users u WHERE u.barangay_id = b.id AND u.status = 'In_Danger') AS in_danger,
        (SELECT COUNT(*) FROM lgu_accounts la WHERE la.barangay_id = b.id AND la.role = 'Rescuer') AS rescuers,
        (SELECT COUNT(*) FROM evacuation_centers ec WHERE ec.barangay_id = b.id) AS centers,
        (SELECT COUNT(*) FROM reports r JOIN users u ON u.id = r.user_id WHERE u.barangay_id = b.id) AS reports
     FROM barangays b
     {$brgyWhere}
     ORDER BY b.name ASC"
)->fetchAll(PDO::FETCH_ASSOC);

foreach ($perBarangay as &$b) {
    $b['id']        = (int)$b['id'];
    $b['evacuees']  = (int)$b['evacuees'];
    $b['safe']      = (int)$b['safe'];
    $b['need_help'] = (int)$b['need_help'];
    $b['in_danger'] = (int)$b['in_danger'];
    $b['rescuers']  = (int)$b['rescuers'];
    $b['centers']   = (int)$b['centers'];
    $b['reports']   = (int)$b['reports'];
}
unset($b);

jsonSuccess([
    'generated_at' => date('c'),
    'scope'        => $scope === null ? 'city-wide' : 'barangay',
    'evacuees'     => $evacuees,
    'rescuers'     => $rescuers,
    'officials'    => $officials,
    'rescues'      => $rescues,
    'reports'      => $reports,
    'per_barangay' => $perBarangay,
]);
