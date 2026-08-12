// build.rs — compile the C++ DSP core + the C ABI (FFI) bridge into the Rust
// server binary. The same C++ source is shared with the WASM, Android, and
// (later) Windows/Linux native targets via sdk/CMakeLists.txt; here we compile
// it with the `cc` crate so cargo build produces a single self-contained
// binary without needing CMake on the build host.
//
// Layout (relative to this file, which lives in rust/):
//   ../sdk/common/src/*.cpp        shared types, ring buffer, config
//   ../sdk/dsp/src/*.cpp           FFT, measurements, spectrogram, ...
//   ../sdk/bindings/ffi/audioscope_ffi.cpp   the C ABI seam
//
// Linking: lz4 is a build-time + runtime dep of the compression impl. We pick
// it up from the system via pkg-config (liblz4-dev) and add it to the link
// line. On a host without liblz4 the build fails loudly here — install it
// (apt-get install liblz4-dev / brew install lz4 / vcpkg install lz4).

use std::path::PathBuf;

fn main() {
    let target = std::env::var("TARGET").unwrap_or_default();

    // On Android the C++ DSP core is compiled by Gradle's externalNativeBuild
    // (CMake) into libaudioscope_dsp.so, which the app loads alongside this
    // Rust .so in the same process. The C ABI symbols dsp_ffi.rs declares are
    // left undefined here and resolved by the dynamic linker at dlopen time
    // (shared libraries allow undefined symbols). So we skip the cc-based C++
    // cross-compile entirely on Android — it would need the NDK toolchain
    // wired into the cc crate and would duplicate what CMake already builds.
    if target.contains("android") {
        println!("cargo:rustc-link-arg-cdylib=-landroid");
        println!("cargo:rustc-link-arg-cdylib=-llog");
        return;
    }

    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let sdk_dir = manifest_dir.join("..").join("sdk");

    let mut common = vec![
        sdk_dir.join("common/src/buffer.cpp"),
        sdk_dir.join("common/src/config.cpp"),
    ];
    let mut dsp = vec![
        sdk_dir.join("dsp/src/fft.cpp"),
        sdk_dir.join("dsp/src/measurements.cpp"),
        sdk_dir.join("dsp/src/spectrogram.cpp"),
        sdk_dir.join("dsp/src/corrections.cpp"),
        sdk_dir.join("dsp/src/trigger.cpp"),
        sdk_dir.join("dsp/src/compression.cpp"),
        sdk_dir.join("dsp/src/generators.cpp"),
        sdk_dir.join("dsp/src/dsp.cpp"),
    ];
    let ffi = vec![sdk_dir.join("bindings/ffi/audioscope_ffi.cpp")];

    // Include paths: sdk/common/include + sdk/dsp/include + the ffi dir.
    let includes = [
        sdk_dir.join("common/include"),
        sdk_dir.join("dsp/include"),
        sdk_dir.join("bindings/ffi"),
    ];

    let mut build = cc::Build::new();
    build
        .cpp(true)
        .std("c++17")
        .warnings(false) // the C++ core is built clean; don't let -Wall here trip on its style
        .opt_level(3)
        .flag_if_supported("-fvisibility=hidden");

    for inc in &includes {
        build.include(inc);
    }

    // Compile each translation unit. The cc crate links them all into one
    // static archive that cargo passes to the final linker.
    for src in common.drain(..).chain(dsp.drain(..)).chain(ffi) {
        let src = src.canonicalize().unwrap_or_else(|_| src.clone());
        println!("cargo:rerun-if-changed={}", src.display());
        build.file(src);
    }
    build.compile("audioscope_cpp_core");

    // `cargo:rustc-link-lib` from a build script applies to the *lib* target
    // only when the package also has a *bin* target (cargo does not forward
    // native-link deps from an rlib to the binary that links it). We work around
    // this by emitting `cargo:rustc-link-arg-bin` directives so the final
    // binary link line gets the C++ core archive, libstdc++, and liblz4
    // explicitly. (See https://doc.rust-lang.org/cargo/reference/build-scripts.html#rustc-link-arg-bin)
    let out_dir = std::env::var("OUT_DIR").unwrap();
    let lib_path = format!("{out_dir}/libaudioscope_cpp_core.a");
    println!("cargo:rustc-link-arg-bin=audio-scope-view={lib_path}");
    println!("cargo:rustc-link-arg-bin=audio-scope-view=-lstdc++");

    // Link the system liblz4 (compression impl). pkg-config is optional —
    // fall back to a bare `-llz4` so a non-pkg-config host (some CI images)
    // still links as long as liblz4.so is on the default search path.
    if pkg_config_probe("liblz4") {
        // pkg-config found it and emitted the link flags above.
    } else {
        println!("cargo:rustc-link-arg-bin=audio-scope-view=-llz4");
    }
}

/// Returns true when pkg-config found the lib and emitted its flags.
fn pkg_config_probe(name: &str) -> bool {
    // We shell out manually rather than pulling in the `pkg-config` crate to
    // keep build-dependencies minimal (cc is the only build-dep).
    let ok = std::process::Command::new("pkg-config")
        .args(["--libs", "--cflags", name])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);
    if !ok {
        return false;
    }
    let out = std::process::Command::new("pkg-config")
        .args(["--libs", name])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_default();
    for flag in out.split_whitespace() {
        if let Some(lib) = flag.strip_prefix("-l") {
            // Emit both styles: `rustc-link-lib` for the lib target and a raw
            // `rustc-link-arg-bin` so the binary link line includes the lib too.
            println!("cargo:rustc-link-lib=dylib={lib}");
            println!("cargo:rustc-link-arg-bin=audio-scope-view=-l{lib}");
        } else if let Some(dir) = flag.strip_prefix("-L") {
            println!("cargo:rustc-link-search=native={dir}");
        }
    }
    let cout = std::process::Command::new("pkg-config")
        .args(["--cflags", name])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_default();
    for flag in cout.split_whitespace() {
        if let Some(dir) = flag.strip_prefix("-I") {
            println!("cargo:include={dir}");
        }
    }
    true
}
