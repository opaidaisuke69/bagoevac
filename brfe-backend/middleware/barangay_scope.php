<?php
/**
 * Barangay scope middleware.
 */

require_once __DIR__ . '/lgu_auth.php';

function getBarangayScope(): ?int
{
    $user = $GLOBALS['lgu_user'] ?? null;
    if (!$user) return null;

    // LGU_Admin sees everything
    if ($user['role'] === 'LGU_Admin') return null;

    // Barangay_Official is scoped
    return isset($user['barangay_id']) ? (int)$user['barangay_id'] : null;
}


// Legacy compatibility wrapper — old files use this pattern
function getBarangayScopeClause(string $tableAlias = 'u'): array
{
    $scope = getBarangayScope();
    if ($scope === null) {
        return ['clause' => '', 'params' => []];
    }
    return ['clause' => "AND {$tableAlias}.barangay_id = ?", 'params' => [$scope]];
}
