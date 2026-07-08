'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { APP_VERSION } = require('../version.js');
const { stampAppVersion, stampDir } = require('../scripts/app-version.js');
const fs = require('node:fs');
const path = require('node:path');

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
  const dir = fs.mkdtempSync(path.resolve(__dirname, '..', '.tmp-swv-'));
  fs.copyFileSync(path.resolve(__dirname, '../version.js'), path.join(dir, 'version.js'));
  const { version } = stampDir(dir);
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
  assert.strictEqual(version, pkg.version);
  const stamped = fs.readFileSync(path.join(dir, 'version.js'), 'utf8');
  assert.ok(stamped.includes(`version: '${pkg.version}'`));
  fs.rmSync(dir, { recursive: true, force: true });
});
