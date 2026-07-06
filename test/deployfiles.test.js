'use strict';
// Regression guard for #79: every runtime asset precached by sw.js must also
// be shipped by the Pages workflow and the Docker image — the three lists
// drifted apart once already, breaking the deployed app with script 404s.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// the ASSETS array in sw.js is the canonical runtime file set
function swAssets() {
  const m = read('sw.js').match(/const ASSETS = \[([^\]]*)\]/);
  assert.notStrictEqual(m, null, 'ASSETS array not found in sw.js');
  return [...m[1].matchAll(/'\.\/([^']+)'/g)].map(([, p]) => p).filter((p) => p !== '');
}

for (const [name, file] of [['Pages workflow', '.github/workflows/pages.yml'], ['Dockerfile', 'Dockerfile']]) {
  test(`the ${name} ships every asset precached by sw.js`, () => {
    const text = read(file);
    for (const asset of swAssets()) {
      const token = asset.startsWith('fonts/') ? 'fonts' : asset;
      assert.strictEqual(text.includes(token), true, `${file} misses ${asset}`);
    }
  });
}

test('every sw.js asset exists in the repository', () => {
  for (const asset of swAssets()) {
    assert.strictEqual(fs.existsSync(path.join(root, asset)), true, `missing file ${asset}`);
  }
});
