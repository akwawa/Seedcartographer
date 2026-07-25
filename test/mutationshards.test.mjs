// The mutation CI workflow partitions the Stryker scope into matrix shards
// (each job runs `npx stryker run --mutate <list>`). These tests guarantee
// the shard lists form an exact partition of the `mutate` array declared in
// stryker.config.json: every module is covered by exactly one shard.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../.github/workflows/mutation.yml', import.meta.url), 'utf8');
const config = JSON.parse(await readFile(new URL('../stryker.config.json', import.meta.url), 'utf8'));

// Extract the `mutate:` values of the matrix include entries. The repo has
// no YAML parser in devDependencies, so a line-based extraction is used:
// each shard declares a single line `mutate: a.js,b.js,...`.
const shardLists = [...workflow.matchAll(/^\s*mutate:\s*(\S+)\s*$/gm)].map(m => m[1].split(','));

test('mutation workflow declares three shards', () => {
  assert.equal(shardLists.length, 3);
  for (const list of shardLists) assert.ok(list.length > 0);
});

test('shards partition the stryker mutate scope exactly', () => {
  const all = shardLists.flat();
  const duplicates = all.filter((file, i) => all.indexOf(file) !== i);
  assert.deepEqual(duplicates, [], 'modules listed in more than one shard');
  assert.deepEqual([...all].sort(), [...config.mutate].sort(),
    'shard union must equal the stryker.config.json mutate array');
});

test('shard entries look like module files at the repo root', () => {
  for (const file of shardLists.flat()) {
    assert.match(file, /^[a-z0-9]+\.js$/, `unexpected shard entry: ${file}`);
  }
});
