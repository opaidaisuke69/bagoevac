<?php
/**
 * BRFE Backend — Single entry point router
 * Routes requests to the appropriate API handler based on the URI path.
 */

// CORS headers (single source — not duplicated in .htaccess)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Parse the request URI relative to the base path
$basePath = '/bagoevac/brfe-backend';
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = substr($requestUri, strlen($basePath));
$path = '/' . ltrim($path, '/');

// Route map
$routes = [
    // Auth
    '/api/auth/login'      => __DIR__ . '/api/auth/login.php',
    '/api/auth/register'   => __DIR__ . '/api/auth/register.php',
    '/api/auth/logout'     => __DIR__ . '/api/auth/logout.php',
    '/api/lgu/login'       => __DIR__ . '/api/lgu/login.php',
    '/api/lgu/accounts'    => __DIR__ . '/api/lgu/accounts.php',
    '/api/lgu/create-account' => __DIR__ . '/api/lgu/create-account.php',

    // Users
    '/api/users/get'           => __DIR__ . '/api/users/get.php',
    '/api/users/list'          => __DIR__ . '/api/users/list.php',
    '/api/users/list-all'      => __DIR__ . '/api/users/list-all.php',
    '/api/users/status'        => __DIR__ . '/api/users/status.php',
    '/api/users/update'        => __DIR__ . '/api/users/update.php',
    '/api/users/avatar'        => __DIR__ . '/api/users/avatar.php',
    '/api/users/change_password' => __DIR__ . '/api/users/change_password.php',

    // Barangays
    '/api/barangays/list'  => __DIR__ . '/api/barangays/list.php',

    // Locations
    '/api/locations/post'    => __DIR__ . '/api/locations/post.php',
    '/api/locations/latest'  => __DIR__ . '/api/locations/latest.php',

    // Reports
    '/api/reports/post'      => __DIR__ . '/api/reports/post.php',
    '/api/reports/list'      => __DIR__ . '/api/reports/list.php',
    '/api/reports/list_lgu'  => __DIR__ . '/api/reports/list_lgu.php',

    // Rescue
    '/api/rescue/post'       => __DIR__ . '/api/rescue/post.php',
    '/api/rescue/list'       => __DIR__ . '/api/rescue/list.php',
    '/api/rescue/list_lgu'   => __DIR__ . '/api/rescue/list_lgu.php',
    '/api/rescue/update'     => __DIR__ . '/api/rescue/update.php',
    '/api/rescue/update_lgu' => __DIR__ . '/api/rescue/update_lgu.php',

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
