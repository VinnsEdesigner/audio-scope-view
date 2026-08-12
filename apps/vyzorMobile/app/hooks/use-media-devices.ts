// use-media-devices.ts — RN port of the web hook. The web version enumerates
// via navigator.mediaDevices.enumerateDevices and probes AudioContext for
// supported sample rates. On RN, capture runs through Oboe (sdk/bindings/
// android/oboe_capture.cpp) exposed via the native DSP bridge. Device
// enumeration is done entirely in C++ (sdk/bindings/android/
// device_enumeration.cpp): AudioManager.getDevices(GET_DEVICES_INPUTS) driven
// via JNI from C++ + a /proc/asound parse for USB vendor/product ids. The
// returned `id` is the Oboe device id — pass it to startCapture() to route
// capture to a specific device (e.g. a USB mic).
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  Dsp,
  type CaptureHandle,
  type AudioInputDevice,
  type AudioInputDeviceKind,
} from "../lib/native-dsp-bridge";
import { useAudioStore, type MediaDevice, type SystemAudioInfo } from "../store";

function getSystemInfo(): SystemAudioInfo {
  // Oboe reports 48 kHz by default on Android 8.1+; 44.1 kHz on older. We
  // advertise both as supported and let startCapture pick the device rate.
  return {
    platform: Platform.OS,
    supportedSampleRates: [44_100, 48_000],
    defaultSampleRate: 48_000,
    maxChannels: 1,
  };
}

function kindLabel(type: AudioInputDeviceKind): string {
  switch (type) {
    case "builtin-mic":    return "Built-in microphone";
    case "wired-headset":  return "Wired headset";
    case "wired-headphones": return "Wired headphones";
    case "usb-device":     return "USB device";
    case "usb-headset":    return "USB headset";
    case "bluetooth-sco":  return "Bluetooth (SCO)";
    case "bluetooth-a2dp": return "Bluetooth (A2DP)";
    case "dock":           return "Dock";
    case "hdmi":           return "HDMI";
    case "telephony":      return "Telephony";
    case "fm":             return "FM";
    default:               return "Unknown";
  }
}

export interface UseMediaDevicesReturn {
  devices: MediaDevice[];
  /** The full richer device list (with USB vendor/product, sample rates,
   * channels, type) for UI that wants to show more than the MediaDevice shape. */
  inputDevices: AudioInputDevice[];
  selectedDeviceId: string | undefined;
  setSelectedDeviceId: (id: string | undefined) => void;
  permissionState: "prompt" | "granted" | "denied";
  hasPermission: boolean;
  requestPermission: () => Promise<void>;
  systemInfo: SystemAudioInfo | undefined;
  error: Error | undefined;
  refreshDevices: () => Promise<void>;
}

export function useMediaDevices(): UseMediaDevicesReturn {
  const {
    devices,
    selectedDeviceId,
    permissionState,
    systemInfo,
    error,
    setDevices,
    setSelectedDeviceId,
    setPermissionState,
    setSystemInfo,
    setError,
  } = useAudioStore();

  const [binding, setBinding] = useState<CaptureHandle | null>(null);
  const [inputDevices, setInputDevices] = useState<AudioInputDevice[]>([]);

  // Enumerate real connected input devices by name via the C++ bridge. No
  // capture binding is required for enumeration (it's an AudioManager query);
  // the binding handle is kept only for callers that previously used it. The
  // resulting `id` is the Oboe device id used to route startCapture().
  const enumerateDevices = useCallback(async () => {
    let handle: CaptureHandle | null = null;
    try {
      // Keep a binding alive for compatibility with callers that pair
      // enumerate + capture; it's cheap and freed on unmount.
      handle = await Dsp.createBinding();
      setBinding(handle);

      let enumerated: AudioInputDevice[] = [];
      try {
        enumerated = await Dsp.enumerateInputDevices();
      } catch {
        // Enumeration is best-effort; fall back to the Oboe default below.
        enumerated = [];
      }

      if (enumerated.length === 0) {
        // The C++ AudioManager query returned nothing (older API, or no
        // permission yet). Surface the Oboe default so capture still works.
        enumerated = [
          {
            id: "default",
            name: "Default input (Oboe)",
            type: "builtin-mic",
            productName: "Default input (Oboe)",
            isDefault: true,
            sampleRates: [44_100, 48_000],
            channels: [1],
          },
        ];
      }

      setInputDevices(enumerated);

      // Map the rich list into the web's MediaDevice shape for the store.
      const audioDevices: MediaDevice[] = enumerated.map((d) => ({
        deviceId: d.id,
        label: d.productName || d.name,
        kind: "audioinput",
        groupId: d.type,
      }));
      setDevices(audioDevices);

      // Auto-select the framework default (or the first device).
      const nextSelected =
        selectedDeviceId && audioDevices.some((d) => d.deviceId === selectedDeviceId)
          ? selectedDeviceId
          : (enumerated.find((d) => d.isDefault)?.id ?? audioDevices[0]?.deviceId);
      if (nextSelected) setSelectedDeviceId(nextSelected);

      setSystemInfo(getSystemInfo());
    } catch (error_) {
      setError(error_ instanceof Error ? error_ : new Error("Failed to enumerate devices"));
    } finally {
      if (handle != null) {
        try {
          await Dsp.destroyBinding(handle);
        } catch {
          /* ignore */
        }
        setBinding(null);
      }
    }
  }, [selectedDeviceId, setDevices, setSelectedDeviceId, setSystemInfo, setError]);

  // RN has no navigator.permissions; on Android the RECORD_AUDIO permission is
  // requested at capture start (see use-audio-analyzer). Treat the presence of
  // devices as "granted".
  const requestPermission = useCallback(async () => {
    await enumerateDevices();
    setPermissionState("granted");
  }, [enumerateDevices, setPermissionState]);

  useEffect(() => {
    void enumerateDevices();
    return () => {
      if (binding != null) {
        void Dsp.destroyBinding(binding);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    devices,
    inputDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    permissionState,
    hasPermission: permissionState === "granted",
    requestPermission,
    systemInfo,
    error,
    refreshDevices: enumerateDevices,
  };
}

export { kindLabel };

