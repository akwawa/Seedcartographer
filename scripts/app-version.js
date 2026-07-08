#!/usr/bin/env node
// scripts/app-version.js — stamp version.js with the release version
// (package.json, managed by release-please) and the short git commit, so
// the help dialog shows exactly what is deployed.
//
//   node scripts/app-version.js <site-dir>
//
// The checked-in version.js keeps a fixed dev placeholder for local serving.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// rewrite the APP_VERSION line of a version.js source
/**
 * @param {string} source version.js source text
 * @param {string} version release version
 * @param {string} commit short commit hash
 * @returns {string} rewritten source
 */
function stampAppVersion(source, version, commit) {
  const line = `const APP_VERSION = { version: '${version}', commit: '${commit}' };`;
  const out = source.replace(/const APP_VERSION = \{[^}]*\};/, line);
  if (out === source) throw new Error('APP_VERSION line not found in version.js');
  return out;
}

// stamp `dir`/version.js in place from the repo's package.json + git HEAD
/**
 * @param {string} dir site directory containing version.js
 * @returns {{version: string, commit: string}} the stamped values
 */
function stampDir(dir) {
  const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  let commit = '';
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch { /* not a git checkout (e.g. exported archive): version only */ }
  const file = path.resolve(dir, 'version.js');
  fs.writeFileSync(file, stampAppVersion(fs.readFileSync(file, 'utf8'), pkg.version, commit));
  return { version: pkg.version, commit };
}

/* node:coverage ignore next 4 -- CLI entry point, exercised by CI deploys */
if (require.main === module) {
  const { version, commit } = stampDir(process.argv[2] || '.');
  console.log(`${version} (${commit || 'no commit'})`);
}

module.exports = { stampAppVersion, stampDir };
