<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    exit;
}

$pdo = Database::getInstance();

// Check if hall_image column exists
$cols = $pdo->query("SHOW COLUMNS FROM barangays")->fetchAll(PDO::FETCH_COLUMN, 0);
$hasHallImage = in_array('hall_image', $cols);

$selectCols = 'id, name, latitude, longitude';
if ($hasHallImage) $selectCols .= ', hall_image';

$stmt = $pdo->query('SELECT ' . $selectCols . ' FROM barangays ORDER BY name ASC');
$barangays = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($barangays as &$b) {
    $b['id']        = (int)$b['id'];
    $b['latitude']  = $b['latitude']  !== null ? (float)$b['latitude']  : null;
    $b['longitude'] = $b['longitude'] !== null ? (float)$b['longitude'] : null;
    if (!isset($b['hall_image'])) $b['hall_image'] = null;
}
unset($b);

jsonSuccess(['data' => $barangays]);
