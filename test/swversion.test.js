'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseAssets, contentVersion, stampVersion, stampDir } = require('../scripts/sw-version.js');

const SW = "const VERSION = 'seedcartographer-dev';\nconst ASSETS = [\n  './',\n  './index.html',\n  './app.js'\n];\n";

test('parseAssets reads the precache list, dropping the bare root entry', () => {
  assert.deepStrictEqual(parseAssets(SW), ['index.html', 'app.js']);
  assert.throws(() => parseAssets('nothing here'), /ASSETS/);
});

test('contentVersion is deterministic and content-sensitive', () => {
  const files = [{ path: 'a', content: 'x' }, { path: 'b', content: 'y' }];
  const v = contentVersion(files);
  assert.match(v, /^seedcartographer-[0-9a-f]{16}$/);
  assert.strictEqual(contentVersion(files), v);
  assert.notStrictEqual(contentVersion([{ path: 'a', content: 'x' }, { path: 'b', content: 'z' }]), v);
  assert.notStrictEqual(contentVersion([{ path: 'a2', content: 'x' }, { path: 'b', content: 'y' }]), v);
});

test('stampVersion replaces the VERSION line and rejects sources without one', () => {
  const out = stampVersion(SW, 'seedcartographer-abc');
  assert.strictEqual(out.includes("const VERSION = 'seedcartographer-abc';"), true);
  assert.throws(() => stampVersion('no version', 'x'), /VERSION/);
});

// stampDir only accepts directories below the working directory, so the
// test fixtures live in a scratch dir inside the repository
test('stampDir rewrites sw.js in place from the on-disk assets', () => {
  const dir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-swv-'));
  fs.writeFileSync(path.join(dir, 'sw.js'), SW);
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html>');
  fs.writeFileSync(path.join(dir, 'app.js'), 'app v1');
  const v1 = stampDir(dir);
  assert.strictEqual(fs.readFileSync(path.join(dir, 'sw.js'), 'utf8').includes(`'${v1}'`), true);
  // changing an asset changes the stamped version
  fs.writeFileSync(path.join(dir, 'sw.js'), SW);
  fs.writeFileSync(path.join(dir, 'app.js'), 'app v2');
  assert.notStrictEqual(stampDir(dir), v1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('stampDir refuses asset paths escaping the target directory', () => {
  const dir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-swv-'));
  fs.writeFileSync(path.join(dir, 'sw.js'),
    "const VERSION = 'seedcartographer-dev';\nconst ASSETS = ['./../evil.js'];\n");
  assert.throws(() => stampDir(dir), /escapes/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('stampDir refuses directories outside the working directory', () => {
  assert.throws(() => stampDir('/'), /escapes/);
});
