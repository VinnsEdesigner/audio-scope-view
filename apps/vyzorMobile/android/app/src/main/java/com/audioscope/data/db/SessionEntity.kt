package com.audioscope.data.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * SessionEntity — the on-device Room mirror of the server's `sessions` table
 * (rust/migrations/005 + 009 oscilloscope + 010 metadata/hierarchy +
 * 013 audio analysis + 014 auto-close). Used for server-optional local mode:
 * when the mobile app cannot reach the deployed server (or persistence mode
 * is "local"), sessions are written here first and synced to the server when
 * connectivity returns.
 *
 * Column names + types match the server schema 1:1 so a sync pass can map
 * rows to GraphQL mutations without field translation. `serverDirty` is a
 * local-only flag (no server column): true = row not yet pushed to the server.
 */
@Entity(
    tableName = "sessions",
    indices = [
        Index(value = ["started_at"]),
        Index(value = ["parent_session_id"]),
        Index(value = ["is_sub_session"]),
        Index(value = ["server_dirty"]),
    ],
)
data class SessionEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "user_id")
    val userId: String? = null,

    @ColumnInfo(name = "name")
    val name: String? = null,

    @ColumnInfo(name = "description")
    val description: String? = null,

    @ColumnInfo(name = "started_at")
    val startedAt: String,

    @ColumnInfo(name = "ended_at")
    val endedAt: String? = null,

    @ColumnInfo(name = "duration_seconds")
    val durationSeconds: Long? = null,

    @ColumnInfo(name = "oscilloscope_opened_at")
    val oscilloscopeOpenedAt: String? = null,

    @ColumnInfo(name = "oscilloscope_duration_ms")
    val oscilloscopeDurationMs: Double? = null,

    @ColumnInfo(name = "parent_session_id")
    val parentSessionId: String? = null,

    @ColumnInfo(name = "is_sub_session")
    val isSubSession: Boolean = false,

    @ColumnInfo(name = "auto_close_timeout_secs")
    val autoCloseTimeoutSecs: Int? = 30,

    @ColumnInfo(name = "peak_amplitude")
    val peakAmplitude: Double = 0.0,

    @ColumnInfo(name = "rms_amplitude")
    val rmsAmplitude: Double = 0.0,

    @ColumnInfo(name = "dc_offset")
    val dcOffset: Double = 0.0,

    @ColumnInfo(name = "dominant_frequency")
    val dominantFrequency: Double = 0.0,

    @ColumnInfo(name = "frequency_high")
    val frequencyHigh: Double = 0.0,

    @ColumnInfo(name = "frequency_low")
    val frequencyLow: Double = 0.0,

    // Local-only: true = created/updated locally, not yet pushed to the server.
    @ColumnInfo(name = "server_dirty")
    val serverDirty: Boolean = true,

    // Local-only: server row id once pushed (same as id after first sync).
    @ColumnInfo(name = "server_id")
    val serverId: String? = null,
)
