/**
 * Media Devices Hook - Enumerates and manages audio input devices
 * Uses audio-store for state management
 */

import { useEffect, useCallback } from "react";
import { useAudioStore } from "../store";

export function useMediaDevices() {
  const {
    devices,
    selectedDeviceId,
    permissionState,
    error,
    setDevices,
    setSelectedDeviceId,
    setPermissionState,
    setError,
  } = useAudioStore();

  const enumerateDevices = useCallback(async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = deviceList
        .filter((device) => device.kind === "audioinput")
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
          kind: device.kind as MediaDeviceKind,
        }));

      setDevices(audioDevices);

      // Auto-select first device if none selected
      if (!selectedDeviceId && audioDevices.length > 0) {
        setSelectedDeviceId(audioDevices[0].deviceId);
      }
    } catch (error_) {
      setError(error_ instanceof Error ? error_ : new Error("Failed to enumerate devices"));
    }
  }, [selectedDeviceId, setDevices, setSelectedDeviceId, setError]);

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop all tracks immediately after getting permission
      for (const track of stream.getTracks()) {
        track.stop();
      }
      setPermissionState("granted");
      await enumerateDevices();
    } catch (error_) {
      setPermissionState("denied");
      setError(error_ instanceof Error ? error_ : new Error("Microphone permission denied"));
    }
  }, [enumerateDevices, setPermissionState, setError]);

  useEffect(() => {
    // Check current permission state
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((result) => {
        setPermissionState(result.state);
        if (result.state === "granted") {
          enumerateDevices();
        }
      })
      .catch(() => {
        // Permissions API not supported, just enumerate devices
        enumerateDevices();
      });

    // Listen for device changes
    navigator.mediaDevices.addEventListener("devicechange", enumerateDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", enumerateDevices);
    };
  }, [enumerateDevices, setPermissionState]);

  return {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    permissionState,
    requestPermission,
    error,
    refreshDevices: enumerateDevices,
  };
}
