<?php
/**
 * OtpService — issue and verify one-time email codes.
 *
 * Backed by the `email_verifications` table. Codes are 6 digits, stored HASHED
 * (SHA-256), one active row per (email, purpose). Handles:
 *   • resend cooldown (OTP_RESEND_SECONDS)
 *   • expiry (OTP_TTL_SECONDS)
 *   • attempt capping (OTP_MAX_ATTEMPTS wrong tries → code invalidated)
 *
 * Purposes: 'register' | 'password_reset'.
 */

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';

class OtpService
{
    public const PURPOSE_REGISTER = 'register';
    public const PURPOSE_RESET    = 'password_reset';

    /**
     * Create (or overwrite) a code for this email+purpose and return the plain
     * code so the caller can email it. Enforces a resend cooldown.
     *
     * @return array{code:string} on success
     * @throws \RuntimeException with code 'COOLDOWN' if asked to resend too soon
     */
    public static function issue(string $email, string $purpose): array
    {
        $email = strtolower(trim($email));
        $pdo   = Database::getInstance();

        // Cooldown: block rapid re-sends of the same purpose.
        $stmt = $pdo->prepare(
            'SELECT last_sent_at FROM email_verifications WHERE email = ? AND purpose = ? LIMIT 1'
        );
        $stmt->execute([$email, $purpose]);
        $row = $stmt->fetch();
        if ($row && !empty($row['last_sent_at'])) {
            $elapsed = time() - strtotime($row['last_sent_at']);
            if ($elapsed < OTP_RESEND_SECONDS) {
                $wait = OTP_RESEND_SECONDS - $elapsed;
                throw new \RuntimeException("COOLDOWN:{$wait}");
            }
        }

        $code      = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $codeHash  = hash('sha256', $code);
        $expiresAt = date('Y-m-d H:i:s', time() + OTP_TTL_SECONDS);
        $now       = date('Y-m-d H:i:s');

        // Upsert — one active code per (email, purpose).
        $pdo->prepare(
            'INSERT INTO email_verifications (email, purpose, code_hash, attempts, expires_at, last_sent_at)
             VALUES (?, ?, ?, 0, ?, ?)
             ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash), attempts = 0,
                                     expires_at = VALUES(expires_at), last_sent_at = VALUES(last_sent_at)'
        )->execute([$email, $purpose, $codeHash, $expiresAt, $now]);

        return ['code' => $code];
    }

    /**
     * Verify a submitted code. On success the row is consumed (deleted) so a
     * code can only be used once.
     *
     * @return array{ok:bool, error?:string}
     *   error ∈ 'NOT_FOUND' | 'EXPIRED' | 'TOO_MANY' | 'INVALID'
     */
    public static function verify(string $email, string $purpose, string $code): array
    {
        $email = strtolower(trim($email));
        $code  = trim($code);
        $pdo   = Database::getInstance();

        $stmt = $pdo->prepare(
            'SELECT id, code_hash, attempts, expires_at FROM email_verifications
             WHERE email = ? AND purpose = ? LIMIT 1'
        );
        $stmt->execute([$email, $purpose]);
        $row = $stmt->fetch();

        if (!$row) {
            return ['ok' => false, 'error' => 'NOT_FOUND'];
        }

        if (strtotime($row['expires_at']) < time()) {
            $pdo->prepare('DELETE FROM email_verifications WHERE id = ?')->execute([$row['id']]);
            return ['ok' => false, 'error' => 'EXPIRED'];
        }

        if ((int)$row['attempts'] >= OTP_MAX_ATTEMPTS) {
            $pdo->prepare('DELETE FROM email_verifications WHERE id = ?')->execute([$row['id']]);
            return ['ok' => false, 'error' => 'TOO_MANY'];
        }

        $matches = hash_equals($row['code_hash'], hash('sha256', $code));
        if (!$matches) {
            $pdo->prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?')
                ->execute([$row['id']]);
            return ['ok' => false, 'error' => 'INVALID'];
        }

        // Consume the code on success.
        $pdo->prepare('DELETE FROM email_verifications WHERE id = ?')->execute([$row['id']]);
        return ['ok' => true];
    }

    /**
     * Check a code WITHOUT consuming it — used by register.php, which needs the
     * code to still validate right up until the user row is created. On a
     * successful match the caller should call consume().
     */
    public static function check(string $email, string $purpose, string $code): array
    {
        $email = strtolower(trim($email));
        $code  = trim($code);
        $pdo   = Database::getInstance();

        $stmt = $pdo->prepare(
            'SELECT id, code_hash, attempts, expires_at FROM email_verifications
             WHERE email = ? AND purpose = ? LIMIT 1'
        );
        $stmt->execute([$email, $purpose]);
        $row = $stmt->fetch();

        if (!$row) return ['ok' => false, 'error' => 'NOT_FOUND'];
        if (strtotime($row['expires_at']) < time()) return ['ok' => false, 'error' => 'EXPIRED'];
        if ((int)$row['attempts'] >= OTP_MAX_ATTEMPTS) return ['ok' => false, 'error' => 'TOO_MANY'];

        if (!hash_equals($row['code_hash'], hash('sha256', $code))) {
            $pdo->prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?')
                ->execute([$row['id']]);
            return ['ok' => false, 'error' => 'INVALID'];
        }
        return ['ok' => true, 'id' => (int)$row['id']];
    }

    /** Delete the active code for this email+purpose (call after check() succeeds). */
    public static function consume(string $email, string $purpose): void
    {
        $email = strtolower(trim($email));
        Database::getInstance()
            ->prepare('DELETE FROM email_verifications WHERE email = ? AND purpose = ?')
            ->execute([$email, $purpose]);
    }
}
