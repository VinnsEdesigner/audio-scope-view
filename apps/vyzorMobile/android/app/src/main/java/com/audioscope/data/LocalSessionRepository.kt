package com.audioscope.data

import com.audioscope.data.db.AudioScopeDatabase
import com.audioscope.data.db.SessionDao
import com.audioscope.data.db.SessionEntity
import java.util.UUID

/**
 * LocalSessionRepository — the operations the JS bridge (LocalStoreModule)
 * calls. Wraps SessionDao and maps SessionEntity ↔ SessionDto so the
 * NativeModule only ever handles plain JSON-serializable values.
 *
 * New sessions created locally are marked serverDirty=true; the sync hook
 * (app/hooks/use-local-sync.ts) walks dirty rows and pushes them to the
 * server, then calls markClean.
 *
 * ISO-8601 timestamps are produced here (the server stores them as TEXT too)
 * so the local and server rows are directly comparable.
 */
class LocalSessionRepository(private val dao: SessionDao) {

    suspend fun insert(input: Map<String, Any?>): SessionDto {
        val now = nowIso()
        val entity = SessionEntity(
            id = input["id"] as? String ?: UUID.randomUUID().toString(),
            userId = input["userId"] as? String,
            name = input["name"] as? String,
            description = input["description"] as? String,
            startedAt = input["startedAt"] as? String ?: now,
            endedAt = input["endedAt"] as? String?,
            durationSeconds = (input["durationSeconds"] as? Number)?.toLong(),
            oscilloscopeOpenedAt = input["oscilloscopeOpenedAt"] as? String,
            oscilloscopeDurationMs = (input["oscilloscopeDurationMs"] as? Number)?.toDouble(),
            parentSessionId = input["parentSessionId"] as? String,
            isSubSession = (input["isSubSession"] as? Boolean) ?: false,
            autoCloseTimeoutSecs = (input["autoCloseTimeoutSecs"] as? Number)?.toInt() ?: 30,
            peakAmplitude = (input["peakAmplitude"] as? Number)?.toDouble() ?: 0.0,
            rmsAmplitude = (input["rmsAmplitude"] as? Number)?.toDouble() ?: 0.0,
            dcOffset = (input["dcOffset"] as? Number)?.toDouble() ?: 0.0,
            dominantFrequency = (input["dominantFrequency"] as? Number)?.toDouble() ?: 0.0,
            frequencyHigh = (input["frequencyHigh"] as? Number)?.toDouble() ?: 0.0,
            frequencyLow = (input["frequencyLow"] as? Number)?.toDouble() ?: 0.0,
            serverDirty = true,
            serverId = null,
        )
        dao.upsert(entity)
        return entity.toDto()
    }

    suspend fun update(id: String, patch: Map<String, Any?>): SessionDto? {
        val existing = dao.getById(id) ?: return null
        val patched = existing.copy(
            name = patch["name"] as? String ?: existing.name,
            description = patch["description"] as? String ?: existing.description,
            endedAt = patch["endedAt"] as? String ?: existing.endedAt,
            durationSeconds = (patch["durationSeconds"] as? Number)?.toLong() ?: existing.durationSeconds,
            oscilloscopeOpenedAt = patch["oscilloscopeOpenedAt"] as? String ?: existing.oscilloscopeOpenedAt,
            oscilloscopeDurationMs = (patch["oscilloscopeDurationMs"] as? Number)?.toDouble()
                ?: existing.oscilloscopeDurationMs,
            peakAmplitude = (patch["peakAmplitude"] as? Number)?.toDouble() ?: existing.peakAmplitude,
            rmsAmplitude = (patch["rmsAmplitude"] as? Number)?.toDouble() ?: existing.rmsAmplitude,
            dcOffset = (patch["dcOffset"] as? Number)?.toDouble() ?: existing.dcOffset,
            dominantFrequency = (patch["dominantFrequency"] as? Number)?.toDouble() ?: existing.dominantFrequency,
            frequencyHigh = (patch["frequencyHigh"] as? Number)?.toDouble() ?: existing.frequencyHigh,
            frequencyLow = (patch["frequencyLow"] as? Number)?.toDouble() ?: existing.frequencyLow,
            serverDirty = true,
        )
        dao.update(patched)
        return patched.toDto()
    }

    suspend fun get(id: String): SessionDto? = dao.getById(id)?.toDto()

    suspend fun list(limit: Int, offset: Int): List<SessionDto> =
        dao.list(limit, offset).map { it.toDto() }

    suspend fun count(): Int = dao.count()

    suspend fun dirty(): List<SessionDto> = dao.dirty().map { it.toDto() }

    suspend fun markClean(id: String, serverId: String) = dao.markClean(id, serverId)

    suspend fun delete(id: String): Boolean = dao.delete(id) > 0

    suspend fun clear() = dao.clear()

    private fun nowIso(): String =
        java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US)
            .apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }
            .format(java.util.Date())

    private fun SessionEntity.toDto(): SessionDto = SessionDto(
        id = id,
        userId = userId,
        name = name,
        description = description,
        startedAt = startedAt,
        endedAt = endedAt,
        durationSeconds = durationSeconds,
        oscilloscopeOpenedAt = oscilloscopeOpenedAt,
        oscilloscopeDurationMs = oscilloscopeDurationMs,
        parentSessionId = parentSessionId,
        isSubSession = isSubSession,
        autoCloseTimeoutSecs = autoCloseTimeoutSecs,
        peakAmplitude = peakAmplitude,
        rmsAmplitude = rmsAmplitude,
        dcOffset = dcOffset,
        dominantFrequency = dominantFrequency,
        frequencyHigh = frequencyHigh,
        frequencyLow = frequencyLow,
        recordingCount = 0,
        subSessionCount = 0,
        isOscilloscopeOpen = oscilloscopeOpenedAt != null && endedAt == null,
        serverDirty = serverDirty,
        serverId = serverId,
    )
}

/**
 * Process-wide repository accessor. The DB is a singleton; the repository
 * holds no state, so it is cheap to recreate. Kept as a property on the
 * Application so the NativeModule and (future) sync workers share one DAO.
 */
object LocalStore {
    @Volatile private var repo: LocalSessionRepository? = null

    fun init(context: android.content.Context) {
        if (repo == null) synchronized(this) {
            if (repo == null) {
                val dao = AudioScopeDatabase.get(context).sessionDao()
                repo = LocalSessionRepository(dao)
            }
        }
    }

    fun get(): LocalSessionRepository =
        repo ?: error("LocalStore.init(context) must be called before use")
}
