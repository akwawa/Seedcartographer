import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import test from 'node:test';
import assert from 'node:assert';
const { APP_VERSION } = require('../version.js');
const { stampAppVersion, stampDir } = require('../scripts/app-version.js');
import fs from 'node:fs';
import path from 'node:path';

test('the checked-in version.js is the dev placeholder', () => {
  assert.deepStrictEqual(APP_VERSION, { version: 'dev', commit: '' });
});

test('stampAppVersion rewrites the APP_VERSION line', () => {
  const src = "const APP_VERSION = { version: 'dev', commit: '' };\n";
  const out = stampAppVersion(src, '1.2.3', 'abc1234');
  assert.match(out, /version: '1\.2\.3', commit: 'abc1234'/);
  assert.throws(() => stampAppVersion('nothing here', '1.2.3', 'abc'));
});

test('stampDir stamps a copy of version.js from package.json', () => {
  // the tool refuses to write outside its working directory: stage under it
  const dir = fs.mkdtempSync(path.resolve(import.meta.dirname, '..', '.tmp-swv-'));
  fs.copyFileSync(path.resolve(import.meta.dirname, '../version.js'), path.join(dir, 'version.js'));
  const { version } = stampDir(dir);
  const pkg = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../package.json'), 'utf8'));
  assert.strictEqual(version, pkg.version);
  const stamped = fs.readFileSync(path.join(dir, 'version.js'), 'utf8');
  assert.ok(stamped.includes(`version: '${pkg.version}'`));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('gitShortCommit reads HEAD, loose refs, packed-refs and rejects junk', () => {
  const { gitShortCommit } = require('../scripts/app-version.js');
  const dir = fs.mkdtempSync(path.resolve(import.meta.dirname, '..', '.tmp-swv-'));
  const sha = 'a'.repeat(40);
  // detached HEAD: the sha is right in HEAD
  fs.writeFileSync(path.join(dir, 'HEAD'), sha + '\n');
  assert.strictEqual(gitShortCommit(dir), sha.slice(0, 7));
  // symbolic ref resolved through a loose ref file
  fs.writeFileSync(path.join(dir, 'HEAD'), 'ref: refs/heads/main\n');
  fs.mkdirSync(path.join(dir, 'refs', 'heads'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'refs', 'heads', 'main'), sha + '\n');
  assert.strictEqual(gitShortCommit(dir), sha.slice(0, 7));
  // packed-refs fallback
  fs.rmSync(path.join(dir, 'refs', 'heads', 'main'));
  fs.writeFileSync(path.join(dir, 'packed-refs'), `# pack-refs\n${sha} refs/heads/main\n`);
  assert.strictEqual(gitShortCommit(dir), sha.slice(0, 7));
  // unknown ref or malformed sha: empty, never a throw
  fs.writeFileSync(path.join(dir, 'HEAD'), 'ref: refs/heads/other\n');
  assert.strictEqual(gitShortCommit(dir), '');
  fs.writeFileSync(path.join(dir, 'HEAD'), 'not-a-sha\n');
  assert.strictEqual(gitShortCommit(dir), '');
  assert.strictEqual(gitShortCommit(path.join(dir, 'absent')), '');
  fs.rmSync(dir, { recursive: true, force: true });
});
