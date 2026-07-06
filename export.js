// export.js — pure serializers for search results (CSV / JSON downloads).
// Shared between app.js (script tag) and the Node test suite (require).
'use strict';

// Quote a CSV field when it contains a separator, quote or newline.
function csvField(v) {
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}

// hits: [{x, z, count}] -> CSV with one row per location. seed/version are
// repeated on each row so a file stays self-contained when merged with others.
function resultsToCSV(hits, meta) {
  const head = 'x,z,nearby_structures,seed,mc_version';
  const rows = hits.map((h) => [h.x, h.z, h.count, meta.seed, meta.mcLabel].map(csvField).join(','));
  return [head, ...rows].join('\n') + '\n';
}

// Full export: world, criteria and hits, pretty-printed.
function resultsToJSON(hits, meta) {
  return JSON.stringify({
    seed: meta.seed,
    mcVersion: meta.mcLabel,
    dimension: meta.dimension || 'Overworld',
    largeBiomes: !!meta.large,
    criteria: meta.criteria,
    results: hits.map((h) => ({ x: h.x, z: h.z, nearbyStructures: h.count }))
  }, null, 2) + '\n';
}

// Cartouche lines stamped under a PNG map export. Language-independent
// technical labels so the file stays self-describing wherever it travels.
function mapCartoucheLines(meta) {
  return [
    `Seed: ${meta.seed}`,
    `Java ${meta.mcLabel}${meta.large ? ' (Large Biomes)' : ''} — ${meta.dimension}`,
    `Center: ${meta.cx}, ${meta.cz}`
  ];
}

// download name for an export of `kind` ('map', 'csv'…): seed sanitized to
// filesystem-safe characters
function exportFileName(seed, kind, ext) {
  return `seedcartographer-${String(seed).replace(/[^\w-]+/g, '_')}-${kind}.${ext}`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { resultsToCSV, resultsToJSON, csvField, mapCartoucheLines, exportFileName };
}
