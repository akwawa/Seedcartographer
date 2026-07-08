// ESLint flat config. The app is plain scripts sharing globals across files
// (i18n.js/seed.js/search.js are loaded before app.js / via importScripts),
// so the cross-file symbols are declared per environment below.
'use strict';
const globals = require('globals');
const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    ignores: ['mcfinder.js'] // Emscripten-generated glue
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['app.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // provided by i18n.js, loaded first
        t: 'readonly', applyI18n: 'readonly', setLang: 'readonly',
        currentLang: 'readonly', I18N_LANGS: 'readonly',
        // provided by export.js / biomes.js, loaded first
        resultsToCSV: 'readonly', resultsToJSON: 'readonly',
        mapCartoucheLines: 'readonly', exportFileName: 'readonly', parseLocationsCSV: 'readonly',
        biomeLabel: 'readonly', convertCoords: 'readonly',
        // provided by slime.js / markers.js / presets.js, loaded first
        SLIME_STRUCT_TYPE: 'readonly',
        SPAWN_STRUCT_TYPE: 'readonly', STRONGHOLD_STRUCT_TYPE: 'readonly', QUADHUT_STRUCT_TYPE: 'readonly',
        PRESETS: 'readonly', presetCriteria: 'readonly',
        // provided by favorites.js, loaded first
        parseFavorites: 'readonly', addFavorite: 'readonly', findFavorite: 'readonly',
        removeFavorite: 'readonly', updateFavoriteNote: 'readonly', favoritesFor: 'readonly',
        // provided by legend.js / theme.js / maptools.js, loaded first
        legendEntries: 'readonly',
        scaleBarSpec: 'readonly', gridSpec: 'readonly', gridLines: 'readonly',
        MINIMAP_ZOOM_OUT: 'readonly', minimapClickToWorld: 'readonly', viewportRectOnMinimap: 'readonly', parseGotoInput: 'readonly', rulerMeasure: 'readonly', HISTORY_MAX: 'readonly', addHistoryEntry: 'readonly', parseHistory: 'readonly',
        tileWorldKey: 'readonly', tileKey: 'readonly', createTileCache: 'readonly', tilesInView: 'readonly',
        seedToBigInt: 'readonly',
        SEED_SEARCH_MAX_TOTAL: 'readonly', SEED_SEARCH_MAX_FOUND: 'readonly',
        sequentialSeeds: 'readonly', randomSeeds: 'readonly', planBatches: 'readonly',
        encodeShareState: 'readonly', decodeShareState: 'readonly', normalizeLegacyCriteria: 'readonly',
        sanitizeCriteria: 'readonly', sanitizeWorldView: 'readonly', worldToScreen: 'readonly', screenToWorld: 'readonly',
        THEME_COLORS: 'readonly', resolveTheme: 'readonly', otherTheme: 'readonly'
      }
    }
  },
  {
    files: ['i18n.js', 'export.js', 'biomes.js', 'coords.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, module: 'readonly' }
    },
    rules: {
      // defines the i18n API consumed by app.js
      'no-unused-vars': 'off'
    }
  },
  {
    // i18n.js <-> biomes.js reference each other's bindings at call time
    files: ['i18n.js'],
    languageOptions: { globals: { biomeLabel: 'readonly', convertCoords: 'readonly' } }
  },
  {
    files: ['biomes.js'],
    languageOptions: { globals: { currentLang: 'readonly' } }
  },
  {
    // seedsearch.js consumes seedToBigInt (seed.js in the browser, require in Node)
    files: ['seedsearch.js'],
    languageOptions: { globals: { seedToBigInt: 'readonly', require: 'readonly', globalThis: 'readonly' } }
  },
  {
    // sharestate.js runs in the browser (btoa/atob) and in Node tests (Buffer)
    files: ['sharestate.js'],
    languageOptions: { globals: { btoa: 'readonly', atob: 'readonly', Buffer: 'readonly' } }
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
        SPAWN_STRUCT_TYPE: 'readonly',       // markers.js
        STRONGHOLD_STRUCT_TYPE: 'readonly',
        QUADHUT_STRUCT_TYPE: 'readonly'
      }
    }
  },
  {
    files: ['seed.js', 'search.js', 'slime.js', 'markers.js', 'presets.js', 'favorites.js', 'legend.js', 'theme.js', 'maptools.js', 'tilecache.js', 'sharestate.js', 'seedsearch.js', 'searchhistory.js'],
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
    files: ['test/**/*.js', 'scripts/**/*.js', 'eslint.config.js', 'playwright.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node }
    }
  },
  {
    // Playwright specs run in Node, but evaluate()/waitForFunction() callbacks
    // execute in the browser page, where the app's globals exist
    files: ['e2e/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.browser, syncHash: 'readonly' }
    }
  }
];
