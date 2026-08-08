<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../api/response.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    exit;
}

$pdo = Database::getInstance();
$stmt = $pdo->query('SELECT id, name, latitude, longitude FROM barangays ORDER BY name ASC');
$barangays = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($barangays as &$b) {
    $b['id']        = (int)$b['id'];
    $b['latitude']  = $b['latitude']  !== null ? (float)$b['latitude']  : null;
    $b['longitude'] = $b['longitude'] !== null ? (float)$b['longitude'] : null;
}
unset($b);

jsonSuccess(['data' => $barangays]);
