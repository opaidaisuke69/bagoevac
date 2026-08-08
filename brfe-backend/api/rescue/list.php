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
$role = $auth['role'] ?? '';
$lguRoles = ['LGU_Admin', 'Barangay_Official'];

// ── Parse optional ?status= filter ───────────────────────────────────────────

$validStatuses = ['Pending', 'Ongoing', 'Completed'];
$statusFilter = isset($_GET['status']) ? trim($_GET['status']) : null;
if ($statusFilter !== null && !in_array($statusFilter, $validStatuses, true)) {
    errorValidation(['status' => 'status must be one of: Pending, Ongoing, Completed.']);
}

// ── Build query ───────────────────────────────────────────────────────────────

$pdo    = Database::getInstance();
$where  = [];
$params = [];

if (in_array($role, $lguRoles, true)) {
    // LGU sees all requests
    if ($statusFilter !== null) {
        $where[]  = 'rr.req_status = ?';
        $params[] = $statusFilter;
    }
} elseif ($role === 'evacuee') {
    // Evacuees only see their own requests
    $where[]  = 'rr.user_id = ?';
    $params[] = (int)$auth['user_id'];
    if ($statusFilter !== null) {
        $where[]  = 'rr.req_status = ?';
        $params[] = $statusFilter;
    }
} else {
    errorForbidden();
}

$whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

$sql = "SELECT rr.id, rr.user_id, rr.lat, rr.lng, rr.status_at_request,
               rr.req_status, rr.responder_id, rr.requested_at, rr.completed_at,
               u.avatar_path, u.full_name, u.status AS user_status
        FROM rescue_requests rr
        LEFT JOIN users u ON u.id = rr.user_id
        {$whereClause}
        ORDER BY rr.requested_at ASC";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$requests = $stmt->fetchAll();

// ── Cast numeric fields ───────────────────────────────────────────────────────

foreach ($requests as &$req) {
    $req['id']           = (int)$req['id'];
    $req['user_id']      = (int)$req['user_id'];
    $req['lat']          = (float)$req['lat'];
    $req['lng']          = (float)$req['lng'];
    $req['responder_id'] = $req['responder_id'] !== null ? (int)$req['responder_id'] : null;
}
unset($req);

jsonSuccess(['rescue_requests' => $requests]);
