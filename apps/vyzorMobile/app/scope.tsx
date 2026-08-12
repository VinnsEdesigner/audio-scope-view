// Scope screen — the main scope view. Components were removed during the RN
// port (stubs deleted); this is a minimal shell until the web-aligned scope
// components are written. The capture + DSP hooks (use-audio-analyzer +
// use-mobile-scope's measurement path via the scope store) are wired so the
// native DSP path still runs.
import * as React from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { useAudioAnalyzer } from "./hooks/use-audio-analyzer";
import { useScopeStore } from "./store/scope-store";

export default function ScopeScreen() {
  const analyzer = useAudioAnalyzer();
  const spectrum = useScopeStore((s) => s.spectrum);
  const measurements = useScopeStore((s) => s.measurements);
  const isProcessing = useScopeStore((s) => s.isProcessing);
  const error = useScopeStore((s) => s.lastError) ?? analyzer.error;

  return (
    <ScrollView className="flex-1 bg-bg-primary" contentContainerClassName="p-4 gap-4">
      <View className="gap-2">
        <Text className="text-text-tertiary text-xs uppercase tracking-widest">
          Scope
        </Text>
        <Text className="text-text-secondary text-sm">
          {analyzer.isCapturing
            ? `Capturing · ${analyzer.sampleRate} Hz`
            : isProcessing
              ? "Processing…"
              : "Idle"}
        </Text>
        {error ? (
          <Text className="text-red-400 text-xs">
            {error instanceof Error ? error.message : String(error)}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={() =>
          analyzer.isCapturing ? analyzer.stopCapture() : analyzer.startCapture()
        }
        className="rounded-md p-3 items-center bg-blue-600"
      >
        <Text className="text-white">
          {analyzer.isCapturing ? "Stop" : "Start"} Capture
        </Text>
      </Pressable>

      {measurements ? (
        <View className="gap-1">
          <Text className="text-text-secondary text-sm">
            Peak: {measurements.peakAmplitude.toFixed(3)} · RMS:{" "}
            {measurements.rmsAmplitude.toFixed(3)}
          </Text>
          <Text className="text-text-tertiary text-xs">
            Freq: {measurements.dominantFrequency.toFixed(1)} Hz · THD:{" "}
            {(measurements.thd * 100).toFixed(2)}%
          </Text>
        </View>
      ) : (
        <Text className="text-text-tertiary text-xs">
          Start capture to compute measurements.
        </Text>
      )}

      {spectrum ? (
        <View className="gap-1">
          <Text className="text-text-secondary text-sm">
            Peak: {spectrum.peakFrequency.toFixed(1)} Hz @{" "}
            {spectrum.peakMagnitudeDb.toFixed(1)} dB
          </Text>
          <Text className="text-text-tertiary text-xs">
            {spectrum.frequencies.length} bins · {spectrum.windowSize}-pt window
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
