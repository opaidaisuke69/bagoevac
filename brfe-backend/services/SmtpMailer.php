<?php
/**
 * SmtpMailer — a small, dependency-free SMTP client.
 *
 * Speaks SMTP directly over a socket so the backend can send mail without
 * Composer/PHPMailer being installed. Supports implicit TLS (port 465, "ssl")
 * and STARTTLS (port 587, "tls"), AUTH LOGIN, and a single HTML message with a
 * plaintext alternative.
 *
 * This is intentionally minimal: one recipient, one message. It is used by
 * MailService to deliver OTP / password-reset emails.
 */

class SmtpMailer
{
    private $host;
    private $port;
    private $user;
    private $pass;
    private $secure;      // 'ssl' | 'tls' | ''
    private $timeout;
    private $socket = null;
    /** @var string[] transcript of the SMTP conversation (for debugging). */
    public array $log = [];

    public function __construct(string $host, int $port, string $user, string $pass, string $secure = 'ssl', int $timeout = 15)
    {
        $this->host    = $host;
        $this->port    = $port;
        $this->user    = $user;
        $this->pass    = $pass;
        $this->secure  = strtolower($secure);
        $this->timeout = $timeout;
    }

    /**
     * Send an HTML email (with plaintext fallback).
     *
     * @throws \RuntimeException on any connection / protocol / auth failure.
     */
    public function send(
        string $fromEmail,
        string $fromName,
        string $toEmail,
        string $toName,
        string $subject,
        string $htmlBody,
        string $textBody = ''
    ): bool {
        $transport = ($this->secure === 'ssl') ? "ssl://{$this->host}" : $this->host;

        $errno = 0; $errstr = '';
        $ctx = stream_context_create([
            'ssl' => [
                'verify_peer'       => false,
                'verify_peer_name'  => false,
                'allow_self_signed' => true,
            ],
        ]);
        $this->socket = @stream_socket_client(
            "{$transport}:{$this->port}",
            $errno,
            $errstr,
            $this->timeout,
            STREAM_CLIENT_CONNECT,
            $ctx
        );

        if (!$this->socket) {
            throw new \RuntimeException("SMTP connect failed: {$errstr} ({$errno})");
        }
        stream_set_timeout($this->socket, $this->timeout);

        $this->expect('220');

        $ehloHost = $this->safeHostname();
        $this->cmd("EHLO {$ehloHost}", '250');

        // STARTTLS upgrade for port 587-style connections.
        if ($this->secure === 'tls') {
            $this->cmd('STARTTLS', '220');
            $ok = @stream_socket_enable_crypto(
                $this->socket,
                true,
                STREAM_CRYPTO_METHOD_TLS_CLIENT
                    | STREAM_CRYPTO_METHOD_TLSv1_1_CLIENT
                    | STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT
            );
            if (!$ok) {
                $this->close();
                throw new \RuntimeException('STARTTLS negotiation failed');
            }
            $this->cmd("EHLO {$ehloHost}", '250');
        }

        // AUTH LOGIN
        $this->cmd('AUTH LOGIN', '334');
        $this->cmd(base64_encode($this->user), '334');
        $this->cmd(base64_encode($this->pass), '235');

        // Envelope
        $this->cmd('MAIL FROM:<' . $fromEmail . '>', '250');
        $this->cmd('RCPT TO:<' . $toEmail . '>', '250');
        $this->cmd('DATA', '354');

        $message = $this->buildMime($fromEmail, $fromName, $toEmail, $toName, $subject, $htmlBody, $textBody);
        // Terminate with <CRLF>.<CRLF>
        $this->write($message . "\r\n.");
        $this->expect('250');

        $this->cmd('QUIT', '221', false);
        $this->close();

        return true;
    }

    private function buildMime(
        string $fromEmail,
        string $fromName,
        string $toEmail,
        string $toName,
        string $subject,
        string $htmlBody,
        string $textBody
    ): string {
        $boundary = 'brfe_' . bin2hex(random_bytes(12));
        $date     = date('r');
        $msgId    = '<' . bin2hex(random_bytes(16)) . '@' . $this->safeHostname() . '>';

        if ($textBody === '') {
            // Naive HTML→text fallback.
            $textBody = trim(preg_replace('/\s+/', ' ', strip_tags($htmlBody)));
        }

        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $fromNameEnc    = '=?UTF-8?B?' . base64_encode($fromName) . '?=';
        $toNameEnc      = $toName !== '' ? ('=?UTF-8?B?' . base64_encode($toName) . '?= ') : '';

        $headers = [];
        $headers[] = "Date: {$date}";
        $headers[] = "From: {$fromNameEnc} <{$fromEmail}>";
        $headers[] = "To: {$toNameEnc}<{$toEmail}>";
        $headers[] = "Subject: {$encodedSubject}";
        $headers[] = "Message-ID: {$msgId}";
        $headers[] = 'MIME-Version: 1.0';
        $headers[] = "Content-Type: multipart/alternative; boundary=\"{$boundary}\"";

        $body  = "--{$boundary}\r\n";
        $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $body .= chunk_split(base64_encode($textBody)) . "\r\n";
        $body .= "--{$boundary}\r\n";
        $body .= "Content-Type: text/html; charset=UTF-8\r\n";
        $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $body .= chunk_split(base64_encode($htmlBody)) . "\r\n";
        $body .= "--{$boundary}--";

        // Dot-stuff any lines that begin with '.' per RFC 5321.
        $mime = implode("\r\n", $headers) . "\r\n\r\n" . $body;
        $mime = preg_replace('/^\./m', '..', $mime);

        return $mime;
    }

    private function cmd(string $command, string $expectedCode, bool $wantReply = true): void
    {
        $this->write($command);
        if ($wantReply) {
            $this->expect($expectedCode);
        }
    }

    private function write(string $data): void
    {
        $this->log[] = '>>> ' . preg_replace('/(AUTH LOGIN\r?\n?).*/', '$1***', $data);
        fwrite($this->socket, $data . "\r\n");
    }

    private function expect(string $code): string
    {
        $response = '';
        while (($line = fgets($this->socket, 515)) !== false) {
            $response .= $line;
            // Multi-line replies use "250-", the final line uses "250 ".
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        $this->log[] = '<<< ' . trim($response);

        if (strncmp($response, $code, strlen($code)) !== 0) {
            $this->close();
            throw new \RuntimeException("SMTP error: expected {$code}, got: " . trim($response));
        }
        return $response;
    }

    private function safeHostname(): string
    {
        $h = $_SERVER['SERVER_NAME'] ?? (gethostname() ?: 'localhost');
        // EHLO argument must be a valid domain/atom; strip anything unusual.
        $h = preg_replace('/[^A-Za-z0-9.\-]/', '', $h);
        return $h !== '' ? $h : 'localhost';
    }

    private function close(): void
    {
        if ($this->socket) {
            @fclose($this->socket);
            $this->socket = null;
        }
    }
}
