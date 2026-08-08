/**
 * App configuration
 * BASE_IP = your PC's local IP on the same WiFi as the phone
 */

export const BASE_IP = '10.50.142.85';
export const BASE_PORT = '80';

// API base — points to brfe-backend
export const API_BASE_URL = `http://${BASE_IP}:${BASE_PORT}/bagoevac/brfe-backend`;
export const WS_BASE_URL = `ws://${BASE_IP}:8080`;
