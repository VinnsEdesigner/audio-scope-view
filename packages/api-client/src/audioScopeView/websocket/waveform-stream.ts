import { config } from "../../config";

// Custom WebSocket protocol types matching the server implementation

export interface WaveformStreamMessage {
  type: "waveform";
  data: {
    sessionId: string;
    samples: number[];
    timestamp: number;
    sampleRate: number;
  };
}

export interface SpectrumStreamMessage {
  type: "spectrum";
  data: {
    sessionId: string;
    frequencies: number[];
    magnitudes: number[];
    timestamp: number;
  };
}

export interface AnalysisMessage {
  type: "analysis";
  data: {
    sessionId: string;
    peakAmplitude: number;
    rmsAmplitude: number;
    dominantFrequency: number;
    thd: number;
    snr: number;
    timestamp: number;
  };
}

export interface WaveformStreamOptions {
  sessionId: string;
  onWaveform?: (data: WaveformStreamMessage["data"]) => void;
  onSpectrum?: (data: SpectrumStreamMessage["data"]) => void;
  onAnalysis?: (data: AnalysisMessage["data"]) => void;
  onError?: (error: Error) => void;
  onConnectionChange?: (connected: boolean) => void;
  onConnected?: (clientId: string) => void;
}

// Server message types (incoming)
interface ServerConnectedMessage {
  type: "Connected";
  data: { client_id: string };
}

interface ServerSubscribedMessage {
  type: "Subscribed";
  data: { session_id: string; stream_type: string };
}

interface ServerWaveformMessage {
  type: "Waveform";
  data: {
    session_id: string;
    samples: number[];
    timestamp: number;
    sample_rate: number;
  };
}

interface ServerCompressedWaveformMessage {
  type: "CompressedWaveform";
  data: {
    session_id: string;
    data: number[];
    sample_count: number;
    original_size: number;
    timestamp: number;
    sample_rate: number;
  };
}

interface ServerSpectrumMessage {
  type: "Spectrum";
  data: {
    session_id: string;
    frequencies: number[];
    magnitudes: number[];
    timestamp: number;
  };
}

interface ServerAnalysisMessage {
  type: "Analysis";
  data: {
    session_id: string;
    peak_amplitude: number;
    rms_amplitude: number;
    dominant_frequency: number;
    thd: number;
    snr: number;
    timestamp: number;
  };
}

interface ServerErrorMessage {
  type: "Error";
  data: { message: string };
}

type ServerMessage =
  | ServerConnectedMessage
  | ServerSubscribedMessage
  | ServerWaveformMessage
  | ServerCompressedWaveformMessage
  | ServerSpectrumMessage
  | ServerAnalysisMessage
  | ServerErrorMessage;

export class WaveformStreamClient {
  private ws: WebSocket | undefined;
  private reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
  private options: WaveformStreamOptions;
  private endpoint: string;
  private clientId: string | undefined;
  private isIntentionalClose = false;

  constructor(options: WaveformStreamOptions) {
    this.options = options;
    this.endpoint = this.buildEndpoint();
  }

  private buildEndpoint(): string {
    if (config.websocketEndpoint) {
      if (
        config.websocketEndpoint.startsWith("ws://") ||
        config.websocketEndpoint.startsWith("wss://")
      ) {
        return config.websocketEndpoint;
      }

      const httpProtocol = globalThis.window?.location?.protocol ?? "http:";
      const wsProtocol = httpProtocol === "https:" ? "wss:" : "ws:";
      const host = globalThis.window?.location?.host ?? "localhost:8080";
      return `${wsProtocol}://${host}${config.websocketEndpoint}`;
    }

    const httpProtocol = globalThis.window?.location?.protocol ?? "http:";
    const wsProtocol = httpProtocol === "https:" ? "wss:" : "ws:";
    const host = globalThis.window?.location?.host ?? "localhost:8080";
    return `${wsProtocol}://${host}/ws`;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isIntentionalClose = false;

    try {
      // No subprotocol - using custom JSON protocol
      this.ws = new WebSocket(this.endpoint);

      this.ws.addEventListener("open", () => {
        console.log("[WaveformStream] Connected to WebSocket");
      });

      this.ws.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data) as ServerMessage;
          this.handleMessage(message);
        } catch (error) {
          console.error("[WaveformStream] Failed to parse message:", error);
        }
      });

      this.ws.addEventListener("error", (event) => {
        console.error("[WaveformStream] WebSocket error:", event);
        this.options.onError?.(new Error("WebSocket connection error"));
      });

      this.ws.addEventListener("close", () => {
        console.log("[WaveformStream] WebSocket closed");
        this.options.onConnectionChange?.(false);
        if (!this.isIntentionalClose) {
          this.scheduleReconnect();
        }
      });
    } catch (error) {
      console.error("[WaveformStream] Connection error:", error);
      this.options.onError?.(error as Error);
      this.scheduleReconnect();
    }
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case "Connected": {
        this.clientId = message.data.client_id;
        console.log("[WaveformStream] Received client ID:", this.clientId);
        this.options.onConnectionChange?.(true);
        this.options.onConnected?.(this.clientId);
        // Auto-subscribe to waveform after connecting
        this.subscribe();
        break;
      }

      case "Subscribed": {
        console.log("[WaveformStream] Subscribed to:", message.data.stream_type);
        break;
      }

      case "Waveform": {
        if (this.options.onWaveform) {
          this.options.onWaveform({
            sessionId: message.data.session_id,
            samples: message.data.samples,
            timestamp: message.data.timestamp,
            sampleRate: message.data.sample_rate,
          });
        }
        break;
      }

      case "CompressedWaveform": {
        // Handle compressed waveform - for now, just log
        console.warn(
          "[WaveformStream] Received compressed waveform (decompression not implemented)",
        );
        break;
      }

      case "Spectrum": {
        if (this.options.onSpectrum) {
          this.options.onSpectrum({
            sessionId: message.data.session_id,
            frequencies: message.data.frequencies,
            magnitudes: message.data.magnitudes,
            timestamp: message.data.timestamp,
          });
        }
        break;
      }

      case "Analysis": {
        if (this.options.onAnalysis) {
          this.options.onAnalysis({
            sessionId: message.data.session_id,
            peakAmplitude: message.data.peak_amplitude,
            rmsAmplitude: message.data.rms_amplitude,
            dominantFrequency: message.data.dominant_frequency,
            thd: message.data.thd,
            snr: message.data.snr,
            timestamp: message.data.timestamp,
          });
        }
        break;
      }

      case "Error": {
        console.error("[WaveformStream] Server error:", message.data.message);
        this.options.onError?.(new Error(message.data.message));
        break;
      }

      default: {
        console.warn("[WaveformStream] Unknown message type:", (message as ServerMessage).type);
      }
    }
  }

  private subscribe(): void {
    this.send({
      type: "subscribe",
      session_id: this.options.sessionId,
    });
  }

  subscribeSpectrum(): void {
    this.send({
      type: "subscribe_spectrum",
      session_id: this.options.sessionId,
    });
  }

  unsubscribe(): void {
    this.send({
      type: "unsubscribe",
      session_id: this.options.sessionId,
    });
  }

  unsubscribeSpectrum(): void {
    this.send({
      type: "unsubscribe_spectrum",
      session_id: this.options.sessionId,
    });
  }

  /**
   * Send waveform data to the server for processing/analysis
   */
  sendWaveformData(
    samples: number[],
    sampleRate: number,
    peakAmplitude: number,
    rmsAmplitude: number,
  ): void {
    this.send({
      type: "waveform_data",
      session_id: this.options.sessionId,
      samples,
      timestamp: Date.now(),
      sample_rate: sampleRate,
      peak_amplitude: peakAmplitude,
      rms_amplitude: rmsAmplitude,
    });
  }

  /**
   * Send analysis data to the server
   */
  sendAnalysisData(
    peakAmplitude: number,
    rmsAmplitude: number,
    dominantFrequency: number,
    frequencyHigh: number,
    frequencyLow: number,
    dcOffset: number,
  ): void {
    this.send({
      type: "analysis_data",
      session_id: this.options.sessionId,
      peak_amplitude: peakAmplitude,
      rms_amplitude: rmsAmplitude,
      dominant_frequency: dominantFrequency,
      frequency_high: frequencyHigh,
      frequency_low: frequencyLow,
      dc_offset: dcOffset,
      timestamp: Date.now(),
    });
  }

  /**
   * Enable/disable compression for waveform data
   */
  setCompression(enabled: boolean, threshold?: number): void {
    this.send({
      type: "enable_compression",
      enabled,
      threshold,
    });
  }

  private send(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("[WaveformStream] Cannot send message - WebSocket not connected");
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }
    console.log("[WaveformStream] Scheduling reconnect in 3 seconds...");
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = undefined;
      this.connect();
    }, 3000);
  }

  disconnect(): void {
    this.isIntentionalClose = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }

    if (this.ws) {
      this.unsubscribe();
      this.ws.close();
      this.ws = undefined;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getClientId(): string | undefined {
    return this.clientId;
  }
}

export function createWaveformStream(options: WaveformStreamOptions): WaveformStreamClient {
  const client = new WaveformStreamClient(options);
  client.connect();
  return client;
}
