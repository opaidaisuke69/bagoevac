<?php
require_once __DIR__ . '/env.php';

class BagoBoundary
{
    private static ?array $polygon = null;

    public static function loadPolygon(): array
    {
        if (self::$polygon !== null) {
            return self::$polygon;
        }

        $path = BOUNDARY_GEOJSON_PATH;
        if (!file_exists($path)) {
            self::$polygon = [];
            return self::$polygon;
        }

        $json = json_decode(file_get_contents($path), true);
        if (!$json) {
            self::$polygon = [];
            return self::$polygon;
        }

        $coords = $json['features'][0]['geometry']['coordinates'][0] ?? [];
        self::$polygon = array_map(fn($c) => ['lng' => $c[0], 'lat' => $c[1]], $coords);
        return self::$polygon;
    }

    public static function contains(float $lat, float $lng): bool
    {
        $polygon = self::loadPolygon();
        if (empty($polygon)) return true; // no boundary = allow all

        $n = count($polygon);
        $inside = false;
        for ($i = 0, $j = $n - 1; $i < $n; $j = $i++) {
            $xi = $polygon[$i]['lat'];
            $yi = $polygon[$i]['lng'];
            $xj = $polygon[$j]['lat'];
            $yj = $polygon[$j]['lng'];

            if (($yi > $lng) !== ($yj > $lng) &&
                ($lat < ($xj - $xi) * ($lng - $yi) / ($yj - $yi) + $xi)) {
                $inside = !$inside;
            }
        }
        return $inside;
    }
}
