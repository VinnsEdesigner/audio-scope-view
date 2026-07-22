/**
 * WebSocket client for real-time waveform streaming
 * Connects to GraphQL subscriptions for live waveform data
 */

export interface WaveformStreamMessage {
  type: "waveform";
  data: {
    scopeId: string;
    samples: number[];
    timestamp: number;
    durationMs: number;
  };
}

export interface WaveformStreamOptions {
  scopeId: string;
  onWaveform: (data: WaveformStreamMessage["data"]) => void;
  onError?: (error: Error) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export class WaveformStreamClient {
  private ws: WebSocket | undefined;
  private reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
  private options: WaveformStreamOptions;
  private endpoint: string;

  constructor(options: WaveformStreamOptions) {
    this.options = options;
    this.endpoint = this.buildEndpoint();
  }

  private buildEndpoint(): string {
    const httpProtocol = globalThis.window?.location?.protocol ?? "http:";
    const wsProtocol = httpProtocol === "https:" ? "wss:" : "ws:";
    const host = globalThis.window?.location?.host ?? "localhost:8080";
    const graphqlEndpoint = import.meta.env?.VITE_GRAPHQL_WS_ENDPOINT ?? "/graphql";
    return `${wsProtocol}//${host}${graphqlEndpoint}`;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.endpoint, "graphql-ws");

      this.ws.addEventListener("open", () => {
        this.options.onConnectionChange?.(true);
        this.sendSubscription();
      });

      this.ws.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "connection_ack" || message.type === "ka") {
            return;
          }
          if (message.type === "next" && message.payload?.data?.waveformStream) {
            const waveformData = message.payload.data.waveformStream;
            this.options.onWaveform({
              scopeId: waveformData.scopeId ?? this.options.scopeId,
              samples: waveformData.samples ?? [],
              timestamp: waveformData.timestamp ?? Date.now(),
              durationMs: waveformData.durationMs ?? 0,
            });
          }
        } catch {
          // Ignore parse errors for keepalive messages
        }
      });

      this.ws.addEventListener("error", () => {
        this.options.onError?.(new Error("WebSocket connection error"));
      });

      this.ws.addEventListener("close", () => {
        this.options.onConnectionChange?.(false);
        this.scheduleReconnect();
      });
    } catch (error) {
      this.options.onError?.(error as Error);
      this.scheduleReconnect();
    }
  }

  private sendSubscription(): void {
    const subscription = {
      type: "subscribe",
      id: `waveform-${this.options.scopeId}`,
      payload: {
        query: `subscription OnWaveformStream($scopeId: String!) {
					waveformStream(scopeId: $scopeId) {
						scopeId
						samples
						timestamp
						durationMs
					}
				}`,
        variables: { scopeId: this.options.scopeId },
      },
    };
    this.ws?.send(JSON.stringify(subscription));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = undefined;
      this.connect();
    }, 3000);
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }

    if (this.ws) {
      const unsubscribe = {
        type: "complete",
        id: `waveform-${this.options.scopeId}`,
      };
      this.ws.send(JSON.stringify(unsubscribe));
      this.ws.close();
      this.ws = undefined;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * Create a waveform stream for a scope
 */
export function createWaveformStream(options: WaveformStreamOptions): WaveformStreamClient {
  const client = new WaveformStreamClient(options);
  client.connect();
  return client;
}
