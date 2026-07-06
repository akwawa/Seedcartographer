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
        biomeLabel: 'readonly', convertCoords: 'readonly',
        // provided by slime.js / presets.js, loaded first
        SLIME_STRUCT_TYPE: 'readonly',
        PRESETS: 'readonly', presetCriteria: 'readonly',
        // provided by favorites.js, loaded first
        parseFavorites: 'readonly', addFavorite: 'readonly', findFavorite: 'readonly',
        removeFavorite: 'readonly', updateFavoriteNote: 'readonly', favoritesFor: 'readonly',
        // provided by legend.js, loaded first
        legendEntries: 'readonly'
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
        SLIME_STRUCT_TYPE: 'readonly'
      }
    }
  },
  {
    files: ['seed.js', 'search.js', 'slime.js', 'presets.js', 'favorites.js', 'legend.js'],
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
    files: ['test/**/*.js', 'eslint.config.js', 'playwright.config.js'],
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
