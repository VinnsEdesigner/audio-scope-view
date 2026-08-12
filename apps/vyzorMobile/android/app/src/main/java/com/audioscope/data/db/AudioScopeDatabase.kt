package com.audioscope.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

/**
 * AudioScopeDatabase — the on-device SQLite store for server-optional local
 * mode. Backed by Room over the framework SQLite shipped with Android (no
 * native dependency to build); this is the mobile analog of the server's
 * SQLite/Turso store (rust/migrations/*.sql).
 *
 * Singleton: one DB instance per process, opened lazily on first access.
 * `journalMode = WRITE_AHEAD_LOGGING` is Room's default for API 16+ and lets
 * reads (the scope UI) not block writes (capture).
 */
@Database(
    entities = [SessionEntity::class],
    version = 1,
    exportSchema = false,
)
abstract class AudioScopeDatabase : RoomDatabase() {
    abstract fun sessionDao(): SessionDao

    companion object {
        @Volatile
        private var instance: AudioScopeDatabase? = null

        fun get(context: Context): AudioScopeDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    AudioScopeDatabase::class.java,
                    "audioscope.db",
                )
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { instance = it }
            }
    }
}
