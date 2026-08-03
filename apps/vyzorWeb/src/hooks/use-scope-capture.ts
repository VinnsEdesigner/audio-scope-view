import * as React from "react";
import { useSubscription } from "@apollo/client";
import { gql } from "@apollo/client";
import { useCreateSubSession, useCloseOscilloscope, useUpdateSessionDsp } from "./use-sessions";

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
  activeSubSessionId: string | null;

  isCapturing: boolean;

  isConnected: boolean;

  isSubscribed: boolean;

  startCapture: (metrics: DspMetrics) => void;

  updateMetrics: (metrics: DspMetrics) => void;

  sendWaveformData: (samples: number[], sampleRate: number, metrics: DspMetrics) => void;

  stopCapture: () => void;

  error: Error | null;
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

  const checkSubSessionCreation = React.useCallback(
    async (_metrics: DspMetrics) => {
      if (activeSubSessionId) return;

      const now = performance.now();
      const timeSinceLastData = now - lastDataTimeReference.current;

      if (timeSinceLastData > 1000) {
        continuousCaptureTimeReference.current = 0;
        return;
      }

      continuousCaptureTimeReference.current += timeSinceLastData;
      lastDataTimeReference.current = now;

      if (continuousCaptureTimeReference.current >= subSessionThresholdMs) {
        try {
          const result = await createSubSession({ variables: { parentId: sessionId } });
          const subSessionId = result?.data?.createSubSession?.id;
          if (subSessionId) {
            setActiveSubSessionId(subSessionId);

            await closeOscilloscope({ variables: { sessionId: subSessionId } });
          }
        } catch (error_) {
          console.error("Failed to create sub-session:", error_);
        }
      }
    },
    [activeSubSessionId, sessionId, createSubSession, closeOscilloscope, subSessionThresholdMs],
  );

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
      currentMetricsReference.current = metrics;
      captureStartTimeReference.current = performance.now();
      continuousCaptureTimeReference.current = 0;
      lastDataTimeReference.current = performance.now();

      connect();

      intervalReference.current = setInterval(async () => {
        if (currentMetricsReference.current) {
          await checkSubSessionCreation(currentMetricsReference.current);
        }
      }, streamIntervalMs);
    },
    [sessionId, connect, checkSubSessionCreation, streamIntervalMs],
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

    if (intervalReference.current) {
      clearInterval(intervalReference.current);
      intervalReference.current = undefined;
    }

    if (activeSubSessionId) {
      closeOscilloscope({ variables: { sessionId: activeSubSessionId } }).catch(console.error);
      setActiveSubSessionId(undefined);
    }

    disconnect();
  }, [activeSubSessionId, closeOscilloscope, disconnect]);

  return {
    activeSubSessionId,
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
