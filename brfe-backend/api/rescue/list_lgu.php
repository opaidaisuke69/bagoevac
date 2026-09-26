<?php
/**
 * GET /api/rescue/list_lgu
 *
 * Barangay_Official: sees rescue requests from evacuees registered in their barangay.
 * The frontend handles jurisdiction detection using polygon boundaries.
 *
 * LGU_Admin: sees all requests.
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

$lguUser    = $GLOBALS['lgu_user'];
$isAdmin    = $lguUser['role'] === 'LGU_Admin';
$barangayId = (int)($lguUser['barangay_id'] ?? 0);

$pdo    = Database::getInstance();
$where  = ['1=1'];
$params = [];

// scope=jurisdiction → return ALL rescue requests so the caller can filter by
// the request's live GPS location (border jurisdiction) instead of the
// evacuee's registered barangay.
$jurisdiction = ($_GET['scope'] ?? '') === 'jurisdiction';

if (!$isAdmin && $barangayId && !$jurisdiction) {
    // Default: rescue requests from evacuees registered in this barangay
    $where[]  = 'u.barangay_id = ?';
    $params[] = $barangayId;
}

$validStatuses = ['Pending', 'Ongoing', 'Completed'];
if (!empty($_GET['status']) && in_array($_GET['status'], $validStatuses, true)) {
    $where[]  = 'rr.req_status = ?';
    $params[] = $_GET['status'];
}

$sql = 'SELECT rr.id, rr.user_id, rr.lat AS latitude, rr.lng AS longitude,
               rr.status_at_request, rr.req_status, rr.responder_id,
               rr.requested_at, rr.completed_at, rr.photo_path,
               u.full_name, u.status AS current_status, u.contact_no,
               b.name AS barangay_name, b.id AS evacuee_barangay_id
        FROM rescue_requests rr
        LEFT JOIN users u ON u.id = rr.user_id
        LEFT JOIN barangays b ON b.id = u.barangay_id
        WHERE ' . implode(' AND ', $where) . '
        ORDER BY
            CASE rr.req_status WHEN \'Pending\' THEN 0 WHEN \'Ongoing\' THEN 1 ELSE 2 END,
            rr.requested_at ASC';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

foreach ($rows as &$r) {
    $r['id']        = (int)$r['id'];
    $r['user_id']   = (int)$r['user_id'];
    $r['latitude']  = (float)$r['latitude'];
    $r['longitude'] = (float)$r['longitude'];
}
unset($r);

jsonSuccess(['data' => $rows]);
