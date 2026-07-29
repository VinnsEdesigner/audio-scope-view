import { useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useWaveformStore } from "../store";
import { graphqlClient } from "@audio-scope-view/api-client/audioScopeView/graphql";
import { CREATE_WAVEFORM } from "@audio-scope-view/api-client/audioScopeView/graphql/mutations";
import type { WaveformMessage } from "../store";

export interface UseWaveformStreamOptions {
  sessionId: string | undefined;
  enabled?: boolean;
}

export function useWaveformStream(options: UseWaveformStreamOptions) {
  const { sessionId, enabled = true } = options;

  const { isConnected, error, waveform, setConnected, setSessionId, setError, setWaveform, reset } =
    useWaveformStore();

  const wsReference = useRef<WebSocket | undefined>(undefined);
  const reconnectTimeoutReference = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const disconnect = useCallback(() => {
    if (wsReference.current) {
      wsReference.current.close();
    }
    if (reconnectTimeoutReference.current) {
      clearTimeout(reconnectTimeoutReference.current);
    }
    reset();
  }, [reset]);

  useEffect(() => {
    if (!enabled || !sessionId) return;

    setSessionId(sessionId);

    const wsProtocol = globalThis.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${globalThis.location.host}/graphql`;

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsReference.current = ws;

        ws.addEventListener("open", () => {
          setConnected(true);
          setError(undefined);
          ws.send(
            JSON.stringify({
              type: "subscribe",
              topic: `waveform:${sessionId}`,
            }),
          );
        });

        ws.addEventListener("message", (event) => {
          try {
            const data = JSON.parse(event.data) as WaveformMessage;
            if (data.type === "waveform" && data.sessionId === sessionId) {
              setWaveform(data);
            }
          } catch (error) {
            console.error("Failed to parse waveform message:", error);
          }
        });

        ws.addEventListener("error", () => {
          setError(new Error("WebSocket connection error"));
        });

        ws.addEventListener("close", () => {
          setConnected(false);
          reconnectTimeoutReference.current = setTimeout(connect, 3000);
        });
      } catch (error_) {
        setError(error_ instanceof Error ? error_ : new Error("Connection failed"));
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutReference.current) {
        clearTimeout(reconnectTimeoutReference.current);
      }
      if (wsReference.current) {
        wsReference.current.close();
      }
    };
  }, [sessionId, enabled, setConnected, setSessionId, setError, setWaveform, reset]);

  return {
    waveform,
    isConnected,
    error,
    disconnect,
  };
}

export interface UseSubmitWaveformOptions {
  sessionId: string | undefined;
}

export function useSubmitWaveform(options: UseSubmitWaveformOptions) {
  const { sessionId } = options;

  return useMutation({
    mutationFn: async (input: { samples: number[]; sampleRate: number; timestampMs: number }) => {
      if (!sessionId) throw new Error("Session ID is required");

      const result = await graphqlClient.mutate({
        mutation: CREATE_WAVEFORM,
        variables: {
          input: {
            sessionId,
            samples: input.samples,
          },
        },
      });

      return result.data.createWaveform;
    },
  });
}
