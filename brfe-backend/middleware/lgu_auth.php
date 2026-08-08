<?php
/**
 * LGU JWT authentication middleware.
 * Validates the Bearer token and ensures the user has an LGU role.
 */

require_once __DIR__ . '/../services/JwtService.php';

function requireLguAuth(): void
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        $token = $m[1];
    } else {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => true, 'code' => 'AUTH_REQUIRED', 'message' => 'Authorization required.']);
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

    $validRoles = ['LGU_Admin', 'Barangay_Official', 'Rescuer'];
    if (!in_array($payload['role'] ?? '', $validRoles, true)) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => true, 'code' => 'FORBIDDEN', 'message' => 'LGU access required.']);
        exit;
    }

    $GLOBALS['lgu_user'] = $payload;
}
