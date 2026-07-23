/**
 * Audio Settings Hook - Manages audio capture settings
 * Sample rate and buffer size for audio capture
 */

import { useAudioStore } from "../store";

export function useAudioSettings() {
  const { sampleRate, bufferSize, setSampleRate, setBufferSize } = useAudioStore();

  return {
    sampleRate,
    bufferSize,
    setSampleRate,
    setBufferSize,
  };
}
