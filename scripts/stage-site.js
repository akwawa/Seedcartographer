#!/usr/bin/env node
// scripts/stage-site.js — copy the runtime files of THIS checkout into a
// staging directory for the Pages deploy (#336).
//
//   node scripts/stage-site.js <dest-dir> [--cname] [--skip-missing]
//
// The Pages workflow rebuilds both branches (main at the site root, dev
// under /dev/) on every push; the file list used to live inline in the
// workflow of the triggering branch, so a file added on dev broke the main
// build until the next release. Each checkout now stages its own list by
// running this script. --cname additionally ships the CNAME file (site
// root only: a CNAME inside /dev/ would be ignored anyway). --skip-missing
// tolerates absent files (transition fallback: a checkout older than this
// script staged with a newer list).
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// runtime file set, kept in lockstep with sw.js ASSETS and the Dockerfile
// (test/deployfiles.test.mjs guards the three lists against drift)
const FILES = [
  'index.html', 'styles.css', 'app.js', 'worker.js', 'seed.js', 'search.js',
  'rarebiomes.js', 'shapes.js', 'sketch.js', 'i18n.js', 'biomes.js',
  'coords.js', 'portals.js', 'slime.js', 'markers.js', 'presets.js',
  'favorites.js', 'legend.js', 'maptools.js', 'tilecache.js', 'tiledb.js',
  'sharestate.js', 'seedsearch.js', 'searchqueue.js', 'searchhistory.js',
  'userpresets.js', 'usermarkers.js', 'userzones.js', 'userpaths.js',
  'userannotations.js', 'palette.js', 'tilegrid.js', 'relief.js',
  'view3d.js', 'compare.js', 'composition.js', 'profile.js', 'gallery.js',
  'gallery.json', 'errorreport.js', 'vitals.js', 'tour.js', 'keys.js',
  'theme.js', 'export.js', 'levelload.js', 'mcfinder.js', 'mcfinder.wasm',
  'manifest.webmanifest', 'icon.svg', 'sw.js', 'version.js'
];

// same containment guard as the version-stamping scripts: the destination
// must live below the invoking process's working directory
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

const destArg = process.argv[2];
if (!destArg) {
  console.error('usage: node scripts/stage-site.js <dest-dir> [--cname]');
  process.exit(1);
}
const withCname = process.argv.includes('--cname');
const skipMissing = process.argv.includes('--skip-missing');
const dest = insideCwd(path.resolve(destArg));
fs.mkdirSync(dest, { recursive: true });

const toShip = withCname ? [...FILES, 'CNAME'] : FILES;
let staged = 0;
for (const f of toShip) {
  if (skipMissing && !fs.existsSync(f)) {
    console.warn(`skipping missing ${f}`);
    continue;
  }
  fs.copyFileSync(f, path.join(dest, f));
  staged++;
}
fs.cpSync('fonts', path.join(dest, 'fonts'), { recursive: true });
console.log(`staged ${staged} files + fonts into ${dest}`);
