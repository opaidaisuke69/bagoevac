/**
 * System status service.
 * Polls the public /api/system/status endpoint so the app can react when the
 * LGU admin shuts the system down. Evacuees and rescuers are blocked while
 * maintenance mode is on.
 */

import { API_BASE_URL } from '../constants/config';

export interface SystemStatus {
  maintenance: boolean;
  message: string;
}

type StatusCallback = (status: SystemStatus) => void;

let lastStatus: SystemStatus = { maintenance: false, message: '' };
const callbacks = new Set<StatusCallback>();
let timer: ReturnType<typeof setInterval> | null = null;
let watchers = 0;

const DEFAULT_DOWN_MESSAGE =
  'The system has been shut down by the LGU administrator. Please try again later.';

export async function checkStatus(): Promise<SystemStatus> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/system/status`, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    const maintenance = !!data?.maintenance_mode;
    lastStatus = {
      maintenance,
      message: maintenance ? (data?.message || DEFAULT_DOWN_MESSAGE) : '',
    };
  } catch {
    // Network error: don't lock users out on a transient failure — treat as online.
    lastStatus = { maintenance: false, message: '' };
  }
  notify();
  return lastStatus;
}

function notify() {
  callbacks.forEach((cb) => cb(lastStatus));
}

export function getLastStatus(): SystemStatus {
  return lastStatus;
}

/**
 * Subscribe to status updates. Starts polling while there is at least one
 * subscriber. Returns an unsubscribe function.
 */
export function subscribe(cb: StatusCallback, intervalMs = 8000): () => void {
  callbacks.add(cb);
  cb(lastStatus);
  watchers++;

  if (!timer) {
    checkStatus();
    timer = setInterval(checkStatus, intervalMs);
  }

  return () => {
    callbacks.delete(cb);
    watchers = Math.max(0, watchers - 1);
    if (watchers === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
