<?php
/**
 * GET /api/boundary/bago
 * Serves the Bago City boundary GeoJSON.
 * Tries Nominatim first to get the real boundary; falls back to local file.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=86400');

$cacheFile = __DIR__ . '/../../data/bago_city_boundary.geojson';

// Try fetching real boundary from Nominatim (server-side, no CORS)
$fetched = false;
$url = 'https://nominatim.openstreetmap.org/search?' . http_build_query([
    'q'               => 'Bago City, Negros Occidental, Philippines',
    'format'          => 'geojson',
    'polygon_geojson' => '1',
    'limit'           => '1',
]);

$ctx = stream_context_create([
    'http' => [
        'timeout' => 8,
        'header'  => "User-Agent: BRFE-App/1.0\r\n",
    ],
]);

$raw = @file_get_contents($url, false, $ctx);
if ($raw !== false) {
    $data = json_decode($raw, true);
    if (!empty($data['features'][0]['geometry'])) {
        $geomType = $data['features'][0]['geometry']['type'];
        if (in_array($geomType, ['Polygon', 'MultiPolygon'], true)) {
            $geojson = json_encode([
                'type'     => 'FeatureCollection',
                'features' => [[
                    'type'       => 'Feature',
                    'properties' => ['name' => 'Bago City'],
                    'geometry'   => $data['features'][0]['geometry'],
                ]],
            ], JSON_UNESCAPED_UNICODE);
            // Cache and serve
            @file_put_contents($cacheFile, $geojson);
            echo $geojson;
            $fetched = true;
        }
    }
}

if (!$fetched) {
    // Serve local file
    if (file_exists($cacheFile)) {
        readfile($cacheFile);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Boundary file not found']);
    }
}
