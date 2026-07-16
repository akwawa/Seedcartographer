#!/usr/bin/env node
// scripts/app-version.js — stamp version.js with the release version
// (package.json, managed by release-please) and the short git commit, so
// the help dialog shows exactly what is deployed.
//
//   node scripts/app-version.js <site-dir>
//
// The checked-in version.js keeps a fixed dev placeholder for local serving.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// The tool only ever works below the invoking process's working directory
// (the CI workspace / staging dir): the CLI argument is canonicalized and
// validated against that untainted base before any filesystem access.
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

// Short commit of a git checkout, read straight from the metadata files —
// no subprocess, so nothing is looked up through PATH. Returns '' outside a
// git checkout (e.g. an exported archive).
/**
 * @param {string} gitDir the .git directory
 * @returns {string} 7-char commit hash, or ''
 */
export function gitShortCommit(gitDir) {
  try {
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    const sha = head.startsWith('ref: ') ? refSha(gitDir, head.slice(5)) : head;
    return /^[0-9a-f]{40}$/.test(sha) ? sha.slice(0, 7) : '';
  } catch { return ''; }
}
/**
 * @param {string} gitDir the .git directory
 * @param {string} ref symbolic ref (e.g. refs/heads/main)
 * @returns {string} the ref's sha, from the loose ref file or packed-refs
 */
function refSha(gitDir, ref) {
  const loose = path.join(gitDir, ref);
  if (fs.existsSync(loose)) return fs.readFileSync(loose, 'utf8').trim();
  const packed = fs.readFileSync(path.join(gitDir, 'packed-refs'), 'utf8');
  const line = packed.split('\n').find((l) => l.endsWith(' ' + ref));
  return line ? line.split(' ')[0] : '';
}

// rewrite the APP_VERSION line of a version.js source
/**
 * @param {string} source version.js source text
 * @param {string} version release version
 * @param {string} commit short commit hash
 * @returns {string} rewritten source
 */
export function stampAppVersion(source, version, commit) {
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
export function stampDir(dir) {
  const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  const commit = gitShortCommit(path.resolve('.git'));
  const root = insideCwd(fs.realpathSync(path.resolve(dir)));
  const file = insideCwd(path.resolve(root, 'version.js'));
  fs.writeFileSync(file, stampAppVersion(fs.readFileSync(file, 'utf8'), pkg.version, commit));
  return { version: pkg.version, commit };
}

/* node:coverage ignore next 4 -- CLI entry point, exercised by CI deploys */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { version, commit } = stampDir(process.argv[2] || '.');
  console.log(`${version} (${commit || 'no commit'})`);
}
