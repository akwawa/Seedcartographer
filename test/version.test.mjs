import test from 'node:test';
import assert from 'node:assert';
import { APP_VERSION } from '../version.js';
import fs from 'node:fs';
import path from 'node:path';
import { stampAppVersion, stampDir } from '../scripts/app-version.js';
import { gitShortCommit, resolveCommit } from '../scripts/app-version.js';

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

test('resolveCommit falls back to a validated GIT_COMMIT-style value', () => {
  const dir = fs.mkdtempSync(path.resolve(import.meta.dirname, '..', '.tmp-swv-'));
  const sha = 'b'.repeat(40);
  // a real checkout wins over the environment fallback
  fs.writeFileSync(path.join(dir, 'HEAD'), sha + '\n');
  assert.strictEqual(resolveCommit(dir, 'c'.repeat(40)), sha.slice(0, 7));
  // no checkout: the env value is used, but only if it looks like a sha
  const absent = path.join(dir, 'absent');
  assert.strictEqual(resolveCommit(absent, 'c'.repeat(40)), 'c'.repeat(7));
  assert.strictEqual(resolveCommit(absent, 'abc1234'), 'abc1234');
  assert.strictEqual(resolveCommit(absent, 'not a sha'), '');
  assert.strictEqual(resolveCommit(absent, ''), '');
  assert.strictEqual(resolveCommit(absent, undefined), '');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('gitShortCommit reads HEAD, loose refs, packed-refs and rejects junk', () => {
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
