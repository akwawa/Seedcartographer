#!/usr/bin/env node
// scripts/sw-version.js — stamp the VERSION constant in sw.js with a content
// hash of every precached asset, so each deployment (Pages, Docker) that
// changes any asset automatically invalidates the offline cache.
//
//   node scripts/sw-version.js <site-dir>
//
// The checked-in sw.js keeps a fixed dev placeholder for local serving.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// the ASSETS array in sw.js is the canonical runtime file set
/**
 * @param {string} swSource sw.js source text
 * @returns {string[]} asset paths relative to the site root
 */
function parseAssets(swSource) {
  const m = swSource.match(/const ASSETS = \[([^\]]*)\]/);
  if (!m) throw new Error('ASSETS array not found in sw.js');
  return [...m[1].matchAll(/'\.\/([^']*)'/g)].map(([, p]) => p).filter(Boolean);
}

// deterministic version string from (path, content) pairs
/**
 * @param {Array<{path: string, content: string|Buffer}>} files assets to hash
 * @returns {string} deterministic cache version
 */
function contentVersion(files) {
  const h = crypto.createHash('sha256');
  for (const f of files) {
    h.update(f.path); h.update('\0'); h.update(f.content); h.update('\0');
  }
  return 'seedcartographer-' + h.digest('hex').slice(0, 16);
}

/**
 * @param {string} swSource sw.js source text
 * @param {string} version replacement VERSION value
 * @returns {string} rewritten source
 */
function stampVersion(swSource, version) {
  const out = swSource.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
  if (out === swSource) throw new Error('VERSION line not found in sw.js');
  return out;
}

// The tool only ever works below the invoking process's working directory
// (the CI workspace / staging dir): every path derived from the CLI argument
// or from an ASSETS entry is canonicalized and validated against that
// untainted base before any filesystem access.
/**
 * @param {string} abs canonicalized absolute path
 * @returns {string} the same path, validated below process.cwd()
 */
function insideCwd(abs) {
  const base = fs.realpathSync(process.cwd());
  if (abs !== base && !abs.startsWith(base + path.sep)) {
    throw new Error(`path escapes the working directory: ${abs}`);
  }
  return abs;
}

// hash the assets of `dir` and rewrite its sw.js in place; returns the version
/**
 * @param {string} dir site directory containing sw.js and the assets
 * @returns {string} the stamped cache version
 */
function stampDir(dir) {
  const root = insideCwd(fs.realpathSync(path.resolve(dir)));
  const resolveInside = (/** @type {string} */ rel) => {
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(root + path.sep)) throw new Error(`path escapes ${root}: ${rel}`);
    return insideCwd(abs);
  };
  const swPath = resolveInside('sw.js');
  const src = fs.readFileSync(swPath, 'utf8');
  const files = parseAssets(src).map((p) => ({ path: p, content: fs.readFileSync(resolveInside(p)) }));
  const version = contentVersion(files);
  fs.writeFileSync(swPath, stampVersion(src, version));
  return version;
}

if (require.main === module) {
  console.log(stampDir(process.argv[2] || '.'));
}

module.exports = { parseAssets, contentVersion, stampVersion, stampDir };
