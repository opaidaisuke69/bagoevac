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

// ── SMTP / email (used for registration verification + password reset) ────────
// Credentials can be overridden via environment variables in production.
define('SMTP_HOST',       getenv('SMTP_HOST')       ?: 'mail.quickycloud.com');
define('SMTP_PORT',       (int)(getenv('SMTP_PORT') ?: 465));
define('SMTP_USER',       getenv('SMTP_USER')       ?: 'brfe-noreply@quickycloud.com');
define('SMTP_PASS',       getenv('SMTP_PASS')       ?: 'Edrian010902');
// 'ssl' for port 465 (implicit TLS), 'tls' for port 587 (STARTTLS).
define('SMTP_SECURE',     getenv('SMTP_SECURE')     ?: 'ssl');
define('SMTP_FROM_EMAIL', getenv('SMTP_FROM_EMAIL') ?: 'brfe-noreply@quickycloud.com');
define('SMTP_FROM_NAME',  getenv('SMTP_FROM_NAME')  ?: 'BRFE - Bago Evac');

// One-time-code settings
define('OTP_TTL_SECONDS', (int)(getenv('OTP_TTL_SECONDS') ?: 600));  // 10 minutes
define('OTP_MAX_ATTEMPTS', (int)(getenv('OTP_MAX_ATTEMPTS') ?: 5));   // wrong-code tries before invalidation
define('OTP_RESEND_SECONDS', (int)(getenv('OTP_RESEND_SECONDS') ?: 60)); // cooldown between sends

// Public base URL (used for building avatar URLs, upload paths)
define('API_BASE_URL', getenv('API_BASE_URL') ?: 'http://localhost/bagoevac/brfe-backend');

// Upload directory
define('UPLOAD_DIR', __DIR__ . '/../public/uploads/');
