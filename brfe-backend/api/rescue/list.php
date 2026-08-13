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

if (in_array($role, $lguRoles, true) || $role === 'Rescuer') {
    // LGU / Rescuer sees all requests (rescuer needs to see pending/ongoing to navigate)
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
               u.avatar_path, u.full_name, u.status AS user_status, u.contact_no,
               b.name AS barangay_name,
               l.lat AS current_lat, l.lng AS current_lng, l.recorded_at AS last_location_at
        FROM rescue_requests rr
        LEFT JOIN users u ON u.id = rr.user_id
        LEFT JOIN barangays b ON b.id = u.barangay_id
        LEFT JOIN locations l ON l.user_id = u.id
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
    // Current location from locations table (live or last known)
    $req['current_lat']  = $req['current_lat'] !== null ? (float)$req['current_lat'] : null;
    $req['current_lng']  = $req['current_lng'] !== null ? (float)$req['current_lng'] : null;
    // Best available location: current > request location
    $req['best_lat'] = $req['current_lat'] ?? $req['lat'];
    $req['best_lng'] = $req['current_lng'] ?? $req['lng'];
    $req['is_online'] = ($req['last_location_at'] !== null && (time() - strtotime($req['last_location_at'])) < 300);
}
unset($req);

jsonSuccess(['rescue_requests' => $requests]);
