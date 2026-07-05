# Recompiler le module WebAssembly

Le binaire `mcfinder.wasm` (et sa glue `mcfinder.js`) est compilé à partir de
`mcfinder.c` et de la bibliothèque [cubiomes](https://github.com/Cubitect/cubiomes).
Les sources de cubiomes ne sont pas incluses dans ce dépôt : il faut les cloner
au moment du build.

> ⚠️ Le `.wasm` commité doit toujours correspondre à `mcfinder.c`. Si vous
> modifiez `mcfinder.c`, recompilez et commitez les deux artefacts ensemble.

## Prérequis

- [Emscripten](https://emscripten.org/docs/getting_started/downloads.html) (emsdk)
- git, make

## Étapes

```bash
# 1. Cloner cubiomes à la racine du projet (le dossier est ignoré par git)
git clone https://github.com/Cubitect/cubiomes.git

# 2. Compiler le wrapper + cubiomes en un module WASM
emcc mcfinder.c \
  cubiomes/noise.c cubiomes/biomes.c cubiomes/layers.c \
  cubiomes/biomenoise.c cubiomes/generator.c cubiomes/finders.c \
  cubiomes/util.c cubiomes/quadbase.c \
  -I cubiomes \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME=createMcFinder \
  -s WASM_BIGINT=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_RUNTIME_METHODS=UTF8ToString \
  -s EXPORTED_FUNCTIONS=_malloc,_free \
  -o mcfinder.js
```

Notes :

- `WASM_BIGINT` est requis : la seed est passée en `uint64_t` depuis un
  `BigInt` JavaScript (`worker.js`).
- La liste exacte des fichiers `.c` de cubiomes peut évoluer avec les versions
  de la bibliothèque ; en cas de symbole manquant, compilez tous les `.c` de la
  racine de cubiomes.
- Épinglez la révision de cubiomes utilisée (tag ou commit) et mentionnez-la
  dans le message de commit qui met à jour le `.wasm`, afin que le build reste
  reproductible.

## Vérifier

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000 : la carte doit se générer et la
# recherche de la démo (seed 141) doit retourner des résultats.
npm test
```
