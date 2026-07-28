

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
