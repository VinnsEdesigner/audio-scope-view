import { useQuery, useMutation } from "@apollo/client";
import {
  GET_SESSIONS,
  GET_SESSIONS_BY_ID,
  GET_ACTIVE_SESSIONS,
  GET_SESSION_COUNT,
} from "@audio-scope-view/api-client/audioScopeView/graphql/queries";
import {
  START_SESSION,
  GET_OR_CREATE_SESSION,
  END_SESSION,
  SESSION_HEARTBEAT,
  DELETE_SESSION,
  OPEN_OSCILLOSCOPE,
  CLOSE_OSCILLOSCOPE,
  CAPTURE_WAVEFORM,
} from "@audio-scope-view/api-client/audioScopeView/graphql/mutations";

export interface UseSessionsOptions {
  limit?: number;
  offset?: number;
}

export function useSessions(options: UseSessionsOptions = {}) {
  const { limit = 50, offset = 0 } = options;
  return useQuery(GET_SESSIONS, {
    variables: { limit, offset },
    fetchPolicy: "cache-and-network",
  });
}

export function useActiveSessions() {
  return useQuery(GET_ACTIVE_SESSIONS, {
    fetchPolicy: "cache-and-network",
  });
}

export function useSessionCount() {
  return useQuery(GET_SESSION_COUNT, {
    fetchPolicy: "cache-and-network",
  });
}

export function useSessionDetail(id: string | undefined) {
  return useQuery(GET_SESSIONS_BY_ID, {
    variables: { id },
    skip: !id,
    fetchPolicy: "cache-and-network",
  });
}

export function useStartSession() {
  return useMutation(START_SESSION, {
    refetchQueries: [{ query: GET_SESSIONS }],
  });
}

export function useGetOrCreateSession() {
  return useMutation(GET_OR_CREATE_SESSION, {
    refetchQueries: [{ query: GET_SESSIONS }, { query: GET_ACTIVE_SESSIONS }],
  });
}

export function useEndSession() {
  return useMutation(END_SESSION, {
    refetchQueries: [{ query: GET_SESSIONS }, { query: GET_ACTIVE_SESSIONS }],
  });
}

export function useSessionHeartbeat() {
  return useMutation(SESSION_HEARTBEAT);
}

export function useDeleteSession() {
  return useMutation(DELETE_SESSION, {
    refetchQueries: [{ query: GET_SESSIONS }],
  });
}

export function useCaptureWaveform() {
  return useMutation(CAPTURE_WAVEFORM, {
    refetchQueries: [{ query: GET_SESSIONS }],
  });
}

export function useOpenOscilloscope() {
  return useMutation(OPEN_OSCILLOSCOPE, {
    refetchQueries: [{ query: GET_SESSIONS }, { query: GET_ACTIVE_SESSIONS }],
  });
}

export function useCloseOscilloscope() {
  return useMutation(CLOSE_OSCILLOSCOPE, {
    refetchQueries: [{ query: GET_SESSIONS }, { query: GET_ACTIVE_SESSIONS }],
  });
}
