/**
 * WebSocket + Polling hybrid client.
 * - Always starts polling at 3s intervals (works without Ratchet WS server).
 * - Also tries WebSocket; if it connects, polling pauses (WS is faster).
 * - If WS drops, polling resumes automatically.
 */

import { WS_BASE_URL } from '../constants/config';
import { emit, on, off } from './event-bus';
import * as Polling from './polling-fallback';

export { on, off };

const RECONNECT_MS = 10_000;

let socket: WebSocket | null = null;
let currentToken: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let intentionalDisconnect = false;

function clearReconnect() {
  if (reconnectTimer !== null) { clearTimeout(reconnectTimer); reconnectTimer = null; }
}

function scheduleReconnect() {
  clearReconnect();
  reconnectTimer = setTimeout(() => {
    if (!intentionalDisconnect && currentToken) connectWs(currentToken);
  }, RECONNECT_MS);
}

function connectWs(token: string): void {
  if (socket && socket.readyState !== WebSocket.CLOSED) socket.close();
  const url = `${WS_BASE_URL}?token=${encodeURIComponent(token)}`;
  try {
    socket = new WebSocket(url);
  } catch { return; } // WS not available — polling handles it

  socket.onopen = () => {
    Polling.setWsActive(true); // pause polling while WS is live
  };

  socket.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data as string) as { type?: string; [key: string]: unknown };
      const t = typeof parsed.type === 'string' ? parsed.type : 'message';
      emit(t, parsed);
    } catch {
      emit('message', event.data);
    }
  };

  socket.onclose = () => {
    Polling.setWsActive(false); // resume polling when WS drops
    if (!intentionalDisconnect) scheduleReconnect();
  };

  socket.onerror = () => { /* onclose follows */ };
}

export function connect(token: string): void {
  intentionalDisconnect = false;
  currentToken = token;
  // Always start polling — it works even without the WS server
  Polling.start(token);
  // Also try WS for lower latency
  connectWs(token);
}

export function disconnect(): void {
  intentionalDisconnect = true;
  clearReconnect();
  socket?.close();
  socket = null;
  currentToken = null;
  Polling.stop();
}

export function send(data: unknown): void {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(typeof data === 'string' ? data : JSON.stringify(data));
  }
}