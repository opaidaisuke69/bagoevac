<?php
require_once __DIR__ . '/../config/env.php';

class JwtService
{
    public static function encode(array $payload): string
    {
        $header = self::base64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $payload['iat'] = time();
        $payload['exp'] = time() + JWT_EXPIRY_SECONDS;
        $payloadB64 = self::base64url(json_encode($payload));
        $signature = self::base64url(hash_hmac('sha256', "$header.$payloadB64", JWT_SECRET, true));
        return "$header.$payloadB64.$signature";
    }

    public static function verify(string $token): array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new \Exception('Invalid token format');
        }

        [$header, $payload, $signature] = $parts;
        $expectedSig = self::base64url(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));

        if (!hash_equals($expectedSig, $signature)) {
            throw new \Exception('Invalid signature');
        }

        $data = json_decode(self::base64urlDecode($payload), true);
        if (!$data) {
            throw new \Exception('Invalid payload');
        }

        if (isset($data['exp']) && $data['exp'] < time()) {
            throw new \Exception('Token expired');
        }

        return $data;
    }

    private static function base64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64urlDecode(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
