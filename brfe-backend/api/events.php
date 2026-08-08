<?php
/**
 * GET /api/events?since=<ISO8601>
 *
 * Polling fallback endpoint — returns all events from the DB since the
 * given timestamp. Accepts both JWT Bearer auth (evacuees) and LGU
 * session auth.
 *
 * Query params:
 *   since  (required) ISO 8601 timestamp, e.g. 2024-01-15T10:30:00Z
 *
 * Response:
 *   {"events": [...]}
 *
 * Event types returned:
 *   location_update, status_change, rescue_request, disaster_report,
 *   center_update, chat_message
 */

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../api/response.php';
require_once __DIR__ . '/../services/JwtService.php';

use Firebase\JWT\ExpiredException;

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    exit;
}

// ── Auth: JWT Bearer OR LGU session ──────────────────────────────────────────

$authUser = null;

// 1. Try JWT Bearer token
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (strpos($authHeader, 'Bearer ') === 0) {
    $token = substr($authHeader, 7);
    try {
        $authUser = JwtService::verify($token);
    } catch (ExpiredException $e) {
        errorSessionExpired();
    } catch (\Exception $e) {
        errorAuthInvalid();
    }
}

// 2. Fall back to LGU session
if ($authUser === null) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    $lguUser = $_SESSION['lgu_user'] ?? null;

    if ($lguUser !== null) {
        $timeout = 3600;
        if ((time() - (int)$lguUser['last_activity']) > $timeout) {
            unset($_SESSION['lgu_user']);
            errorSessionExpired();
        }
        $_SESSION['lgu_user']['last_activity'] = time();
        $authUser = $lguUser;
    }
}

if ($authUser === null) {
    errorAuthInvalid();
}

// ── Validate `since` param ────────────────────────────────────────────────────

$sinceRaw = $_GET['since'] ?? '';
if ($sinceRaw === '') {
    errorValidation(['since' => '`since` query parameter is required (ISO 8601).']);
}

$sinceTs = strtotime($sinceRaw);
if ($sinceTs === false) {
    errorValidation(['since' => '`since` must be a valid ISO 8601 timestamp.']);
}

$since = date('Y-m-d H:i:s', $sinceTs);

// ── Query DB for events ───────────────────────────────────────────────────────

$pdo    = Database::getInstance();
$events = [];

// location_update
$stmt = $pdo->prepare(
    'SELECT l.id, l.user_id, l.lat, l.lng, l.recorded_at
       FROM locations l
      WHERE l.recorded_at > ?
      ORDER BY l.recorded_at ASC'
);
$stmt->execute([$since]);
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
$stmt->execute([$since]);
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
$stmt->execute([$since]);
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
$stmt->execute([$since]);
foreach ($stmt->fetchAll() as $row) {
    $events[] = [
        'type'         => 'disaster_report',
        'id'           => (int)$row['id'],
        'user_id'      => (int)$row['user_id'],
        'flood_level'  => $row['flood_level'],
        'description'  => $row['description'],
        'lat'          => (float)$row['lat'],
        'lng'          => (float)$row['lng'],
        'submitted_at' => $row['submitted_at'],
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
$stmt->execute([$since]);
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
$stmt->execute([$since]);
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

// notification — only for the authenticated evacuee
$authUserId = isset($authUser['user_id']) ? (int)$authUser['user_id'] : null;
if ($authUserId) {
    try {
        $stmt = $pdo->prepare(
            'SELECT id, type, title, body, data, is_read, created_at
               FROM notifications
              WHERE user_id = ? AND created_at > ?
              ORDER BY created_at ASC'
        );
        $stmt->execute([$authUserId, $since]);
        foreach ($stmt->fetchAll() as $row) {
            $events[] = [
                'type'       => 'notification',
                'id'         => (int)$row['id'],
                'user_id'    => $authUserId,
                'notif_type' => $row['type'],
                'title'      => $row['title'],
                'body'       => $row['body'],
                'data'       => $row['data'] ? json_decode($row['data'], true) : null,
                'is_read'    => (bool)$row['is_read'],
                'created_at' => $row['created_at'],
            ];
        }
    } catch (\Exception $e) {
        // notifications table may not exist yet — skip silently
    }
}

// ── Sort all events chronologically ──────────────────────────────────────────

usort($events, function (array $a, array $b): int {
    $tsA = $a['recorded_at'] ?? $a['changed_at'] ?? $a['requested_at']
        ?? $a['submitted_at'] ?? $a['updated_at'] ?? $a['sent_at'] ?? $a['created_at'] ?? '';
    $tsB = $b['recorded_at'] ?? $b['changed_at'] ?? $b['requested_at']
        ?? $b['submitted_at'] ?? $b['updated_at'] ?? $b['sent_at'] ?? $b['created_at'] ?? '';
    return strcmp($tsA, $tsB);
});

jsonSuccess(['events' => $events]);
