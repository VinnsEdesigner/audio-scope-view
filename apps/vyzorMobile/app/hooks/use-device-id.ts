// use-device-id.ts — RN port of the web hook. The web version reads
// getDeviceId() synchronously from localStorage; RN's storage is async, so
// the id is loaded at app boot by ensureDeviceId() (see _layout) and then
// read synchronously here via getDeviceId().
import { useState } from "react";
import { getDeviceId } from "../lib/device-id";

export function useDeviceId(): string | undefined {
  const [deviceId] = useState(() => getDeviceId());
  return deviceId;
}
