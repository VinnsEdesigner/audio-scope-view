package com.audioscope.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

/**
 * SessionDao — CRUD for the local sessions table. All calls run on a Room
 * dispatcher (suspend); the NativeModule bridges them to JS promises.
 *
 * Upsert semantics: a session captured locally while offline keeps its
 * client-generated id; the server adopts the same id on sync (the server's
 * createNamedSession accepts an explicit id), so a re-insert after a server
 * pull is an idempotent REPLACE.
 */
@Dao
interface SessionDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(session: SessionEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(sessions: List<SessionEntity>)

    @Update
    suspend fun update(session: SessionEntity)

    @Query("SELECT * FROM sessions WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): SessionEntity?

    @Query("SELECT * FROM sessions ORDER BY started_at DESC LIMIT :limit OFFSET :offset")
    suspend fun list(limit: Int, offset: Int): List<SessionEntity>

    @Query("SELECT * FROM sessions ORDER BY started_at DESC")
    fun observeAll(): Flow<List<SessionEntity>>

    @Query("SELECT COUNT(*) FROM sessions")
    suspend fun count(): Int

    @Query("SELECT * FROM sessions WHERE server_dirty = 1 ORDER BY started_at ASC")
    suspend fun dirty(): List<SessionEntity>

    @Query("UPDATE sessions SET server_dirty = 0, server_id = :serverId WHERE id = :id")
    suspend fun markClean(id: String, serverId: String)

    @Query("DELETE FROM sessions WHERE id = :id")
    suspend fun delete(id: String): Int

    @Query("DELETE FROM sessions")
    suspend fun clear()
}
