# Recompiler le module WebAssembly

`mcfinder.wasm` (et sa glue `mcfinder.js`) est compilé à partir de
`mcfinder.c` et de la bibliothèque [cubiomes](https://github.com/Cubitect/cubiomes),
incluse en **submodule git épinglé** (`cubiomes/`).

> Le `.wasm` commité doit toujours correspondre à `mcfinder.c` et à la révision
> du submodule : le job CI `wasm` recompile à chaque push et échoue si le
> binaire commité diffère du binaire reproduit. Si vous modifiez `mcfinder.c`
> ou mettez à jour cubiomes, recompilez et commitez les artefacts ensemble
> (et incrémentez `VERSION` dans `sw.js`).

## Prérequis

- [Emscripten](https://emscripten.org/docs/getting_started/downloads.html)
  (emsdk) — la CI épingle la version **6.0.2** ; utilisez la même pour obtenir
  un binaire identique.
- git

## Étapes

```bash
# 1. Récupérer le submodule cubiomes (révision épinglée)
git submodule update --init

# 2. Installer / activer emsdk (une fois)
git clone https://github.com/emscripten-core/emsdk.git
./emsdk/emsdk install 6.0.2 && ./emsdk/emsdk activate 6.0.2
source ./emsdk/emsdk_env.sh

# 3. Compiler
./build.sh
```

`build.sh` contient la commande `emcc` exacte (flags `MODULARIZE`,
`WASM_BIGINT` — requis car la seed est passée en `uint64_t` depuis un `BigInt`
JavaScript —, `ALLOW_MEMORY_GROWTH`, exports runtime `UTF8ToString`/`HEAP32`/
`HEAPU8`).

## Vérifier

```bash
npm test                                           # tests unitaires
CHROMIUM_PATH=$(which chromium) npm run e2e        # suite end-to-end complète
git diff mcfinder.wasm mcfinder.js                 # rien à recommiter ?
```
