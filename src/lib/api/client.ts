import axios, { type AxiosInstance } from "axios";

/**
 * Same-origin REST base. All scope DSP runs inside this app's TanStack
 * Start server routes under `/api/scope/*` (Cloudflare Workers). No
 * external server, no WebSocket — every call goes through axios.
 */
export const SCOPE_API_BASE = "/api/scope";

export const api: AxiosInstance = axios.create({
  baseURL: SCOPE_API_BASE,
  timeout: 8000,
});