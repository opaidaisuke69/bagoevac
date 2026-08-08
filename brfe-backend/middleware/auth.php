<?php
/**
 * JWT authentication middleware.
 * Call requireAuth() at the top of any protected endpoint.
 * On success, sets $GLOBALS['auth_user'] with decoded token payload.
 */

require_once __DIR__ . '/../services/JwtService.php';

function requireAuth(): void
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        $token = $m[1];
    } else {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => true, 'code' => 'AUTH_REQUIRED', 'message' => 'Authorization header missing or invalid.']);
        exit;
    }

    try {
        $payload = JwtService::verify($token);
    } catch (\Exception $e) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => true, 'code' => 'AUTH_INVALID', 'message' => $e->getMessage()]);
        exit;
    }

    $GLOBALS['auth_user'] = $payload;
}
