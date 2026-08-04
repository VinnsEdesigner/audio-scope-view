import { useEffect, useCallback } from "react";
import { useAudioStore, type SystemAudioInfo } from "../store";

function getBrowserInfo(): { name: string; version: string } {
  const ua = navigator.userAgent.toLowerCase();

  // Order matters! Check more specific browsers first

  // === Chromium-based browsers (check before Chrome) ===
  if (ua.includes("edg/")) {
    // Edge (Chromium) - check before Chrome since Edge includes "Chrome" in UA
    const match = ua.match(/edg\/(\d+)/);
    return { name: "Edge", version: match?.[1] ?? "unknown" };
  }
  if (ua.includes("opr/") || ua.includes("opera")) {
    // Opera - check before Chrome since Opera includes "Chrome" in UA
    const match = ua.match(/opr\/(\d+)/) || ua.match(/version\/(\d+)/);
    return { name: "Opera", version: match?.[1] ?? "unknown" };
  }
  if (ua.includes("brave")) {
    // Brave - check before Chrome since Brave includes "Chrome" in UA
    const match = ua.match(/brave\/(\d+)/);
    return { name: "Brave", version: match?.[1] ?? "unknown" };
  }
  if (ua.includes("vivaldi")) {
    const match = ua.match(/vivaldi\/(\d+)/);
    return { name: "Vivaldi", version: match?.[1] ?? "unknown" };
  }
  if (ua.includes("yabrowser") || ua.includes("yandex")) {
    const match = ua.match(/yabrowser\/(\d+)/) || ua.match(/yabrowser\/(\d+)/);
    return { name: "Yandex", version: match?.[1] ?? "unknown" };
  }
  if (ua.includes("whale")) {
    const match = ua.match(/whale\/(\d+)/);
    return { name: "Whale", version: match?.[1] ?? "unknown" };
  }
  if (ua.includes("dragon")) {
    const match = ua.match(/dragon\/(\d+)/);
    return { name: "Comodo Dragon", version: match?.[1] ?? "unknown" };
  }
  if (ua.includes("maxthon")) {
    const match = ua.match(/maxthon\/(\d+)/);
    return { name: "Maxthon", version: match?.[1] ?? "unknown" };
  }
  if (ua.includes("qqbrowser") || ua.includes(" qq/")) {
    const match = ua.match(/qqbrowser\/(\d+)/) || ua.match(/ qq\/(\d+)/);
    return { name: "QQ Browser", version: match?.[1] ?? "unknown" };
  }
  if (ua.includes("bidubrowser") || ua.includes("baidu")) {
    const match = ua.match(/bidubrowser\/(\d+)/) || ua.match(/baidubrowser\/(\d+)/);
    return { name: "Baidu Browser", version: match?.[1] ?? "unknown" };
  }
  if (ua.includes("ubrowser") || ua.includes("ucbrowser") || ua.includes("uc browser")) {
    const match = ua.match(/ubrowser\/(\d+)/) || ua.match(/ucbrowser\/(\d+)/);
    return { name: "UC Browser", version: match?.[1] ?? "unknown" };
  }
  if (ua.includes("samsungbrowser") || ua.includes("samsung browser")) {
    const match = ua.match(/samsungbrowser\/(\d+)/);
    return { name: "Samsung Internet", version: match?.[1] ?? "unknown" };
  }
  if (ua.includes("chrome") && !ua.includes("chromium")) {
    // Chrome (but not Chromium, Edge, Opera, Brave, etc. which include Chrome in UA)
    const match = ua.match(/chrome\/(\d+)/);
    return { name: "Chrome", version: match?.[1] ?? "unknown" };
  }
  if (ua.includes("chromium")) {
    const match = ua.match(/chromium\/(\d+)/);
    return { name: "Chromium", version: match?.[1] ?? "unknown" };
  }

  // === Firefox-based browsers ===
  if (ua.includes("fxios") || ua.includes("firefox ios")) {
    const match = ua.match(/fxios\/(\d+)/);
    return { name: "Firefox iOS", version: match?.[1] ?? "unknown" };
  }
  if (ua.includes("focus")) {
    const match = ua.match(/focus\/(\d+)/);
    return { name: "Firefox Focus", version: match?.[1] ?? "unknown" };
  }
  if (ua.includes("firefox")) {
    const match = ua.match(/firefox\/(\d+)/);
    return { name: "Firefox", version: match?.[1] ?? "unknown" };
  }

  // === Safari and WebKit-based browsers ===
  if (ua.includes("version/") && ua.includes("mobile/") && ua.includes("safari/")) {
    // iOS Safari or iOS WebView
    const match = ua.match(/version\/(\d+)/);
    return { name: "Safari iOS", version: match?.[1] ?? "unknown" };
  }
  if (ua.includes("safari") && !ua.includes("chrome") && !ua.includes("chromium")) {
    // macOS Safari (doesn't include Chrome/Chromium)
    const match = ua.match(/version\/(\d+)/);
    return { name: "Safari", version: match?.[1] ?? "unknown" };
  }

  // === Other browsers ===
  if (ua.includes("playstation")) {
    return { name: "PlayStation Browser", version: "unknown" };
  }
  if (ua.includes("webview") || ua.includes("; wv)")) {
    return { name: "WebView", version: "unknown" };
  }
  if (ua.includes("silk")) {
    return { name: "Amazon Silk", version: "unknown" };
  }
  if (ua.includes("blackberry") || ua.includes("bb10")) {
    return { name: "BlackBerry", version: "unknown" };
  }
  if (ua.includes("iemobile") || ua.includes("windows phone")) {
    const match = ua.match(/iemobile\/(\d+)/);
    return { name: "Internet Explorer Mobile", version: match?.[1] ?? "unknown" };
  }
  if (ua.includes("trident/7")) {
    return { name: "Internet Explorer 11", version: "11" };
  }

  // === Fallback ===
  if (ua.includes("applewebkit")) {
    return { name: "WebKit Browser", version: "unknown" };
  }
  if (ua.includes("gecko")) {
    return { name: "Gecko Browser", version: "unknown" };
  }

  return { name: "Unknown Browser", version: "unknown" };
}

async function getSystemAudioInfo(): Promise<SystemAudioInfo> {
  const { name: browserName, version: browserVersion } = getBrowserInfo();

  // API 2: navigator.mediaDevices.getUserMedia - get supported constraints
  let supportedSampleRates: number[] = [];
  let defaultSampleRate = 48_000;
  let maxChannels = 2;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext();
    defaultSampleRate = audioContext.sampleRate;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    maxChannels = (audioContext as any).maxChannelCount ?? 2;

    // Test common sample rates
    const testRates = [44_100, 48_000, 88_200, 96_000, 176_400, 192_000];
    for (const rate of testRates) {
      try {
        const testContext = new AudioContext({ sampleRate: rate });
        if (testContext.sampleRate === rate) {
          supportedSampleRates.push(rate);
        }
        await testContext.close();
      } catch {
        // Sample rate not supported
      }
    }

    // Cleanup
    for (const track of stream.getTracks()) {
      track.stop();
    }
    await audioContext.close();
  } catch {
    // If getUserMedia fails, still return basic info
    supportedSampleRates = [44_100, 48_000];
  }

  return {
    browserName,
    browserVersion,
    userAgent: navigator.userAgent,
    supportedSampleRates,
    defaultSampleRate,
    maxChannels,
  };
}

export function useMediaDevices() {
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

  // API 1: navigator.mediaDevices.enumerateDevices - get all media devices
  const enumerateDevices = useCallback(async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = deviceList
        .filter((device) => device.kind === "audioinput")
        .map((device) => ({
          deviceId: device.deviceId,
          // Show exact label from browser, fallback to "Unknown Device [ID]"
          label: device.label || `Unknown Device ${device.deviceId.slice(0, 12)}`,
          kind: device.kind as MediaDeviceKind,
          groupId: device.groupId,
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

  // API 2: navigator.mediaDevices.getUserMedia - request microphone access with optional deviceId
  const requestPermission = useCallback(
    async (deviceId?: string) => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: deviceId
            ? {
                deviceId: { exact: deviceId },
                echoCancellation: { exact: false },
                noiseSuppression: { exact: false },
                autoGainControl: { exact: false },
              }
            : {
                echoCancellation: { exact: false },
                noiseSuppression: { exact: false },
                autoGainControl: { exact: false },
              },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Get system audio info when permission is granted
        const info = await getSystemAudioInfo();
        setSystemInfo(info);

        // Stop tracks immediately - we just needed permission and info
        for (const track of stream.getTracks()) {
          track.stop();
        }

        setPermissionState("granted");
        await enumerateDevices();
      } catch (error_) {
        setPermissionState("denied");
        setError(error_ instanceof Error ? error_ : new Error("Microphone permission denied"));
      }
    },
    [enumerateDevices, setPermissionState, setSystemInfo, setError],
  );

  // API 3: navigator.permissions.query - check permission state
  useEffect(() => {
    async function checkPermission() {
      if (!navigator.permissions?.query) {
        // API 3 not available - just enumerate devices and request permission if needed
        await enumerateDevices();
        return;
      }

      try {
        const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
        setPermissionState(result.state);

        if (result.state === "granted") {
          // Permission already granted - enumerate devices and get system info
          await enumerateDevices();
          const info = await getSystemAudioInfo();
          setSystemInfo(info);
        } else if (result.state === "prompt") {
          // Need to request permission
          await enumerateDevices();
        }
        // If denied, we can't do much - user must enable in browser settings

        // Listen for permission changes
        result.addEventListener("change", () => {
          setPermissionState(result.state);
          if (result.state === "granted") {
            enumerateDevices();
          }
        });
      } catch {
        // permissions.query failed - try to enumerate anyway
        await enumerateDevices();
      }
    }

    void checkPermission();

    // Listen for device changes
    navigator.mediaDevices.addEventListener("devicechange", enumerateDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", enumerateDevices);
    };
  }, [enumerateDevices, setPermissionState, setSystemInfo]);

  return {
    devices,
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
