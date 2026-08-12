// use-scope-capture.ts — RN port of the web hook. Identical logic: it opens a
// raw WebSocket to the legacy /ws endpoint, subscribes to a session, promotes
// the live capture to a tracking sub-session after a threshold, and forwards
// DSP metrics + raw waveform frames. The only browser-bound bit was
// `globalThis.location` for the WS URL; on RN it comes from the api config.
import * as React from "react";
import { useSubscription } from "@apollo/client";
import { gql } from "@apollo/client";
import { useCreateSubSession, useCloseOscilloscope, useUpdateSessionDsp } from "./use-sessions";
import { config } from "../lib/api-config";

interface WaveformDataMessage {
  type: "waveform_data";
  payload: {
    session_id: string;
    samples: number[];
    timestamp: number;
    sample_rate: number;
    peak_amplitude: number;
    rms_amplitude: number;
  };
}

const ANALYSIS_SUBSCRIPTION = gql`
  subscription OnAnalysisResult($sessionId: String!) {
    analysisSubscribe(sessionId: $sessionId) {
      sessionId
      timestamp
      sampleRate
      peakAmplitude
      rmsAmplitude
      dcOffset
      dominantFrequency
      fundamentalFrequency
      thd
      thdn
      snr
      crestFactor
      signalEnergy
      noiseEnergy
      harmonics {
        harmonic
        frequency
        magnitude
        phase
      }
    }
  }
`;

export interface DspMetrics {
  peakAmplitude: number;
  rmsAmplitude: number;
  dcOffset: number;
  dominantFrequency: number;
  frequencyHigh: number;
  frequencyLow: number;
}

export interface HarmonicComponent {
  harmonic: number;
  frequency: number;
  magnitude: number;
  phase: number;
}

export interface AnalysisUpdate {
  sessionId: string;
  timestamp: number;
  sampleRate: number;

  peakAmplitude: number;
  rmsAmplitude: number;
  dcOffset: number;

  dominantFrequency: number;
  fundamentalFrequency: number;

  thd: number;
  thdn: number;
  snr: number;
  crestFactor: number;

  signalEnergy: number;
  noiseEnergy: number;

  harmonics: HarmonicComponent[];
}

export interface UseScopeCaptureOptions {
  sessionId: string;

  streamIntervalMs?: number;

  subSessionThresholdMs?: number;

  onAnalysisUpdate?: (data: AnalysisUpdate) => void;
}

export interface UseScopeCaptureReturn {
  activeSubSessionId: string | undefined;

  isCapturing: boolean;

  isConnected: boolean;

  isSubscribed: boolean;

  startCapture: (metrics: DspMetrics) => void;

  updateMetrics: (metrics: DspMetrics) => void;

  sendWaveformData: (samples: number[], sampleRate: number, metrics: DspMetrics) => void;

  stopCapture: () => void;

  error: Error | undefined;
}

export function useScopeCapture(options: UseScopeCaptureOptions): UseScopeCaptureReturn {
  const {
    sessionId,
    streamIntervalMs = 100,
    subSessionThresholdMs = 30_000,
    onAnalysisUpdate,
  } = options;

  const [createSubSession] = useCreateSubSession();
  const [closeOscilloscope] = useCloseOscilloscope();
  const [updateSessionDsp] = useUpdateSessionDsp();

  const [activeSubSessionId, setActiveSubSessionId] = React.useState<string | undefined>();
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [isConnected, setIsConnected] = React.useState(false);
  const [isSubscribed, setIsSubscribed] = React.useState(false);
  const [error, setError] = React.useState<Error | undefined>();

  const wsReference = React.useRef<WebSocket | undefined>(undefined);
  const captureStartTimeReference = React.useRef<number | undefined>(undefined);
  const continuousCaptureTimeReference = React.useRef<number>(0);
  const lastDataTimeReference = React.useRef<number>(0);
  const intervalReference = React.useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const reconnectTimeoutReference = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const currentMetricsReference = React.useRef<DspMetrics | undefined>(undefined);
  const activeSubSessionReference = React.useRef<string | undefined>(undefined);
  const isCreatingSubSessionReference = React.useRef(false);
  const isCapturingReference = React.useRef(false);
  const lastTickTimeReference = React.useRef<number>(0);

  const effectiveSessionId = activeSubSessionId || sessionId;
  const hasValidSession = Boolean(sessionId && sessionId.trim().length > 0);

  const { data: subscriptionData } = useSubscription(ANALYSIS_SUBSCRIPTION, {
    variables: { sessionId: effectiveSessionId },
    skip: !hasValidSession || !onAnalysisUpdate,
    shouldResubscribe: true,
  });

  React.useEffect(() => {
    if (subscriptionData?.analysisSubscribe && onAnalysisUpdate) {
      onAnalysisUpdate(subscriptionData.analysisSubscribe);
    }
  }, [subscriptionData, onAnalysisUpdate]);

  React.useEffect(() => {
    if (hasValidSession && onAnalysisUpdate) {
      setIsSubscribed(true);
    } else {
      setIsSubscribed(false);
    }
  }, [hasValidSession, onAnalysisUpdate]);

  const connect = React.useCallback(() => {
    if (!hasValidSession) return;
    if (wsReference.current?.readyState === WebSocket.OPEN) return;

    // RN has no window.location; the WS URL is resolved from the api config.
    const wsUrl = config.websocketEndpoint;

    try {
      const ws = new WebSocket(wsUrl);
      wsReference.current = ws;

      ws.addEventListener("open", () => {
        setIsConnected(true);
        setError(undefined);

        ws.send(JSON.stringify({ type: "subscribe", payload: { session_id: effectiveSessionId } }));
      });

      ws.addEventListener("close", () => {
        setIsConnected(false);

        if (hasValidSession) {
          reconnectTimeoutReference.current = setTimeout(connect, 3000);
        }
      });

      ws.addEventListener("error", () => {
        setError(new Error("WebSocket connection error"));
      });
    } catch (error_) {
      setError(error_ instanceof Error ? error_ : new Error("Failed to connect"));
    }
  }, [effectiveSessionId, hasValidSession]);

  const disconnect = React.useCallback(() => {
    if (reconnectTimeoutReference.current) {
      clearTimeout(reconnectTimeoutReference.current);
      reconnectTimeoutReference.current = undefined;
    }
    if (wsReference.current) {
      wsReference.current.close();
      wsReference.current = undefined;
    }
    setIsConnected(false);
  }, []);

  const checkSubSessionCreation = React.useCallback(async () => {
    if (!isCapturingReference.current) return;
    if (isCreatingSubSessionReference.current) return;
    if (activeSubSessionReference.current) return;

    const now = Date.now();
    const timeSinceLastTick = now - lastTickTimeReference.current;
    lastTickTimeReference.current = now;

    if (now - lastDataTimeReference.current > 1000) {
      continuousCaptureTimeReference.current = 0;
      return;
    }

    continuousCaptureTimeReference.current += timeSinceLastTick;

    if (continuousCaptureTimeReference.current < subSessionThresholdMs) return;

    continuousCaptureTimeReference.current = 0;
    isCreatingSubSessionReference.current = true;

    try {
      const result = await createSubSession({ variables: { parentId: sessionId } });
      const subSessionId = result?.data?.createSubSession?.id;

      if (subSessionId) {
        activeSubSessionReference.current = subSessionId;
        setActiveSubSessionId(subSessionId);
      }
    } catch (error_) {
      console.error("Failed to create sub-session:", error_);
    } finally {
      isCreatingSubSessionReference.current = false;
    }
  }, [sessionId, createSubSession, subSessionThresholdMs]);

  const checkSubSessionCreationReference = React.useRef(checkSubSessionCreation);
  checkSubSessionCreationReference.current = checkSubSessionCreation;

  const closeActiveSubSession = React.useCallback(() => {
    const subSessionId = activeSubSessionReference.current;
    if (subSessionId) {
      closeOscilloscope({ variables: { sessionId: subSessionId } }).catch(console.error);
      activeSubSessionReference.current = undefined;
      setActiveSubSessionId(undefined);
    }
  }, [closeOscilloscope]);

  const closeActiveSubSessionReference = React.useRef(closeActiveSubSession);
  closeActiveSubSessionReference.current = closeActiveSubSession;

  const sendWaveformData = React.useCallback(
    (samples: number[], sampleRate: number, metrics: DspMetrics) => {
      if (!wsReference.current || wsReference.current.readyState !== WebSocket.OPEN) {
        return;
      }

      const message: WaveformDataMessage = {
        type: "waveform_data",
        payload: {
          session_id: activeSubSessionId || sessionId,
          samples,
          timestamp: Date.now(),
          sample_rate: sampleRate,
          peak_amplitude: metrics.peakAmplitude,
          rms_amplitude: metrics.rmsAmplitude,
        },
      };

      wsReference.current.send(JSON.stringify(message));
    },
    [activeSubSessionId, sessionId],
  );

  const startCapture = React.useCallback(
    (metrics: DspMetrics) => {
      if (!sessionId) {
        setError(new Error("No session provided. Please create or select a session first."));
        return;
      }

      setIsCapturing(true);
      isCapturingReference.current = true;
      currentMetricsReference.current = metrics;
      captureStartTimeReference.current = Date.now();
      continuousCaptureTimeReference.current = 0;
      lastDataTimeReference.current = Date.now();
      lastTickTimeReference.current = Date.now();

      connect();

      if (intervalReference.current) clearInterval(intervalReference.current);
      intervalReference.current = setInterval(async () => {
        await checkSubSessionCreationReference.current();
      }, streamIntervalMs);
    },
    [sessionId, connect, streamIntervalMs],
  );

  const updateMetrics = React.useCallback(
    (metrics: DspMetrics) => {
      currentMetricsReference.current = metrics;
      lastDataTimeReference.current = Date.now();

      updateSessionDsp({
        variables: {
          id: activeSubSessionId || sessionId,
          input: {
            peakAmplitude: metrics.peakAmplitude,
            rmsAmplitude: metrics.rmsAmplitude,
            dcOffset: metrics.dcOffset,
            dominantFrequency: metrics.dominantFrequency,
            frequencyHigh: metrics.frequencyHigh,
            frequencyLow: metrics.frequencyLow,
          },
        },
      }).catch(console.error);
    },
    [activeSubSessionId, sessionId, updateSessionDsp],
  );

  const stopCapture = React.useCallback(() => {
    setIsCapturing(false);
    isCapturingReference.current = false;
    continuousCaptureTimeReference.current = 0;

    if (intervalReference.current) {
      clearInterval(intervalReference.current);
      intervalReference.current = undefined;
    }

    closeActiveSubSessionReference.current();

    disconnect();
  }, [disconnect]);

  React.useEffect(() => {
    return () => {
      closeActiveSubSessionReference.current();
      if (intervalReference.current) {
        clearInterval(intervalReference.current);
        intervalReference.current = undefined;
      }
      disconnect();
    };
  }, [disconnect]);

  return {
    activeSubSessionId: activeSubSessionId ?? undefined,
    isCapturing,
    isConnected,
    isSubscribed,
    startCapture,
    updateMetrics,
    sendWaveformData,
    stopCapture,
    error,
  };
}
