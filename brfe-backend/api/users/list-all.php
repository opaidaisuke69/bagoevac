<?php
/**
 * GET /api/users/list-all
 *
 * Barangay_Official: returns evacuees whose REGISTERED barangay matches.
 * The frontend handles jurisdiction detection using polygon boundaries.
 *
 * LGU_Admin: returns all (optional ?barangay_id filter).
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/lgu_auth.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); exit; }

requireLguAuth();

$user       = $GLOBALS['lgu_user'];
$isAdmin    = ($user['role'] === 'LGU_Admin');
$myBrgyId   = isset($user['barangay_id']) ? (int)$user['barangay_id'] : 0;

$pdo = Database::getInstance();

// ── Build WHERE clause ────────────────────────────────────────────────────────
$where  = ['1=1'];
$params = [];

if (!$isAdmin && $myBrgyId > 0) {
    // Show evacuees registered in this barangay
    $where[]  = 'u.barangay_id = ?';
    $params[] = $myBrgyId;
} elseif ($isAdmin && !empty($_GET['barangay_id'])) {
    $where[]  = 'u.barangay_id = ?';
    $params[] = (int)$_GET['barangay_id'];
}

// Status filter
if (!empty($_GET['status'])) {
    $allowed  = ['Safe', 'Need_Assistance', 'In_Danger'];
    $statuses = array_filter(
        array_map('trim', explode(',', $_GET['status'])),
        fn($s) => in_array($s, $allowed, true)
    );
    if ($statuses) {
        $ph       = implode(',', array_fill(0, count($statuses), '?'));
        $where[]  = "u.status IN ($ph)";
        $params   = array_merge($params, array_values($statuses));
    }
}

$sql = '
    SELECT  u.id,
            u.full_name,
            u.age,
            u.contact_no,
            u.status,
            u.avatar_path,
            u.barangay_id,
            b.name          AS barangay_name,
            l.lat           AS latitude,
            l.lng           AS longitude,
            l.recorded_at   AS last_location_at
    FROM    users u
    INNER JOIN barangays b ON b.id = u.barangay_id
    LEFT  JOIN locations  l ON l.user_id = u.id
    WHERE ' . implode(' AND ', $where) . '
    ORDER BY u.full_name ASC
';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($rows as &$r) {
    $r['id']          = (int)$r['id'];
    $r['age']         = (int)$r['age'];
    $r['barangay_id'] = (int)$r['barangay_id'];
    $r['latitude']    = $r['latitude']  !== null ? (float)$r['latitude']  : null;
    $r['longitude']   = $r['longitude'] !== null ? (float)$r['longitude'] : null;
}
unset($r);

jsonSuccess(['data' => $rows, 'total' => count($rows)]);
