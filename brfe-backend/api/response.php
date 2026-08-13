<?php
/**
 * JSON response helpers for the BRFE API.
 */

function jsonSuccess(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function jsonError(string $code, string $message, int $statusCode = 400): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => true, 'code' => $code, 'message' => $message]);
    exit;
}

function errorValidation(array $fields): void
{
    http_response_code(422);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => true, 'code' => 'VALIDATION', 'fields' => $fields]);
    exit;
}

function errorForbidden(): void
{
    jsonError('FORBIDDEN', 'You do not have permission to perform this action.', 403);
}

function errorBoundaryViolation(array $fields): void
{
    http_response_code(422);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => true, 'code' => 'BOUNDARY_VIOLATION', 'fields' => $fields]);
    exit;
}


// Legacy helper functions (used by copied files from brfe-web)
function errorAuthInvalid(): void
{
    jsonError('AUTH_INVALID', 'Invalid or missing authentication.', 401);
}

function errorSessionExpired(): void
{
    jsonError('SESSION_EXPIRED', 'Session expired. Please login again.', 401);
}
