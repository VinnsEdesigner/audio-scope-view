import { useAudioStore } from "../store";

export function useAudioSettings() {
  const { sampleRate, bufferSize, micEnabled, setSampleRate, setBufferSize, setMicEnabled } =
    useAudioStore();

  return {
    sampleRate,
    bufferSize,
    micEnabled,
    setSampleRate,
    setBufferSize,
    setMicEnabled,
  };
}
