<?php
require_once __DIR__ . '/../api/response.php';

/**
 * Executes a callable inside a try/catch that intercepts FK/integrity
 * constraint violations (SQLSTATE 23xxx) and responds with errorFkViolation().
 * Any other PDOException is re-thrown to the caller.
 *
 * @param callable $fn  The database write operation to protect.
 * @return mixed        The return value of $fn on success.
 */
function withFkGuard(callable $fn): mixed
{
    try {
        return $fn();
    } catch (PDOException $e) {
        // MySQL FK / integrity constraint violation: SQLSTATE 23000
        if (strpos((string) $e->getCode(), '23') === 0) {
            errorFkViolation();
        }
        throw $e;
    }
}
