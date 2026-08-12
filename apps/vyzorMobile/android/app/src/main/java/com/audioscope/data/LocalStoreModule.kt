package com.audioscope.data

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/**
 * LocalStoreModule — exposes the on-device Room store to JS for
 * server-optional local mode. Each @ReactMethod is a thin async wrapper over
 * LocalSessionRepository; values cross the bridge as JSON strings so the JS
 * side parses into the same Session shape the Apollo client uses.
 *
 * JS usage (app/lib/local-store.ts):
 *   const rows = await LocalStore.listSessions(50, 0);   // JSON string
 *   const s    = await LocalStore.insertSession({...});  // JSON string
 *   await LocalStore.markClean(id, serverId);
 *
 * All DB work runs on Dispatchers.IO via the module scope; results hop back
 * to the JS thread inside the promise.
 */
class LocalStoreModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun getName(): String = "AudioScopeLocalStore"

    override fun invalidate() {
        scope.cancel()
        super.invalidate()
    }

    @ReactMethod
    fun insertSession(input: ReadableMap, promise: Promise) = launchScoped(promise) {
        LocalStore.get().insert(input.toHashMap()).toJson()
    }

    @ReactMethod
    fun updateSession(id: String, patch: ReadableMap, promise: Promise) = launchScoped(promise) {
        LocalStore.get().update(id, patch.toHashMap())?.toJson() ?: "null"
    }

    @ReactMethod
    fun getSession(id: String, promise: Promise) = launchScoped(promise) {
        LocalStore.get().get(id)?.toJson() ?: "null"
    }

    @ReactMethod
    fun listSessions(limit: Int, offset: Int, promise: Promise) = launchScoped(promise) {
        val rows = LocalStore.get().list(limit.coerceAtLeast(0), offset.coerceAtLeast(0))
        JSONArray().apply { rows.forEach { put(it.toJsonObj()) } }.toString()
    }

    @ReactMethod
    fun countSessions(promise: Promise) = launchScoped(promise) {
        LocalStore.get().count().toString()
    }

    @ReactMethod
    fun dirtySessions(promise: Promise) = launchScoped(promise) {
        val rows = LocalStore.get().dirty()
        JSONArray().apply { rows.forEach { put(it.toJsonObj()) } }.toString()
    }

    @ReactMethod
    fun markClean(id: String, serverId: String, promise: Promise) = launchScoped(promise) {
        LocalStore.get().markClean(id, serverId); "true"
    }

    @ReactMethod
    fun deleteSession(id: String, promise: Promise) = launchScoped(promise) {
        LocalStore.get().delete(id).toString()
    }

    @ReactMethod
    fun clearAll(promise: Promise) = launchScoped(promise) {
        LocalStore.get().clear(); "true"
    }

    private fun launchScoped(
        promise: Promise,
        block: suspend () -> String,
    ) {
        scope.launch {
            try {
                val result = withContext(Dispatchers.IO) { block() }
                promise.resolve(result)
            } catch (t: Throwable) {
                promise.reject("LocalStoreError", t.message, t)
            }
        }
    }
}

// ---- JSON helpers: keep the bridge payload a single JSON string ----

private fun SessionDto.toJson(): String = toJsonObj().toString()

private fun SessionDto.toJsonObj(): JSONObject = JSONObject().apply {
    put("id", id)
    put("userId", userId ?: JSONObject.NULL)
    put("name", name ?: JSONObject.NULL)
    put("description", description ?: JSONObject.NULL)
    put("startedAt", startedAt)
    put("endedAt", endedAt ?: JSONObject.NULL)
    put("durationSeconds", durationSeconds ?: JSONObject.NULL)
    put("oscilloscopeOpenedAt", oscilloscopeOpenedAt ?: JSONObject.NULL)
    put("oscilloscopeDurationMs", oscilloscopeDurationMs ?: JSONObject.NULL)
    put("parentSessionId", parentSessionId ?: JSONObject.NULL)
    put("isSubSession", isSubSession)
    put("autoCloseTimeoutSecs", autoCloseTimeoutSecs ?: JSONObject.NULL)
    put("peakAmplitude", peakAmplitude)
    put("rmsAmplitude", rmsAmplitude)
    put("dcOffset", dcOffset)
    put("dominantFrequency", dominantFrequency)
    put("frequencyHigh", frequencyHigh)
    put("frequencyLow", frequencyLow)
    put("recordingCount", recordingCount)
    put("subSessionCount", subSessionCount)
    put("isOscilloscopeOpen", isOscilloscopeOpen)
    put("serverDirty", serverDirty)
    put("serverId", serverId ?: JSONObject.NULL)
}
