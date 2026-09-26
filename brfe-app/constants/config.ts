/**
 * App configuration
 */

// ── Local development (XAMPP on your PC) ──────────────────────────────────────
// Use your PC's LAN IP so a physical device on the same Wi-Fi can reach it.
// The admin web and this app MUST point at the SAME backend for the system
// shutdown feature to take effect.
export const BASE_IP = '10.26.117.85';
export const API_BASE_URL = `http://${BASE_IP}/bagoevac/brfe-backend`;
export const WS_BASE_URL = `ws://${BASE_IP}:8080`;

// ── Production (uncomment to build for hosting) ───────────────────────────────
// export const BASE_IP = 'brfe.official.quickycloud.com';
// export const API_BASE_URL = `https://${BASE_IP}/brfe-backend`;
// export const WS_BASE_URL = `wss://${BASE_IP}:8080`;

/**
 * fetch with an explicit timeout. Some auth endpoints send email over SMTP,
 * which can take several seconds, so the default platform timeout can fire and
 * surface as a confusing "Network error". Use a generous timeout for those.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {},
  timeoutMs = 30000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
