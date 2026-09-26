<?php
/**
 * BRFE Backend — Single entry point router
 * Routes requests to the appropriate API handler based on the URI path.
 */

// ── Fail as JSON, never as an HTML error page ─────────────────────────────────
// Mobile clients parse every response as JSON; a PHP warning/notice/fatal that
// prints HTML would surface as "Unexpected server response". Suppress inline
// HTML errors and convert uncaught errors/exceptions into a clean JSON body.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

set_exception_handler(function ($e) {
    if (!headers_sent()) {
        while (ob_get_level() > 0) { ob_end_clean(); }
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    error_log('[uncaught] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    echo json_encode(['error' => true, 'code' => 'SERVER_ERROR', 'message' => 'A server error occurred. Please try again.']);
    exit;
});

register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) {
            while (ob_get_level() > 0) { ob_end_clean(); }
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        error_log('[fatal] ' . $err['message'] . ' @ ' . $err['file'] . ':' . $err['line']);
        echo json_encode(['error' => true, 'code' => 'SERVER_ERROR', 'message' => 'A server error occurred. Please try again.']);
    }
});

// CORS headers (single source — not duplicated in .htaccess)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Parse the request URI relative to the base path
// Derive the base path from where this script actually lives, so routing works
// whether the backend is served at "/brfe-backend" (production) or a nested
// path like "/bagoevac/brfe-backend" (local XAMPP).
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$basePath   = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');

if ($basePath !== '' && strpos($requestUri, $basePath) === 0) {
    $path = substr($requestUri, strlen($basePath));
} else {
    $path = $requestUri;
}

// Fallback: always anchor on the "/api/..." segment if present. This is robust
// against base-path mismatches and any leftover "index.php" in the URL.
if (($apiPos = strpos($path, '/api/')) !== false) {
    $path = substr($path, $apiPos);
}

$path = '/' . ltrim($path, '/');

// Route map
$routes = [
    // Auth
    '/api/auth/login'           => __DIR__ . '/api/auth/login.php',
    '/api/auth/register'        => __DIR__ . '/api/auth/register.php',
    '/api/auth/logout'          => __DIR__ . '/api/auth/logout.php',
    '/api/auth/send-code'       => __DIR__ . '/api/auth/send-code.php',
    '/api/auth/forgot-password' => __DIR__ . '/api/auth/forgot-password.php',
    '/api/auth/reset-password'  => __DIR__ . '/api/auth/reset-password.php',
    '/api/lgu/login'       => __DIR__ . '/api/lgu/login.php',
    '/api/lgu/accounts'    => __DIR__ . '/api/lgu/accounts.php',
    '/api/lgu/create-account' => __DIR__ . '/api/lgu/create-account.php',
    '/api/lgu/settings'    => __DIR__ . '/api/lgu/settings.php',

    // Users
    '/api/users/get'           => __DIR__ . '/api/users/get.php',
    '/api/users/list'          => __DIR__ . '/api/users/list.php',
    '/api/users/list-all'      => __DIR__ . '/api/users/list-all.php',
    '/api/users/status'        => __DIR__ . '/api/users/status.php',
    '/api/users/status_lgu'    => __DIR__ . '/api/users/status_lgu.php',
    '/api/users/create_lgu'    => __DIR__ . '/api/users/create_lgu.php',
    '/api/users/update'        => __DIR__ . '/api/users/update.php',
    '/api/users/avatar'        => __DIR__ . '/api/users/avatar.php',
    '/api/users/change_password' => __DIR__ . '/api/users/change_password.php',

    // Barangays
    '/api/barangays/list'    => __DIR__ . '/api/barangays/list.php',
    '/api/barangays/profile' => __DIR__ . '/api/barangays/profile.php',

    // Locations
    '/api/locations/post'    => __DIR__ . '/api/locations/post.php',
    '/api/locations/latest'  => __DIR__ . '/api/locations/latest.php',

    // Reports
    '/api/reports/post'      => __DIR__ . '/api/reports/post.php',
    '/api/reports/list'      => __DIR__ . '/api/reports/list.php',
    '/api/reports/list_lgu'  => __DIR__ . '/api/reports/list_lgu.php',
    '/api/reports/summary'   => __DIR__ . '/api/reports/summary.php',

    // Rescue
    '/api/rescue/post'       => __DIR__ . '/api/rescue/post.php',
    '/api/rescue/list'       => __DIR__ . '/api/rescue/list.php',
    '/api/rescue/list_lgu'   => __DIR__ . '/api/rescue/list_lgu.php',
    '/api/rescue/update'     => __DIR__ . '/api/rescue/update.php',
    '/api/rescue/update_lgu' => __DIR__ . '/api/rescue/update_lgu.php',
    '/api/rescue/location'   => __DIR__ . '/api/rescue/location.php',
    '/api/rescue/active_rescuers' => __DIR__ . '/api/rescue/active_rescuers.php',

    // Centers
    '/api/centers/list'      => __DIR__ . '/api/centers/list.php',
    '/api/centers/list_lgu'  => __DIR__ . '/api/centers/list_lgu.php',
    '/api/centers/post'      => __DIR__ . '/api/centers/post.php',
    '/api/centers/update'    => __DIR__ . '/api/centers/update.php',
    '/api/centers/nearest'   => __DIR__ . '/api/centers/nearest.php',
    '/api/centers/upsert_lgu' => __DIR__ . '/api/centers/upsert_lgu.php',

    // Chat
    '/api/chat/messages'     => __DIR__ . '/api/chat/messages.php',
    '/api/chat/broadcast'    => __DIR__ . '/api/chat/broadcast.php',
    '/api/chat/feed'         => __DIR__ . '/api/chat/feed.php',
    '/api/chat/threads_lgu'  => __DIR__ . '/api/chat/threads_lgu.php',
    '/api/chat/thread_lgu'   => __DIR__ . '/api/chat/thread_lgu.php',

    // Notifications
    '/api/notifications/list' => __DIR__ . '/api/notifications/list.php',
    '/api/notifications/read' => __DIR__ . '/api/notifications/read.php',

    // System
    '/api/system/status'     => __DIR__ . '/api/system/status.php',

    // Boundary
    '/api/boundary/bago'     => __DIR__ . '/api/boundary/bago.php',

    // Events (SSE)
    '/api/events'            => __DIR__ . '/api/events.php',
];

if (isset($routes[$path])) {
    require $routes[$path];
} else {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => true, 'message' => 'Route not found: ' . $path]);
}
