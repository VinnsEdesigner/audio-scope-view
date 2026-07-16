import axios, { type AxiosInstance } from "axios";

/**
 * REST base for the Rust `scope-server`. Configure with `VITE_SCOPE_API_URL`.
 * All non-streaming calls (config, calibration, one-off measurements) go
 * through this axios instance — never the raw fetch API.
 */
export const SCOPE_API_URL =
  (import.meta.env.VITE_SCOPE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8787";

export const SCOPE_WS_URL =
  (import.meta.env.VITE_SCOPE_WS_URL as string | undefined) ??
  SCOPE_API_URL.replace(/^http/, "ws") + "/stream";

export const api: AxiosInstance = axios.create({
  baseURL: SCOPE_API_URL,
  timeout: 8000,
  headers: { "Content-Type": "application/json" },
});