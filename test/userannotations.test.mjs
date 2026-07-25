import { test } from 'node:test';
import assert from 'node:assert';
import {
  ANNOTATION_MAX, ANNOTATION_TEXT_MAX, ANNOTATION_COORD_LIMIT,
  addAnnotation, removeAnnotation, editAnnotation, annotationsFor,
  parseAnnotations, mergeAnnotations
} from '../userannotations.js';

const W = { seed: '141', mc: 30, large: false, dim: 0 };
const at = (x, z, text) => ({ ...W, x, z, text });

test('addAnnotation appends with fresh ids and a default text', () => {
  let list = addAnnotation([], at(10, 20));
  assert.deepStrictEqual(list[0], { id: 1, ...W, x: 10, z: 20, text: '#1' });
  list = addAnnotation(list, at(30, 40, '  Entrée de la mine  '));
  assert.strictEqual(list[1].text, 'Entrée de la mine');
  assert.strictEqual(list[1].id, 2);
});

test('text is capped at ANNOTATION_TEXT_MAX and coordinates are clamped', () => {
  const list = addAnnotation([], at(1e9, -1e9, 'x'.repeat(200)));
  assert.strictEqual(list[0].text.length, ANNOTATION_TEXT_MAX);
  assert.strictEqual(list[0].x, ANNOTATION_COORD_LIMIT);
  assert.strictEqual(list[0].z, -ANNOTATION_COORD_LIMIT);
  // fractional coordinates round to blocks
  assert.strictEqual(addAnnotation([], at(1.6, 2.4, 'a'))[0].x, 2);
});

test('duplicates (same world and spot) and overflow are refused', () => {
  const list = addAnnotation([], at(10, 20));
  assert.strictEqual(addAnnotation(list, at(10, 20, 'again')), list);
  // a different world at the same spot is fine
  assert.strictEqual(addAnnotation(list, { ...at(10, 20), dim: -1 }).length, 2);
  assert.strictEqual(addAnnotation(list, { ...at(10, 20), mc: 29 }).length, 2);
  assert.strictEqual(addAnnotation(list, { ...at(10, 20), large: true }).length, 2);
  assert.strictEqual(addAnnotation(list, { ...at(10, 20), seed: '7' }).length, 2);
  let full = [];
  for (let i = 0; i < ANNOTATION_MAX; i++) full = addAnnotation(full, at(i, 0));
  assert.strictEqual(addAnnotation(full, at(9999, 9999)), full);
});

test('edit trims, caps and refuses empty texts; remove drops by id', () => {
  let list = addAnnotation([], at(1, 2, 'A'));
  list = addAnnotation(list, at(3, 4, 'B'));
  list = editAnnotation(list, 1, '  C  ');
  assert.strictEqual(list[0].text, 'C');
  assert.strictEqual(list[1].text, 'B');       // other entries untouched
  assert.strictEqual(editAnnotation(list, 1, '   ')[0].text, 'C');
  assert.strictEqual(editAnnotation(list, 1, null)[0].text, 'C');
  assert.strictEqual(editAnnotation(list, 1, 'y'.repeat(99))[0].text.length, ANNOTATION_TEXT_MAX);
  assert.deepStrictEqual(removeAnnotation(list, 1).map((a) => a.id), [2]);
});

test('annotationsFor filters on the exact world', () => {
  let list = addAnnotation([], at(1, 2));
  list = addAnnotation(list, { ...at(3, 4), mc: 29 });
  list = addAnnotation(list, { ...at(3, 4), seed: '7' });
  list = addAnnotation(list, { ...at(3, 4), large: true });
  const shown = annotationsFor(list, W);
  assert.strictEqual(shown.length, 1);
  assert.deepStrictEqual(shown[0], { ann: list[0], x: 1, z: 2, converted: false });
});

test('annotationsFor converts the linked dimension 1:8, never the End', () => {
  let list = addAnnotation([], at(800, -1600, 'ow'));
  list = addAnnotation(list, { ...at(10, 20, 'nether'), dim: -1 });
  list = addAnnotation(list, { ...at(5, 6, 'end'), dim: 1 });
  const inNether = annotationsFor(list, { ...W, dim: -1 });
  assert.deepStrictEqual(inNether.map((d) => [d.x, d.z, d.converted]),
    [[100, -200, true], [10, 20, false]]);
  const inOverworld = annotationsFor(list, W);
  assert.deepStrictEqual(inOverworld.map((d) => [d.x, d.z, d.converted]),
    [[800, -1600, false], [80, 160, true]]);
  // the End neither converts out nor receives converted points
  assert.deepStrictEqual(annotationsFor(list, { ...W, dim: 1 }).map((d) => d.ann.text), ['end']);
});

test('parseAnnotations keeps only well-formed entries', () => {
  const good = { id: 3, ...W, x: 5, z: 6, text: 'ok' };
  const raw = JSON.stringify([good, { id: 3, ...W, x: 9, z: 9, text: 'dup id' },
    { id: 4, ...W, x: 1, z: 1, text: '' }, { id: 5, ...W, x: 'NaN', z: 0, text: 'bad x' },
    { id: 5.5, ...W, x: 0, z: 0, text: 'bad id' }, { id: -1, ...W, x: 0, z: 0, text: 'neg id' },
    { id: 6, ...W, z: 'NaN', x: 0, text: 'bad z' },
    { id: 7, ...W, mc: 1.5, x: 0, z: 0, text: 'bad mc' },
    { id: 8, ...W, dim: 7, x: 0, z: 0, text: 'bad dim' },
    { id: 9, ...W, seed: null, x: 0, z: 0, text: 'bad seed' },
    { id: 10, ...W, x: 0, z: 0 }, null, 'junk']);
  assert.deepStrictEqual(parseAnnotations(raw), [good]);
  assert.deepStrictEqual(parseAnnotations('not json'), []);
  assert.deepStrictEqual(parseAnnotations('{"a":1}'), []);
  assert.deepStrictEqual(parseAnnotations(null), []);
});

test('parseAnnotations accepts numeric seeds, clamps and caps the list', () => {
  const parsed = parseAnnotations(JSON.stringify([
    { id: 1, seed: 141, mc: 30, dim: 0, x: 1e9, z: 0.6, text: 'n' }
  ]));
  assert.deepStrictEqual(parsed, [{ id: 1, seed: '141', mc: 30, large: false, dim: 0,
    x: ANNOTATION_COORD_LIMIT, z: 1, text: 'n' }]);
  const many = Array.from({ length: ANNOTATION_MAX + 20 },
    (_, i) => ({ id: i + 1, ...W, x: i, z: 0, text: 't' }));
  assert.strictEqual(parseAnnotations(JSON.stringify(many)).length, ANNOTATION_MAX);
});

test('mergeAnnotations appends with fresh ids, skipping duplicates', () => {
  const mine = addAnnotation([], at(1, 2, 'mine'));
  const imported = [
    { id: 1, ...W, x: 1, z: 2, text: 'dup spot' },
    { id: 9, ...W, x: 3, z: 4, text: 'new' }
  ];
  const merged = mergeAnnotations(mine, imported);
  assert.deepStrictEqual(merged.map((a) => [a.id, a.text]), [[1, 'mine'], [2, 'new']]);
  assert.strictEqual(mine.length, 1);   // input untouched
});
