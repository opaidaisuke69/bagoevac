<?php
/**
 * GET /api/rescue/list_lgu — List rescue requests for LGU web panel (session auth).
 * Joins users table to include evacuee name.
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

$pdo    = Database::getInstance();
$where  = ['1=1'];
$params = [];

$validStatuses = ['Pending', 'Ongoing', 'Completed'];
if (!empty($_GET['status']) && in_array($_GET['status'], $validStatuses, true)) {
    $where[]  = 'rr.req_status = ?';
    $params[] = $_GET['status'];
}

$sql = 'SELECT rr.id, rr.user_id, rr.lat AS latitude, rr.lng AS longitude,
               rr.status_at_request, rr.req_status, rr.responder_id,
               rr.requested_at, rr.completed_at,
               u.full_name, u.status AS current_status, u.contact_no,
               b.name AS barangay_name
        FROM rescue_requests rr
        LEFT JOIN users u ON u.id = rr.user_id
        LEFT JOIN barangays b ON b.id = u.barangay_id
        WHERE ' . implode(' AND ', $where) . '
        ORDER BY rr.requested_at ASC';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

foreach ($rows as &$r) {
    $r['id']       = (int)$r['id'];
    $r['user_id']  = (int)$r['user_id'];
    $r['latitude'] = (float)$r['latitude'];
    $r['longitude'] = (float)$r['longitude'];
}
unset($r);

jsonSuccess(['data' => $rows]);
