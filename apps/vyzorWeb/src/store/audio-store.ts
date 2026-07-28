

import { create } from "zustand";

export interface MediaDevice {
 deviceId: string;
 label: string;
 kind: MediaDeviceKind;
}

export interface ProcessedAudio {
 samples: Float32Array;
 sampleRate: number;
 timestamp: number;
 channels: number;
}

export interface AudioState {
 
 isCapturing: boolean;
 stream: MediaStream | undefined;
 error: Error | undefined;
 processedAudio: ProcessedAudio | undefined;

 
 devices: MediaDevice[];
 selectedDeviceId: string | undefined;
 permissionState: PermissionState;

 
 sampleRate: number;
 bufferSize: number;

 
 audioContext: AudioContext | undefined;
}

export interface AudioActions {
 
 setCapturing: (isCapturing: boolean) => void;
 setStream: (stream: MediaStream | undefined) => void;
 setError: (error: Error | undefined) => void;
 setProcessedAudio: (audio: ProcessedAudio | undefined) => void;
 setAudioContext: (context: AudioContext | undefined) => void;

 
 setDevices: (devices: MediaDevice[]) => void;
 setSelectedDeviceId: (deviceId: string | undefined) => void;
 setPermissionState: (state: PermissionState) => void;

 
 setSampleRate: (sampleRate: number) => void;
 setBufferSize: (bufferSize: number) => void;

 
 resetCapture: () => void;
 resetDevices: () => void;
 resetAll: () => void;
}

export type AudioStore = AudioState & AudioActions;

const initialState: AudioState = {
 isCapturing: false,
 stream: undefined,
 error: undefined,
 processedAudio: undefined,
 devices: [],
 selectedDeviceId: undefined,
 permissionState: "prompt",
 sampleRate: 48_000,
 bufferSize: 512,
 audioContext: undefined,
};

export const useAudioStore = create<AudioStore>((set) => ({
 ...initialState,

 
 setCapturing: (isCapturing) => set({ isCapturing }),
 setStream: (stream) => set({ stream }),
 setError: (error) => set({ error }),
 setProcessedAudio: (processedAudio) => set({ processedAudio }),
 setAudioContext: (audioContext) => set({ audioContext }),

 
 setDevices: (devices) => set({ devices }),
 setSelectedDeviceId: (selectedDeviceId) =>
 set((state) => {
 
 const shouldAutoSelect = selectedDeviceId === undefined && state.devices.length > 0;
 return {
 selectedDeviceId: shouldAutoSelect ? state.devices[0].deviceId : selectedDeviceId,
 };
 }),
 setPermissionState: (permissionState) => set({ permissionState }),

 
 setSampleRate: (sampleRate) => set({ sampleRate }),
 setBufferSize: (bufferSize) => set({ bufferSize }),

 
 resetCapture: () =>
 set({
 isCapturing: false,
 stream: undefined,
 error: undefined,
 processedAudio: undefined,
 audioContext: undefined,
 }),

 resetDevices: () =>
 set({
 devices: [],
 selectedDeviceId: undefined,
 }),

 resetAll: () => set(initialState),
}));
