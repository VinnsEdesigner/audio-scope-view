import { useQuery, useMutation } from "@apollo/client";
import {
  GET_SESSIONS,
  GET_SESSIONS_BY_ID,
  GET_ACTIVE_SESSIONS,
  GET_SESSION_COUNT,
  GET_SUB_SESSIONS,
  GET_PARENT_SESSION,
} from "@audio-scope-view/api-client/audioScopeView/graphql/queries";
import {
  START_SESSION,
  CREATE_NAMED_SESSION,
  GET_OR_CREATE_SESSION,
  END_SESSION,
  SESSION_HEARTBEAT,
  DELETE_SESSION,
  UPDATE_SESSION,
  OPEN_OSCILLOSCOPE,
  CLOSE_OSCILLOSCOPE,
  CREATE_SUB_SESSION,
  CAPTURE_WAVEFORM,
} from "@audio-scope-view/api-client/audioScopeView/graphql/mutations";
import type { CreateSessionInput, UpdateSessionInput } from "@audio-scope-view/api-client/domain/session";

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

export function useSubSessions(parentId: string | undefined, options: UseSessionsOptions = {}) {
  const { limit = 20, offset = 0 } = options;
  return useQuery(GET_SUB_SESSIONS, {
    variables: { parentId, limit, offset },
    skip: !parentId,
    fetchPolicy: "cache-and-network",
  });
}

export function useParentSession(subSessionId: string | undefined) {
  return useQuery(GET_PARENT_SESSION, {
    variables: { subSessionId },
    skip: !subSessionId,
    fetchPolicy: "cache-and-network",
  });
}

export function useStartSession() {
  return useMutation(START_SESSION, {
    refetchQueries: [{ query: GET_SESSIONS }],
  });
}

export function useCreateNamedSession() {
  return useMutation(CREATE_NAMED_SESSION, {
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

export function useUpdateSession() {
  return useMutation(UPDATE_SESSION, {
    refetchQueries: [{ query: GET_SESSIONS }, { query: GET_SESSIONS_BY_ID }],
  });
}

export function useCreateSubSession() {
  return useMutation(CREATE_SUB_SESSION, {
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
