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

/**
 * Send a JSON response to the client immediately, close the connection, then
 * keep running server-side work (e.g. sending an email over slow SMTP) without
 * making the client wait. Prevents mobile "Network error" timeouts on slow
 * mail servers.
 *
 * @param callable $after runs after the response has been flushed to the client
 */
function jsonSuccessThen(array $data, callable $after, int $statusCode = 200): void
{
    $payload = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Connection: close');
    header('Content-Length: ' . strlen($payload));

    // Ensure nothing is buffered ahead of us, then emit the body.
    while (ob_get_level() > 0) { ob_end_clean(); }
    echo $payload;

    // Flush to the client and close the connection if the SAPI supports it.
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } else {
        // Apache/mod_php fallback: flush buffers so the client receives the body.
        @ob_flush();
        @flush();
    }

    // Don't let the background work be killed if the client disconnects.
    if (function_exists('ignore_user_abort')) {
        ignore_user_abort(true);
    }
    @set_time_limit(60);

    try {
        $after();
    } catch (\Throwable $e) {
        error_log('[jsonSuccessThen] after-callback failed: ' . $e->getMessage());
    }
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
