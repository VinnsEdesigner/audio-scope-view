import { useState } from "react";
import { getDeviceId } from "@audio-scope-view/api-client";

/**
 * Exposes the per-device anonymous identity to React components.
 *
 * This is the ONLY way components should access the device/user identity — the
 * underlying value is generated and persisted inside the api-client package and
 * is also injected automatically on every GraphQL/WebSocket request via the
 * `X-Device-Id` header. Components must not import the api client or identity
 * utilities directly; they consume this hook instead.
 *
 * There is no user-facing auth (no signup/login). The id is invisible to the
 * user; the parent platform that embeds this scope system will provide real auth.
 */
export function useDeviceId(): string | undefined {
  // getDeviceId() reads from localStorage synchronously, so a lazy useState
  // initializer keeps it stable across renders without extra effects.
  const [deviceId] = useState(() => getDeviceId());
  return deviceId;
}
