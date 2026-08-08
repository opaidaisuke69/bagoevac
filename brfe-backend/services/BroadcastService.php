<?php
/**
 * Broadcast service — writes events to ws/event_queue.jsonl
 * for the WebSocket server to pick up and distribute.
 */

function broadcastEvent(array $event): void
{
    $queueFile = __DIR__ . '/../ws/event_queue.jsonl';
    $line = json_encode($event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    file_put_contents($queueFile, $line, FILE_APPEND | LOCK_EX);
}
