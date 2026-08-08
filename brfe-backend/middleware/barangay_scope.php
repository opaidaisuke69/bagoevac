<?php
/**
 * Barangay scope middleware.
 * Adds barangay_id filtering to queries when the logged-in user
 * is a Barangay_Official (limits visibility to their own barangay).
 */

function getBarangayScope(): ?int
{
    $user = $GLOBALS['lgu_user'] ?? null;
    if (!$user) return null;

    // LGU_Admin sees everything
    if ($user['role'] === 'LGU_Admin') return null;

    // Barangay_Official is scoped
    return isset($user['barangay_id']) ? (int)$user['barangay_id'] : null;
}
