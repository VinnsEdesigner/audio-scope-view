package com.audioscope.data

/**
 * SessionDto — the JSON shape returned to JS by LocalStoreModule.
 *
 * It mirrors `Session` in packages/api-client/src/domain/session/types.ts
 * (the camelCase client type) so the JS local-session store can hold the
 * same record whether it came from the local Room DB or the server via
 * Apollo. `serverDirty` and `serverId` are local-only fields carried along
 * so the sync hook can decide what to push.
 */
data class SessionDto(
    val id: String,
    val userId: String? = null,
    val name: String? = null,
    val description: String? = null,
    val startedAt: String,
    val endedAt: String? = null,
    val durationSeconds: Long? = null,
    val oscilloscopeOpenedAt: String? = null,
    val oscilloscopeDurationMs: Double? = null,
    val parentSessionId: String? = null,
    val isSubSession: Boolean = false,
    val autoCloseTimeoutSecs: Int? = 30,
    val peakAmplitude: Double = 0.0,
    val rmsAmplitude: Double = 0.0,
    val dcOffset: Double = 0.0,
    val dominantFrequency: Double = 0.0,
    val frequencyHigh: Double = 0.0,
    val frequencyLow: Double = 0.0,
    val recordingCount: Int = 0,
    val subSessionCount: Int = 0,
    val isOscilloscopeOpen: Boolean = false,
    val serverDirty: Boolean = true,
    val serverId: String? = null,
)
