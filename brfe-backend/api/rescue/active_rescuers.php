<?php
/**
 * GET /api/rescue/active_rescuers
 *
 * Returns rescuers with a recent live GPS location (from the rescuer_locations
 * file cache) plus the rescue request each one is currently responding to.
 *
 * LGU_Admin: all rescuers city-wide.
 * Barangay_Official: only rescuers assigned to their barangay.
 *
 * A rescuer is considered "online" when their cached location was updated
 * within the freshness window (default 60s).
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/lgu_auth.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); exit; }

requireLguAuth();

$lguUser    = $GLOBALS['lgu_user'];
$isAdmin    = ($lguUser['role'] === 'LGU_Admin');
$barangayId = (int)($lguUser['barangay_id'] ?? 0);

// How long a cached location stays "fresh" (seconds).
const RESCUER_FRESH_SECONDS = 60;

$pdo = Database::getInstance();

// ── Load rescuer accounts ─────────────────────────────────────────────────────
$where  = ["la.role = 'Rescuer'"];
$params = [];
if (!$isAdmin && $barangayId) {
    $where[]  = 'la.barangay_id = ?';
    $params[] = $barangayId;
}

$sql = 'SELECT la.id, la.username, la.barangay_id, b.name AS barangay_name
        FROM lgu_accounts la
        LEFT JOIN barangays b ON b.id = la.barangay_id
        WHERE ' . implode(' AND ', $where) . '
        ORDER BY la.username ASC';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rescuers = $stmt->fetchAll(PDO::FETCH_ASSOC);

// ── Pre-load ongoing rescue requests keyed by responder ───────────────────────
$rescueByResponder = [];
$rStmt = $pdo->query(
    "SELECT rr.id, rr.responder_id, rr.req_status, rr.requested_at,
            u.full_name AS evacuee_name, ub.name AS evacuee_barangay
     FROM rescue_requests rr
     LEFT JOIN users u ON u.id = rr.user_id
     LEFT JOIN barangays ub ON ub.id = u.barangay_id
     WHERE rr.req_status = 'Ongoing' AND rr.responder_id IS NOT NULL"
);
foreach ($rStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $rescueByResponder[(int)$row['responder_id']] = $row;
}

// ── Merge with cached live locations ──────────────────────────────────────────
$cacheDir = __DIR__ . '/../../cache/rescuer_locations/';
$now      = time();
$out      = [];

foreach ($rescuers as $r) {
    $rescuerId = (int)$r['id'];
    $cacheFile = $cacheDir . $rescuerId . '.json';

    $lat = null; $lng = null; $updatedAt = null; $online = false;
    if (is_file($cacheFile)) {
        $data = json_decode((string)file_get_contents($cacheFile), true) ?: [];
        $ts   = strtotime($data['updated_at'] ?? '');
        if ($ts) {
            $lat       = isset($data['lat']) ? (float)$data['lat'] : null;
            $lng       = isset($data['lng']) ? (float)$data['lng'] : null;
            $updatedAt = $data['updated_at'];
            $online    = ($now - $ts) <= RESCUER_FRESH_SECONDS;
        }
    }

    $rescue = $rescueByResponder[$rescuerId] ?? null;

    $out[] = [
        'id'               => $rescuerId,
        'name'             => $r['username'],
        'barangay_id'      => $r['barangay_id'] !== null ? (int)$r['barangay_id'] : null,
        'barangay_name'    => $r['barangay_name'],
        'latitude'         => $lat,
        'longitude'        => $lng,
        'last_location_at' => $updatedAt,
        'online'           => $online,
        'status'           => $rescue ? 'Responding' : ($online ? 'Available' : 'Offline'),
        'rescue_id'        => $rescue ? (int)$rescue['id'] : null,
        'evacuee_name'     => $rescue['evacuee_name'] ?? null,
        'evacuee_barangay' => $rescue['evacuee_barangay'] ?? null,
    ];
}

// Sort: responding first, then available, then offline.
usort($out, function ($a, $b) {
    $rank = ['Responding' => 0, 'Available' => 1, 'Offline' => 2];
    return ($rank[$a['status']] ?? 3) <=> ($rank[$b['status']] ?? 3);
});

$online     = array_values(array_filter($out, fn($r) => $r['online']));
$responding = array_values(array_filter($out, fn($r) => $r['status'] === 'Responding'));

jsonSuccess([
    'data'  => $out,
    'total' => count($out),
    'stats' => [
        'total'      => count($out),
        'online'     => count($online),
        'responding' => count($responding),
    ],
]);
