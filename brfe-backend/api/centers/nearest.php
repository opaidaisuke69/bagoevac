<?php
/**
 * GET /api/centers/nearest?lat=&lng=&mode=smart|all
 *
 * mode=smart (default):
 *   Returns only centers within 3 km of the user's GPS coords.
 *   If barangay_id is assigned on centers, same-barangay centers appear first.
 *   No fallback — if nothing is within 3 km, returns empty array.
 *
 * mode=all:
 *   All centers sorted by distance (Open first), no limit.
 *
 * Auth: JWT Bearer (evacuee)
 */

require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); exit; }

requireAuth();

$lat  = isset($_GET['lat']) ? (float)$_GET['lat'] : null;
$lng  = isset($_GET['lng']) ? (float)$_GET['lng'] : null;
$mode = (isset($_GET['mode']) && $_GET['mode'] === 'all') ? 'all' : 'smart';

if (!$lat || !$lng) {
    errorValidation(['lat' => 'lat and lng are required.']);
}

$pdo = Database::getInstance();

$haversine = '(6371 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS(ec.lat - :lat) / 2), 2) +
    COS(RADIANS(:lat2)) * COS(RADIANS(ec.lat)) *
    POWER(SIN(RADIANS(ec.lng - :lng) / 2), 2)
)))';

// ── Detect user's barangay ────────────────────────────────────────────────────
$userBarangayId   = null;
$userBarangayName = null;

$bStmt = $pdo->prepare(
    'SELECT id, name FROM barangays
     WHERE latitude IS NOT NULL AND longitude IS NOT NULL
     ORDER BY (6371 * 2 * ASIN(SQRT(
         POWER(SIN(RADIANS(latitude  - :blat) / 2), 2) +
         COS(RADIANS(:blat2)) * COS(RADIANS(latitude)) *
         POWER(SIN(RADIANS(longitude - :blng) / 2), 2)
     ))) ASC LIMIT 1'
);
$bStmt->bindValue(':blat',  $lat, PDO::PARAM_STR);
$bStmt->bindValue(':blat2', $lat, PDO::PARAM_STR);
$bStmt->bindValue(':blng',  $lng, PDO::PARAM_STR);
$bStmt->execute();
$userBarangay = $bStmt->fetch();
if ($userBarangay) {
    $userBarangayId   = (int)$userBarangay['id'];
    $userBarangayName = $userBarangay['name'];
}

// ── Build query ───────────────────────────────────────────────────────────────
$selectCols = "ec.id, ec.name, ec.address, ec.lat, ec.lng,
               ec.max_capacity, ec.occupancy, ec.op_status,
               ec.barangay_id, b.name AS barangay_name,
               ROUND($haversine, 2) AS distance_km";

if ($mode === 'all') {
    $sql = "SELECT $selectCols
            FROM evacuation_centers ec
            LEFT JOIN barangays b ON b.id = ec.barangay_id
            ORDER BY FIELD(ec.op_status,'Open','Full','Closed'), distance_km ASC";
} else {
    // smart: only centers in the user's barangay
    // if no barangay match found, return empty (no distance fallback)
    if ($userBarangayId) {
        $sql = "SELECT $selectCols
                FROM evacuation_centers ec
                LEFT JOIN barangays b ON b.id = ec.barangay_id
                WHERE ec.barangay_id = $userBarangayId
                ORDER BY FIELD(ec.op_status,'Open','Full','Closed'), distance_km ASC";
    } else {
        // no barangay detected — return empty
        $sql = "SELECT $selectCols
                FROM evacuation_centers ec
                LEFT JOIN barangays b ON b.id = ec.barangay_id
                WHERE 1=0";
    }
}

$stmt = $pdo->prepare($sql);
$stmt->bindValue(':lat',  $lat, PDO::PARAM_STR);
$stmt->bindValue(':lat2', $lat, PDO::PARAM_STR);
$stmt->bindValue(':lng',  $lng, PDO::PARAM_STR);
$stmt->execute();
$centers = $stmt->fetchAll();

// ── Normalise ─────────────────────────────────────────────────────────────────
foreach ($centers as &$c) {
    $c['id']               = (int)$c['id'];
    $c['lat']              = (float)$c['lat'];
    $c['lng']              = (float)$c['lng'];
    $c['max_capacity']     = (int)$c['max_capacity'];
    $c['occupancy']        = (int)$c['occupancy'];
    $c['distance_km']      = (float)$c['distance_km'];
    $c['available']        = $c['max_capacity'] - $c['occupancy'];
    $c['barangay_id']      = $c['barangay_id'] ? (int)$c['barangay_id'] : null;
    $c['barangay_name']    = $c['barangay_name'] ?? null;
    $c['is_same_barangay'] = ($userBarangayId && (int)$c['barangay_id'] === $userBarangayId);
}
unset($c);

jsonSuccess([
    'centers'            => $centers,
    'user_barangay_id'   => $userBarangayId,
    'user_barangay_name' => $userBarangayName,
]);
