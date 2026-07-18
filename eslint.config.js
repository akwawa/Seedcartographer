// ESLint flat config. The whole app is an ES module graph rooted at app.js
// and worker.js (module worker); the Node tests import the same files (#224).
import globals from 'globals';
import js from '@eslint/js';

export default [
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
      'seedsearch.js', 'searchhistory.js', 'userpresets.js', 'usermarkers.js', 'userzones.js',
      'profile.js', 'gallery.js', 'theme.js', 'export.js', 'version.js',
      'errorreport.js', 'seed.js', 'search.js', 'rarebiomes.js', 'shapes.js', 'slime.js', 'tour.js', 'keys.js',
      'markers.js', 'palette.js', 'tilegrid.js', 'relief.js'
    ],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.browser }
    }
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
      sourceType: 'module',
      globals: { ...globals.worker }
    }
  },
  {
    files: ['scripts/**/*.js', 'eslint.config.js', 'playwright.config.js'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node }
    }
  },
  {
    // Node tests are ES modules importing the app sources directly (#224)
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
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser, syncHash: 'readonly', decodeShareHash: 'readonly' }
    }
  }
];
