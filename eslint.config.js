// ESLint flat config. The page is an ES module graph rooted at app.js; only
// the files shared with worker.js via importScripts (seed.js, search.js,
// shapes.js, slime.js, markers.js, palette.js, tilegrid.js, relief.js) stay
// plain scripts sharing globals, declared per environment below (#224).
'use strict';
const globals = require('globals');
const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    // Emscripten-generated glue and the Stryker mutation sandbox
    ignores: ['mcfinder.js', '.stryker-tmp/']
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // no innerHTML/outerHTML/insertAdjacentHTML anywhere: everything the
      // app builds from data (results, criteria rows, gallery cards…) goes
      // through textContent/createElement, so untrusted strings (share
      // links, imported CSV/JSON) can never be parsed as markup
      'no-restricted-properties': ['error',
        { property: 'innerHTML', message: 'Use textContent or DOM methods instead.' },
        { property: 'outerHTML', message: 'Use textContent or DOM methods instead.' }
      ],
      'no-restricted-syntax': ['error',
        { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: 'Use DOM methods instead.' }
      ]
    }
  },
  {
    files: ['app.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // classic scripts shared with worker.js (importScripts), loaded first
        seedToBigInt: 'readonly',                                          // seed.js
        SLIME_STRUCT_TYPE: 'readonly',                                     // slime.js
        SPAWN_STRUCT_TYPE: 'readonly', STRONGHOLD_STRUCT_TYPE: 'readonly', // markers.js
        QUADHUT_STRUCT_TYPE: 'readonly',
        altRgb: 'readonly',                                                // palette.js
        TILE_GRID_CACHE_MAX: 'readonly', TILE_PAINT_MAX: 'readonly',       // tilegrid.js
        renderScaleFor: 'readonly', tilesForView: 'readonly', unionPresent: 'readonly',
        sortHitsByDist: 'readonly',                                        // search.js
        // provided by the Umami analytics script tag (index.html), if loaded
        umami: 'readonly'
      }
    }
  },
  {
    // Pure-logic ES modules imported by app.js and by the Node tests
    files: [
      'i18n.js', 'biomes.js', 'coords.js', 'presets.js', 'favorites.js',
      'legend.js', 'maptools.js', 'tilecache.js', 'sharestate.js',
      'seedsearch.js', 'searchhistory.js', 'userpresets.js', 'usermarkers.js',
      'profile.js', 'gallery.js', 'theme.js', 'export.js', 'version.js',
      'errorreport.js'
    ],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.browser }
    }
  },
  {
    // search.js consumes shapes.js (importScripts in the worker, require in
    // Node)
    files: ['search.js'],
    languageOptions: { globals: { require: 'readonly', prepShapeClauses: 'readonly', shapePass: 'readonly', globalThis: 'readonly' } }
  },
  {
    // sharestate.js runs in the browser (btoa/atob) and in Node tests (Buffer)
    files: ['sharestate.js'],
    languageOptions: { globals: { Buffer: 'readonly' } }
  },
  {
    files: ['sw.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.serviceworker }
    }
  },
  {
    files: ['worker.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.worker,
        createMcFinder: 'readonly',   // mcfinder.js glue
        seedToBigInt: 'readonly',     // seed.js
        scanGrid: 'readonly',         // search.js
        SEARCH_MAX_CELLS: 'readonly',
        SEARCH_MAX_HITS: 'readonly',
        slimeChunksInBox: 'readonly', // slime.js
        SLIME_STRUCT_TYPE: 'readonly',
        pairMidpoints: 'readonly',    // search.js
        altBiomeColors: 'readonly',   // palette.js
        TILE_CELLS: 'readonly',       // tilegrid.js
        reliefSampleStep: 'readonly', // relief.js
        hillshade: 'readonly',
        upsampleShade: 'readonly',
        SPAWN_STRUCT_TYPE: 'readonly',       // markers.js
        STRONGHOLD_STRUCT_TYPE: 'readonly',
        QUADHUT_STRUCT_TYPE: 'readonly'
      }
    }
  },
  {
    files: ['seed.js', 'search.js', 'shapes.js', 'slime.js', 'markers.js', 'palette.js', 'tilegrid.js', 'relief.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { module: 'readonly' }
    },
    rules: {
      // define the API consumed by worker.js via importScripts
      'no-unused-vars': 'off'
    }
  },
  {
    files: ['scripts/**/*.js', 'eslint.config.js', 'playwright.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node }
    }
  },
  {
    // Node tests are ES modules; the converted app sources are imported
    // directly, the worker-shared CommonJS ones through createRequire (#224)
    files: ['test/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node }
    }
  },
  {
    // Playwright specs run in Node, but evaluate()/waitForFunction() callbacks
    // execute in the browser page, where the app's globals exist
    files: ['e2e/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.browser, syncHash: 'readonly', decodeShareHash: 'readonly' }
    }
  }
];
