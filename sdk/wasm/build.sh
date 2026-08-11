#!/usr/bin/env bash
# build.sh — build the WebAssembly DSP module and stage it for the web app.
#
# Produces packages/dsp-wasm/dist/audioscope.{js,wasm} from the C++ DSP core.
# Requires the Emscripten SDK (emcc) on PATH; activate it first:
#     source "$HOME/emsdk/emsdk_env.sh"
#
# Usage:
#   ./sdk/wasm/build.sh            # configure + build + stage
#   ./sdk/wasm/build.sh --clean    # wipe build/wasm first

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SDK_DIR/.." && pwd)"
BUILD_DIR="$SDK_DIR/build/wasm"
DIST_DIR="$REPO_ROOT/packages/dsp-wasm/dist"

CLEAN=0
[[ "${1:-}" == "--clean" ]] && CLEAN=1

# --- toolchain check --------------------------------------------------- #
if ! command -v emcc >/dev/null 2>&1; then
    if [[ -f "${EMSDK:-/nonexistent}/emsdk_env.sh" ]]; then
        # shellcheck disable=SC1090
        source "$EMSDK/emsdk_env.sh"
    elif [[ -f "$HOME/emsdk/emsdk_env.sh" ]]; then
        # shellcheck disable=SC1090
        source "$HOME/emsdk/emsdk_env.sh"
    else
        echo "ERROR: emcc not found. Install/activate the Emscripten SDK first:" >&2
        echo "  git clone https://github.com/emscripten-core/emsdk.git \$HOME/emsdk" >&2
        echo "  \$HOME/emsdk/emsdk install latest && \$HOME/emsdk/emsdk activate latest" >&2
        echo "  source \$HOME/emsdk/emsdk_env.sh" >&2
        exit 1
    fi
fi

# --- clean ------------------------------------------------------------- #
if [[ $CLEAN -eq 1 ]]; then
    echo ">> cleaning $BUILD_DIR"
    rm -rf "$BUILD_DIR"
fi

# --- configure + build ------------------------------------------------- #
echo ">> configuring WASM build (preset: wasm)"
(cd "$SDK_DIR" && cmake --preset wasm)

echo ">> building audioscope.js + audioscope.wasm"
cmake --build "$BUILD_DIR" --target audioscope_wasm -j

# --- stage outputs ----------------------------------------------------- #
# The wasm subproject is added via add_subdirectory, so outputs land in a
# nested `wasm/` subdir of the binary dir.
JS_SRC="$BUILD_DIR/wasm/audioscope.js"
WASM_SRC="$BUILD_DIR/wasm/audioscope.wasm"

if [[ ! -f "$JS_SRC" || ! -f "$WASM_SRC" ]]; then
    echo "ERROR: expected outputs not found:" >&2
    echo "  $JS_SRC" >&2
    echo "  $WASM_SRC" >&2
    exit 1
fi

mkdir -p "$DIST_DIR"
cp -f "$JS_SRC" "$DIST_DIR/audioscope.js"
cp -f "$WASM_SRC" "$DIST_DIR/audioscope.wasm"

echo ">> staged to $DIST_DIR"
ls -lh "$DIST_DIR/audioscope.js" "$DIST_DIR/audioscope.wasm"
echo ">> done"
