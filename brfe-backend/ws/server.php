<?php
/**
 * BRFE WebSocket Server
 *
 * Usage:  php ws/server.php
 * Port:   WS_PORT env var (default 8080)
 *
 * Requires: cboden/ratchet ^0.4  (composer install)
 *
 * Behaviour:
 *  - On connect: authenticate via ?token= query param or Cookie JWT.
 *  - Tails ws/event_queue.jsonl every second and broadcasts new lines.
 *  - On client message {"type":"catch_up","last_seen":"ISO8601"}: queries
 *    the DB for events since that timestamp and pushes them to that client.
 */

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../services/JwtService.php';

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;
use React\EventLoop\Loop;
use Firebase\JWT\ExpiredException;

// ── Constants ─────────────────────────────────────────────────────────────────

define('WS_PORT', (int)(getenv('WS_PORT') ?: 8080));
define('EVENT_QUEUE_FILE', __DIR__ . '/event_queue.jsonl');
define('TAIL_INTERVAL', 1.0); // seconds

// ── BrfeWsServer ──────────────────────────────────────────────────────────────

class BrfeWsServer implements MessageComponentInterface
{
    /** @var array<string, array{conn: ConnectionInterface, user_id: int|null, role: string|null}> */
    private array $clients = [];

    /** Current byte offset in the event_queue.jsonl file */
    private int $fileOffset = 0;

    public function __construct()
    {
        // Start tailing from the current end of the file so we only
        // broadcast events that arrive after the server starts.
        if (file_exists(EVENT_QUEUE_FILE)) {
            $this->fileOffset = filesize(EVENT_QUEUE_FILE);
        }
    }

    // ── Ratchet callbacks ─────────────────────────────────────────────────────

    public function onOpen(ConnectionInterface $conn): void
    {
        $resourceId = $conn->resourceId;

        // Extract JWT from ?token= query param or Cookie header
        $token = $this->extractToken($conn);

        $userId = null;
        $role   = null;

        if ($token !== null) {
            try {
                $payload = JwtService::verify($token);
                $userId  = isset($payload['user_id']) ? (int)$payload['user_id'] : null;
                $role    = $payload['role'] ?? null;
            } catch (ExpiredException $e) {
                $conn->send(json_encode(['type' => 'error', 'code' => 'SESSION_EXPIRED']));
                $conn->close();
                return;
            } catch (\Exception $e) {
                $conn->send(json_encode(['type' => 'error', 'code' => 'AUTH_INVALID']));
                $conn->close();
                return;
            }
        } else {
            // Unauthenticated — reject
            $conn->send(json_encode(['type' => 'error', 'code' => 'AUTH_INVALID']));
            $conn->close();
            return;
        }

        $this->clients[$resourceId] = [
            'conn'    => $conn,
            'user_id' => $userId,
            'role'    => $role,
        ];

        $conn->send(json_encode(['type' => 'connected', 'user_id' => $userId, 'role' => $role]));
        echo "[WS] Client {$resourceId} connected (user_id={$userId}, role={$role})\n";
    }

    public function onMessage(ConnectionInterface $from, $msg): void
    {
        $data = json_decode($msg, true);
        if (!is_array($data)) {
            return;
        }

        if (($data['type'] ?? '') === 'catch_up' && isset($data['last_seen'])) {
            $this->handleCatchUp($from, $data['last_seen']);
        }
    }

    public function onClose(ConnectionInterface $conn): void
    {
        $resourceId = $conn->resourceId;
        unset($this->clients[$resourceId]);
        echo "[WS] Client {$resourceId} disconnected\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e): void
    {
        echo "[WS] Error: " . $e->getMessage() . "\n";
        $conn->close();
    }

    // ── Tail event_queue.jsonl ────────────────────────────────────────────────

    public function tailQueue(): void
    {
        if (!file_exists(EVENT_QUEUE_FILE)) {
            return;
        }

        // Clear stat cache so filesize() reflects the latest writes
        clearstatcache(true, EVENT_QUEUE_FILE);
        $currentSize = filesize(EVENT_QUEUE_FILE);

        if ($currentSize <= $this->fileOffset) {
            return; // nothing new
        }

        $fp = fopen(EVENT_QUEUE_FILE, 'r');
        if ($fp === false) {
            return;
        }

        fseek($fp, $this->fileOffset);
        $newData = fread($fp, $currentSize - $this->fileOffset);
        fclose($fp);

        $this->fileOffset = $currentSize;

        if ($newData === false || $newData === '') {
            return;
        }

        foreach (explode("\n", trim($newData)) as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }
            $this->broadcast($line);
        }
    }

    // ── Catch-up: push DB events since last_seen ──────────────────────────────

    private function handleCatchUp(ConnectionInterface $conn, string $lastSeen): void
    {
        try {
            $events = $this->fetchEventsSince($lastSeen);
        } catch (\Exception $e) {
            $conn->send(json_encode(['type' => 'error', 'code' => 'CATCH_UP_FAILED', 'message' => $e->getMessage()]));
            return;
        }

        foreach ($events as $event) {
            $conn->send(json_encode($event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        }

        $conn->send(json_encode(['type' => 'catch_up_complete', 'count' => count($events)]));
    }

    // ── Broadcast to all connected clients ────────────────────────────────────

    private function broadcast(string $json): void
    {
        foreach ($this->clients as $client) {
            $client['conn']->send($json);
        }
    }

    // ── Token extraction ──────────────────────────────────────────────────────

    private function extractToken(ConnectionInterface $conn): ?string
    {
        // Ratchet exposes the HTTP request via $conn->httpRequest (PSR-7)
        $request = $conn->httpRequest ?? null;

        if ($request !== null) {
            // 1. ?token= query param
            parse_str($request->getUri()->getQuery(), $queryParams);
            if (!empty($queryParams['token'])) {
                return $queryParams['token'];
            }

            // 2. Cookie: jwt=<token>
            $cookieHeader = $request->getHeaderLine('Cookie');
            if ($cookieHeader !== '') {
                foreach (explode(';', $cookieHeader) as $part) {
                    [$name, $value] = array_pad(explode('=', trim($part), 2), 2, '');
                    if (trim($name) === 'jwt') {
                        return trim($value);
                    }
                }
            }
        }

        return null;
    }

    // ── DB query for catch-up events ──────────────────────────────────────────

    private function fetchEventsSince(string $since): array
    {
        $pdo = Database::getInstance();
        $ts  = date('Y-m-d H:i:s', strtotime($since));
        $events = [];

        // location_update
        $stmt = $pdo->prepare(
            'SELECT l.id, l.user_id, l.lat, l.lng, l.recorded_at
               FROM locations l
              WHERE l.recorded_at > ?
              ORDER BY l.recorded_at ASC'
        );
        $stmt->execute([$ts]);
        foreach ($stmt->fetchAll() as $row) {
            $events[] = [
                'type'        => 'location_update',
                'id'          => (int)$row['id'],
                'user_id'     => (int)$row['user_id'],
                'lat'         => (float)$row['lat'],
                'lng'         => (float)$row['lng'],
                'recorded_at' => $row['recorded_at'],
            ];
        }

        // status_change
        $stmt = $pdo->prepare(
            'SELECT su.id, su.user_id, su.status, su.changed_at
               FROM status_updates su
              WHERE su.changed_at > ?
              ORDER BY su.changed_at ASC'
        );
        $stmt->execute([$ts]);
        foreach ($stmt->fetchAll() as $row) {
            $events[] = [
                'type'       => 'status_change',
                'id'         => (int)$row['id'],
                'user_id'    => (int)$row['user_id'],
                'status'     => $row['status'],
                'changed_at' => $row['changed_at'],
            ];
        }

        // rescue_request (new ones)
        $stmt = $pdo->prepare(
            'SELECT rr.id, rr.user_id, rr.lat, rr.lng, rr.status_at_request,
                    rr.req_status, rr.requested_at
               FROM rescue_requests rr
              WHERE rr.requested_at > ?
              ORDER BY rr.requested_at ASC'
        );
        $stmt->execute([$ts]);
        foreach ($stmt->fetchAll() as $row) {
            $events[] = [
                'type'              => 'rescue_request',
                'id'                => (int)$row['id'],
                'user_id'           => (int)$row['user_id'],
                'lat'               => (float)$row['lat'],
                'lng'               => (float)$row['lng'],
                'status_at_request' => $row['status_at_request'],
                'req_status'        => $row['req_status'],
                'requested_at'      => $row['requested_at'],
            ];
        }

        // disaster_report
        $stmt = $pdo->prepare(
            'SELECT r.id, r.user_id, r.flood_level, r.description,
                    r.lat, r.lng, r.submitted_at
               FROM reports r
              WHERE r.submitted_at > ?
              ORDER BY r.submitted_at ASC'
        );
        $stmt->execute([$ts]);
        foreach ($stmt->fetchAll() as $row) {
            $events[] = [
                'type'        => 'disaster_report',
                'id'          => (int)$row['id'],
                'user_id'     => (int)$row['user_id'],
                'flood_level' => $row['flood_level'],
                'description' => $row['description'],
                'lat'         => (float)$row['lat'],
                'lng'         => (float)$row['lng'],
                'submitted_at'=> $row['submitted_at'],
            ];
        }

        // center_update
        $stmt = $pdo->prepare(
            'SELECT ec.id, ec.name, ec.address, ec.lat, ec.lng,
                    ec.max_capacity, ec.occupancy, ec.op_status, ec.updated_at
               FROM evacuation_centers ec
              WHERE ec.updated_at > ?
              ORDER BY ec.updated_at ASC'
        );
        $stmt->execute([$ts]);
        foreach ($stmt->fetchAll() as $row) {
            $events[] = [
                'type'         => 'center_update',
                'id'           => (int)$row['id'],
                'name'         => $row['name'],
                'address'      => $row['address'],
                'lat'          => (float)$row['lat'],
                'lng'          => (float)$row['lng'],
                'max_capacity' => (int)$row['max_capacity'],
                'occupancy'    => (int)$row['occupancy'],
                'op_status'    => $row['op_status'],
                'updated_at'   => $row['updated_at'],
            ];
        }

        // chat_message
        $stmt = $pdo->prepare(
            'SELECT cm.id, cm.sender_type, cm.sender_id, cm.recipient_type,
                    cm.recipient_id, cm.body, cm.sent_at,
                    COALESCE(u.full_name, la.username) AS sender_name,
                    u.avatar_path AS avatar_path
               FROM chat_messages cm
               LEFT JOIN users u ON cm.sender_type = "evacuee" AND cm.sender_id = u.id
               LEFT JOIN lgu_accounts la ON cm.sender_type = "lgu" AND cm.sender_id = la.id
              WHERE cm.sent_at > ?
              ORDER BY cm.sent_at ASC'
        );
        $stmt->execute([$ts]);
        foreach ($stmt->fetchAll() as $row) {
            $events[] = [
                'type'           => 'chat_message',
                'id'             => (int)$row['id'],
                'sender_type'    => $row['sender_type'],
                'sender_id'      => (int)$row['sender_id'],
                'sender_name'    => $row['sender_name'] ?? 'Unknown',
                'avatar_path'    => $row['avatar_path'] ?? null,
                'recipient_type' => $row['recipient_type'],
                'recipient_id'   => $row['recipient_id'] !== null ? (int)$row['recipient_id'] : null,
                'body'           => $row['body'],
                'sent_at'        => $row['sent_at'],
            ];
        }

        // Sort all events by their timestamp field
        usort($events, function (array $a, array $b): int {
            $tsA = $a['recorded_at'] ?? $a['changed_at'] ?? $a['requested_at']
                ?? $a['submitted_at'] ?? $a['updated_at'] ?? $a['sent_at'] ?? '';
            $tsB = $b['recorded_at'] ?? $b['changed_at'] ?? $b['requested_at']
                ?? $b['submitted_at'] ?? $b['updated_at'] ?? $b['sent_at'] ?? '';
            return strcmp($tsA, $tsB);
        });

        return $events;
    }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

$loop   = Loop::get();
$server = new BrfeWsServer();

// Register the 1-second tail timer
$loop->addPeriodicTimer(TAIL_INTERVAL, function () use ($server): void {
    $server->tailQueue();
});

$socket = new \React\Socket\SocketServer('0.0.0.0:' . WS_PORT, [], $loop);

$wsServer = new IoServer(
    new HttpServer(
        new WsServer($server)
    ),
    $socket,
    $loop
);

echo "[WS] BRFE WebSocket server listening on port " . WS_PORT . "\n";

$loop->run();
