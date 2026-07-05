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
        // provided by export.js, loaded first
        resultsToCSV: 'readonly', resultsToJSON: 'readonly'
      }
    }
  },
  {
    files: ['i18n.js', 'export.js'],
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
    files: ['worker.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.worker,
        createMcFinder: 'readonly',   // mcfinder.js glue
        seedToBigInt: 'readonly',     // seed.js
        scanGrid: 'readonly',         // search.js
        SEARCH_MAX_CELLS: 'readonly',
        SEARCH_MAX_HITS: 'readonly'
      }
    }
  },
  {
    files: ['seed.js', 'search.js'],
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
    files: ['test/**/*.js', 'eslint.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node }
    }
  }
];
