#!/usr/bin/env bash
# Rebuild mcfinder.js / mcfinder.wasm from mcfinder.c + the pinned cubiomes
# submodule. Requires an activated Emscripten SDK (emcc on PATH):
#   git submodule update --init
#   ./build.sh
set -euo pipefail
cd "$(dirname "$0")" || exit 1

if ! command -v emcc >/dev/null; then
  echo "emcc not found — install and activate emsdk first" >&2
  exit 1
fi
if [[ ! -f cubiomes/generator.h ]]; then
  echo "cubiomes submodule missing — run: git submodule update --init" >&2
  exit 1
fi

emcc mcfinder.c \
  cubiomes/noise.c cubiomes/biomes.c cubiomes/layers.c \
  cubiomes/biomenoise.c cubiomes/generator.c cubiomes/finders.c \
  cubiomes/util.c cubiomes/quadbase.c \
  -I cubiomes \
  -O3 \
  -sWASM=1 \
  -sMODULARIZE=1 \
  -sEXPORT_NAME=createMcFinder \
  -sWASM_BIGINT=1 \
  -sALLOW_MEMORY_GROWTH=1 \
  -sGROWABLE_ARRAYBUFFERS=0 \
  -sEXPORTED_RUNTIME_METHODS=UTF8ToString,HEAP32,HEAPU8 \
  -sEXPORTED_FUNCTIONS=_malloc,_free \
  -o mcfinder.js

echo "Built mcfinder.js + mcfinder.wasm with $(emcc --version | head -1)"
echo "cubiomes revision: $(git -C cubiomes rev-parse HEAD)"
