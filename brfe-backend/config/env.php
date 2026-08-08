<?php
// Environment constants for BRFE Backend

// Timezone — all server-side timestamps use Asia/Manila (UTC+8)
date_default_timezone_set('Asia/Manila');

// Database credentials
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'brfe_db');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');

// JWT configuration
define('JWT_SECRET', getenv('JWT_SECRET') ?: 'change-me-in-production');
define('JWT_EXPIRY_SECONDS', (int)(getenv('JWT_EXPIRY_SECONDS') ?: 86400)); // 24 hours

// Boundary GeoJSON path
define('BOUNDARY_GEOJSON_PATH', getenv('BOUNDARY_GEOJSON_PATH') ?: __DIR__ . '/../data/bago_city_boundary.geojson');

// App environment
define('APP_ENV', getenv('APP_ENV') ?: 'production');
define('APP_DEBUG', APP_ENV === 'development');

// Public base URL (used for building avatar URLs, upload paths)
define('API_BASE_URL', getenv('API_BASE_URL') ?: 'http://localhost/bagoevac/brfe-backend');

// Upload directory
define('UPLOAD_DIR', __DIR__ . '/../public/uploads/');
