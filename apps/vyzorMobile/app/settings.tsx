// Settings screen — capture + DSP configuration. Components were removed
// during the RN port (stubs deleted); this is a minimal shell using plain
// RN primitives until the web-aligned settings UI is written. Persists to
// device storage via the stores (zustand persist + AsyncStorage).
import * as React from "react";
import { ScrollView, View, Pressable, Text } from "react-native";
import { useSettingsStore, type WindowType, type PersistenceMode } from "./store/settings-store";
import { useAudioStore } from "./store/audio-store";

const SAMPLE_RATES = [44_100, 48_000];
const FFT_SIZES = [256, 512, 1024, 2048, 4096, 8192];
const WINDOW_TYPES = ["rectangular", "hann", "hamming", "blackman"] as const;
const CAPTURE_MODES = ["continuous", "single-shot"] as const;
const PERSISTENCE_MODES: PersistenceMode[] = ["server", "local"];

export default function SettingsScreen() {
  const sampleRate = useAudioStore((s) => s.sampleRate);
  const setSampleRate = useAudioStore((s) => s.setSampleRate);
  const fftSize = useSettingsStore((s) => s.fftSize);
  const windowType = useSettingsStore((s) => s.windowType);
  const setFftSize = useSettingsStore((s) => s.setFftSize);
  const setWindowType = useSettingsStore((s) => s.setWindowType);
  const captureMode = useSettingsStore((s) => s.captureMode);
  const setCaptureMode = useSettingsStore((s) => s.setCaptureMode);
  const persistenceMode = useSettingsStore((s) => s.persistenceMode);
  const setPersistenceMode = useSettingsStore((s) => s.setPersistenceMode);

  return (
    <ScrollView className="flex-1 bg-bg-primary" contentContainerClassName="p-4 gap-4">
      <View className="gap-3">
        <Text className="text-text-tertiary text-xs uppercase tracking-widest">
          Capture
        </Text>

        <Text className="text-text-secondary text-sm">Sample Rate</Text>
        <View className="flex-row gap-2">
          {SAMPLE_RATES.map((r) => (
            <Pressable
              key={r}
              onPress={() => setSampleRate(r)}
              className={`flex-1 rounded-md p-2 items-center ${
                sampleRate === r ? "bg-blue-600" : "border border-zinc-600"
              }`}
            >
              <Text className="text-text-primary">{r / 1000}k</Text>
            </Pressable>
          ))}
        </View>

        <Text className="text-text-secondary text-sm mt-2">Capture Mode</Text>
        <View className="flex-row gap-2">
          {CAPTURE_MODES.map((m) => (
            <Pressable
              key={m}
              onPress={() => setCaptureMode(m)}
              className={`flex-1 rounded-md p-2 items-center ${
                captureMode === m ? "bg-blue-600" : "border border-zinc-600"
              }`}
            >
              <Text className="text-text-primary">{m}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="gap-3">
        <Text className="text-text-tertiary text-xs uppercase tracking-widest">
          DSP
        </Text>

        <Text className="text-text-secondary text-sm">FFT Size</Text>
        <View className="flex-row flex-wrap gap-2">
          {FFT_SIZES.map((n) => (
            <Pressable
              key={n}
              onPress={() => setFftSize(n)}
              className={`rounded-md p-2 items-center ${
                fftSize === n ? "bg-blue-600" : "border border-zinc-600"
              }`}
            >
              <Text className="text-text-primary">{n}</Text>
            </Pressable>
          ))}
        </View>

        <Text className="text-text-secondary text-sm mt-2">Window</Text>
        <View className="flex-row flex-wrap gap-2">
          {WINDOW_TYPES.map((w) => (
            <Pressable
              key={w}
              onPress={() => setWindowType(w as WindowType)}
              className={`rounded-md p-2 items-center ${
                windowType === w ? "bg-blue-600" : "border border-zinc-600"
              }`}
            >
              <Text className="text-text-primary capitalize">{w}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="gap-3">
        <Text className="text-text-tertiary text-xs uppercase tracking-widest">
          Storage
        </Text>
        <Text className="text-text-secondary text-sm">Persistence Mode</Text>
        <View className="flex-row gap-2">
          {PERSISTENCE_MODES.map((m) => (
            <Pressable
              key={m}
              onPress={() => setPersistenceMode(m)}
              className={`flex-1 rounded-md p-2 items-center ${
                persistenceMode === m ? "bg-blue-600" : "border border-zinc-600"
              }`}
            >
              <Text className="text-text-primary capitalize">{m}</Text>
            </Pressable>
          ))}
        </View>
        <Text className="text-text-tertiary text-xs">
          {persistenceMode === "local"
            ? "Sessions are saved on-device (Android Room SQLite) and synced to the server when online."
            : "Sessions are written directly to the deployed server (Turso/local SQLite)."}
        </Text>
      </View>
    </ScrollView>
  );
}
