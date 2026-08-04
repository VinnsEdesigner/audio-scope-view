import * as React from "react";
import { useSubscription } from "@apollo/client";
import { gql } from "@apollo/client";
import { useCreateSubSession, useCloseOscilloscope, useUpdateSessionDsp } from "./use-sessions";

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
      # Basic amplitude metrics
      peakAmplitude
      rmsAmplitude
      dcOffset
      # Frequency metrics
      dominantFrequency
      fundamentalFrequency
      # Signal quality metrics
      thd
      thdn
      snr
      crestFactor
      # Energy metrics
      signalEnergy
      noiseEnergy
      # Harmonic breakdown
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

    const protocol = globalThis.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${globalThis.location.host}/ws`;

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

  React.useEffect(() => {
    return () => {
      disconnect();
      if (intervalReference.current) {
        clearInterval(intervalReference.current);
      }
    };
  }, [disconnect]);

  /**
   * Rotates a tracking sub-session after every `subSessionThresholdMs` of
   * continuous live capture. Guarded by refs (never by React state) because it
   * runs from a long-lived interval whose closure is created once.
   */
  const checkSubSessionCreation = React.useCallback(async () => {
    if (!isCapturingReference.current) return;
    if (isCreatingSubSessionReference.current) return;

    const now = performance.now();
    const timeSinceLastTick = now - lastDataTimeReference.current;
    lastDataTimeReference.current = now;

    // Gap in the stream: restart the continuous-capture window.
    if (timeSinceLastTick > 1000) {
      continuousCaptureTimeReference.current = 0;
      return;
    }

    continuousCaptureTimeReference.current += timeSinceLastTick;

    if (continuousCaptureTimeReference.current < subSessionThresholdMs) return;

    // Reset the window *before* awaiting so overlapping ticks cannot re-enter.
    continuousCaptureTimeReference.current = 0;
    isCreatingSubSessionReference.current = true;

    const previousSubSessionId = activeSubSessionReference.current;

    try {
      const result = await createSubSession({ variables: { parentId: sessionId } });
      const subSessionId = result?.data?.createSubSession?.id;

      if (subSessionId) {
        activeSubSessionReference.current = subSessionId;
        setActiveSubSessionId(subSessionId);

        // Close the previous tracking sub-session, not the new one.
        if (previousSubSessionId) {
          await closeOscilloscope({ variables: { sessionId: previousSubSessionId } });
        }
      }
    } catch (error_) {
      console.error("Failed to create sub-session:", error_);
    } finally {
      isCreatingSubSessionReference.current = false;
    }
  }, [sessionId, createSubSession, closeOscilloscope, subSessionThresholdMs]);

  const checkSubSessionCreationReference = React.useRef(checkSubSessionCreation);
  checkSubSessionCreationReference.current = checkSubSessionCreation;

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
      captureStartTimeReference.current = performance.now();
      continuousCaptureTimeReference.current = 0;
      lastDataTimeReference.current = performance.now();

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
      lastDataTimeReference.current = performance.now();

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

    const subSessionId = activeSubSessionReference.current;
    if (subSessionId) {
      closeOscilloscope({ variables: { sessionId: subSessionId } }).catch(console.error);
      activeSubSessionReference.current = undefined;
      setActiveSubSessionId(undefined);
    }

    disconnect();
  }, [closeOscilloscope, disconnect]);

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
