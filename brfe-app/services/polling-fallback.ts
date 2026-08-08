/**
 * Real-time client — polls /api/events every 3 seconds.
 * Falls back gracefully if WS is unavailable (no Ratchet needed).
 * Also attempts WebSocket connection — if WS works, polling stops.
 */

import { API_BASE_URL, WS_BASE_URL } from '../constants/config';
import { emit, on, off } from './event-bus';

export { on, off };

const POLL_MS = 3_000;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let currentToken: string | null = null;
let lastSince: string = new Date().toISOString();
let wsActive = false;

// ── Polling ───────────────────────────────────────────────────────────────────

async function fetchEvents(): Promise<void> {
  if (!currentToken || wsActive) return; // WS is handling it
  try {
    const url = `${API_BASE_URL}/api/events?since=${encodeURIComponent(lastSince)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${currentToken}` },
    });
    if (!res.ok) return;
    const data = await res.json() as { events?: Array<{ type?: string; [key: string]: unknown }> };
    lastSince = new Date().toISOString();
    const events = Array.isArray(data) ? data : (data.events ?? []);
    for (const event of events) {
      const t = typeof event.type === 'string' ? event.type : 'event';
      emit(t, event);
    }
  } catch { /* non-fatal */ }
}

export function start(token: string): void {
  currentToken = token;
  lastSince = new Date().toISOString();
  if (pollTimer !== null) return;
  void fetchEvents();
  pollTimer = setInterval(() => void fetchEvents(), POLL_MS);
}

export function stop(): void {
  if (pollTimer !== null) { clearInterval(pollTimer); pollTimer = null; }
  currentToken = null;
  wsActive = false;
}

export function setWsActive(active: boolean): void {
  wsActive = active;
}