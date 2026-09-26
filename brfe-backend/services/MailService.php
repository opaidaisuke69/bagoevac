<?php
/**
 * MailService — application-level email sending for BRFE.
 *
 * Wraps SmtpMailer and provides ready-made templates for the two flows that
 * need email: registration verification and password reset. Reads SMTP config
 * from env.php.
 */

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/SmtpMailer.php';

class MailService
{
    private static function mailer(): SmtpMailer
    {
        return new SmtpMailer(
            SMTP_HOST,
            SMTP_PORT,
            SMTP_USER,
            SMTP_PASS,
            SMTP_SECURE
        );
    }

    /** Send a verification code for a NEW account registration. */
    public static function sendRegistrationCode(string $toEmail, string $code, string $name = ''): bool
    {
        $subject = 'Your BRFE verification code';
        $intro   = 'Use the code below to verify your email and finish creating your Bago Evac account.';
        $html    = self::codeTemplate($name, $code, $intro);
        $text    = "Your BRFE verification code is: {$code}\nIt expires in "
                 . (OTP_TTL_SECONDS / 60) . " minutes.\nIf you didn't request this, you can ignore this email.";
        return self::deliver($toEmail, $name, $subject, $html, $text);
    }

    /** Send a password-reset code. */
    public static function sendPasswordResetCode(string $toEmail, string $code, string $name = ''): bool
    {
        $subject = 'Reset your BRFE password';
        $intro   = 'We received a request to reset your Bago Evac password. Enter the code below to continue.';
        $html    = self::codeTemplate($name, $code, $intro, true);
        $text    = "Your BRFE password reset code is: {$code}\nIt expires in "
                 . (OTP_TTL_SECONDS / 60) . " minutes.\nIf you didn't request this, you can ignore this email — your password will not change.";
        return self::deliver($toEmail, $name, $subject, $html, $text);
    }

    private static function deliver(string $toEmail, string $toName, string $subject, string $html, string $text): bool
    {
        $mailer = self::mailer();
        try {
            return $mailer->send(
                SMTP_FROM_EMAIL,
                SMTP_FROM_NAME,
                $toEmail,
                $toName,
                $subject,
                $html,
                $text
            );
        } catch (\Throwable $e) {
            // Log the transcript for server-side debugging; never expose to client.
            error_log('[MailService] send failed: ' . $e->getMessage());
            if (!empty($mailer->log)) {
                error_log('[MailService] transcript: ' . implode(' | ', $mailer->log));
            }
            return false;
        }
    }

    /** Branded HTML template with a large, copyable code. */
    private static function codeTemplate(string $name, string $code, string $intro, bool $isReset = false): string
    {
        $safeName = htmlspecialchars($name !== '' ? $name : 'there', ENT_QUOTES, 'UTF-8');
        $safeCode = htmlspecialchars($code, ENT_QUOTES, 'UTF-8');
        $ttlMin   = (int)(OTP_TTL_SECONDS / 60);
        $accent   = '#1d4ed8';
        $spacedCode = trim(chunk_split($safeCode, 1, ' '));

        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="width:440px;max-width:92%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.08);">
        <tr>
          <td style="background:{$accent};padding:28px 32px;text-align:center;">
            <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:4px;">B R F E</div>
            <div style="color:rgba(255,255,255,0.75);font-size:12px;margin-top:4px;">Bago Residents Flood Evacuees</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 6px;font-size:16px;color:#0f172a;font-weight:700;">Hi {$safeName},</p>
            <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.55;">{$intro}</p>
            <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:20px;text-align:center;">
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Your code</div>
              <div style="font-size:34px;font-weight:800;color:{$accent};letter-spacing:8px;">{$spacedCode}</div>
            </div>
            <p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.55;">
              This code expires in <strong>{$ttlMin} minutes</strong>. If you didn't request this, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 28px;border-top:1px solid #f1f5f9;">
            <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">This is an automated message from Bago Evac. Please do not reply.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;
    }
}
