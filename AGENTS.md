# audio-scope-view

Monorepo: Rust backend (`rust/`), C++ DSP core + bindings + ESP32 firmware (`sdk/`), web app (`apps/vyzorWeb/`), mobile app (`apps/vyzorMobile/`), shared packages (`packages/`). Each directory has its own AGENTS.md with detailed rules — read it before editing there.

- The C++ core in `sdk/` is the single DSP source of truth; web (WASM), Rust (FFI) and mobile (JNI) only wrap it — never reimplement DSP in TS/Rust.
- Commit the built WASM artifacts in `packages/dsp-wasm/dist` (un-ignored in .gitignore): the hosted build has no Emscripten toolchain, so it cannot regenerate them. Rebuild them after any `sdk/` DSP change.
- Browser clients use relative `/graphql` and `/ws` endpoints: deploys proxy them, absolute localhost URLs break.
- No user auth: data is scoped per device via `X-Device-Id`; every resolver must enforce device ownership.
