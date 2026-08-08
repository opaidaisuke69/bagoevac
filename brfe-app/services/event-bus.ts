/**
 * Shared event bus used by both WebSocket client and polling fallback.
 * Consumers register listeners here and receive events regardless of
 * which transport is currently active.
 */

type EventCallback = (data: unknown) => void;

const listeners: Map<string, Set<EventCallback>> = new Map();

export function on(eventType: string, callback: EventCallback): void {
  if (!listeners.has(eventType)) {
    listeners.set(eventType, new Set());
  }
  listeners.get(eventType)!.add(callback);
}

export function off(eventType: string, callback: EventCallback): void {
  listeners.get(eventType)?.delete(callback);
}

export function emit(eventType: string, data: unknown): void {
  listeners.get(eventType)?.forEach((cb) => cb(data));
}

export function clear(): void {
  listeners.clear();
}
