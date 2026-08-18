//! JNI bridge between the Kotlin app (`dev.vinns.vyzorix.RustServer`) and the
//! Rust server. The Android app links this crate as a shared library
//! (`libaudioscope_server.so`) and drives the in-process server through these
//! `extern "C"` JNI exports — no TCP socket, no `main()`.
//!
//! Compiled only with the `android` feature. The runtime storage backend is
//! selected by `ASV_STORAGE_BACKEND=android` (see `android.rs`); the JNI entry
//! points here spin the tokio runtime `build_app_state` needs and hold the
//! resulting `AppState` for the capture entry points.

#![cfg(feature = "android")]

use std::sync::Arc;
use std::sync::OnceLock;

use jni::objects::{JObject, JString};
use jni::JNIEnv;
use tokio::runtime::Runtime;
use tokio::sync::Mutex;
use tracing_subscriber::fmt::MakeWriter;

use crate::api::server_graphql::AppState;
use crate::infrastructure::android::build_app_state;

/// Process-wide tokio runtime. Android's JNI thread is not a tokio thread, so
/// every async entry point blocks on `runtime.handle().block_on(...)`.
static RUNTIME: OnceLock<Runtime> = OnceLock::new();

fn runtime() -> &'static Runtime {
    RUNTIME.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("failed to build tokio runtime")
    })
}

/// Owned server handle held across JNI calls until `nativeStopServer` drops it.
static SERVER: OnceLock<Mutex<Option<Arc<AppState>>>> = OnceLock::new();

fn server_lock() -> &'static Mutex<Option<Arc<AppState>>> {
    SERVER.get_or_init(|| Mutex::new(None))
}

// The bootstrap key must be >= 16 chars (same rule as the server). Clamp a
// misconfigured app to a dev default so it still boots instead of crashing.
const DEV_BOOTSTRAP_KEY: &str = "dev-bootstrap-key-android";

/// Start the in-process server against on-device SQLite. Returns 1 on success,
/// 0 on failure (surfaced to Kotlin).
#[unsafe(no_mangle)]
pub extern "C" fn Java_dev_vinns_vyzorix_RustServer_nativeStartServer(
    mut env: JNIEnv<'_>,
    _class: JObject<'_>,
    bootstrap_key: jni::sys::jstring,
) -> jni::sys::jlong {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_writer(LogcatWriter::new())
        .try_init();

    let key = jstring_to_string(&mut env, bootstrap_key);
    let key = if key.len() >= 16 {
        key
    } else {
        DEV_BOOTSTRAP_KEY.to_string()
    };

    let rt = runtime();
    let result = rt.block_on(async {
        let mut guard = server_lock().lock().await;
        if guard.is_some() {
            tracing::info!("Android server already running — reusing handle");
            return Ok::<_, String>(());
        }
        match build_app_state(key).await {
            Ok(state) => {
                *guard = Some(state);
                Ok(())
            }
            Err(e) => Err(format!("{e:?}")),
        }
    });

    if let Err(e) = result {
        tracing::error!("Android server start failed: {e}");
        return 0;
    }
    1
}

#[unsafe(no_mangle)]
pub extern "C" fn Java_dev_vinns_vyzorix_RustServer_nativeStopServer(
    _env: JNIEnv<'_>,
    _class: JObject<'_>,
) {
    let rt = runtime();
    rt.block_on(async {
        let mut guard = server_lock().lock().await;
        *guard = None;
    });
    tracing::info!("Android server stopped");
}

#[unsafe(no_mangle)]
pub extern "C" fn Java_dev_vinns_vyzorix_RustServer_nativeServerVersion(
    mut env: JNIEnv<'_>,
    _class: JObject<'_>,
) -> jni::sys::jstring {
    let s = env
        .new_string(env!("CARGO_PKG_VERSION"))
        .unwrap_or_else(|_| env.new_string("0.0.0-unknown").unwrap());
    s.into_raw()
}

/// Confirm the server is running (post-nativeStartServer). Returns 1 if the
/// in-process AppState is live, 0 otherwise. The Kotlin side polls this on
/// boot to verify the storage backend came up before issuing GraphQL/REST.
#[unsafe(no_mangle)]
pub extern "C" fn Java_dev_vinns_vyzorix_RustServer_nativeIsRunning(
    _env: JNIEnv<'_>,
    _class: JObject<'_>,
) -> jni::sys::jint {
    let rt = runtime();
    let running = rt.block_on(async {
        let guard = server_lock().lock().await;
        guard.is_some()
    });
    if running {
        1
    } else {
        0
    }
}

// NOTE: there is intentionally no capture entry point here. On Android the
// server is storage-only — live capture is the app's own Oboe → C++ DSP path
// (DspModule / libaudioscope_dsp.so). The server's cpal backend is left as-is
// for the deployed server; it is not exercised on-device.

// --- helpers ---

fn jstring_to_string(env: &mut JNIEnv<'_>, js: jni::sys::jstring) -> String {
    if js.is_null() {
        return String::new();
    }
    // jni 0.21: take ownership of the raw local ref as a JString, borrow it as
    // a JavaStr, then copy out the UTF-8.
    let jstr: JString<'_> = unsafe { JString::from_raw(js) };
    env.get_string(&jstr)
        .ok()
        .and_then(|s| s.to_str().ok().map(|t| t.to_string()))
        .unwrap_or_default()
}

/// tracing `MakeWriter` impl that forwards to Android logcat via libc directly
/// (avoids an extra android_logger dependency at build time).
struct LogcatWriter;

impl LogcatWriter {
    fn new() -> Self {
        LogcatWriter
    }
}

impl<'a> MakeWriter<'a> for LogcatWriter {
    type Writer = LogcatWrite;

    fn make_writer(&'a self) -> Self::Writer {
        LogcatWrite
    }
}

struct LogcatWrite;

impl std::io::Write for LogcatWrite {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        use std::ffi::CString;
        use std::os::raw::c_int;
        unsafe extern "C" {
            fn __android_log_write(
                prio: c_int,
                tag: *const std::os::raw::c_char,
                text: *const std::os::raw::c_char,
            ) -> c_int;
        }
        const ANDROID_LOG_INFO: c_int = 4;
        let tag = CString::new("audio-scope-server").unwrap_or_default();
        let msg = CString::new(buf).unwrap_or_default();
        unsafe {
            __android_log_write(ANDROID_LOG_INFO, tag.as_ptr(), msg.as_ptr());
        }
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}
