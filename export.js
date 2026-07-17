// export.js — pure serializers for search results (CSV / JSON downloads).
// Shared between app.js (script tag) and the Node test suite (require).

// Quote a CSV field when it contains a separator, quote or newline.
/**
 * @param {string|number} v raw field value
 * @returns {string} CSV-safe field
 */
export function csvField(v) {
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}

// hits: [{x, z, count}] -> CSV with one row per location. seed/version are
// repeated on each row so a file stays self-contained when merged with others.
/**
 * @typedef {{x: number, z: number, count: number}} Hit
 * @typedef {{seed: string|number, mcLabel: string, large?: boolean,
 *            dimension?: string, criteria?: object}} ExportMeta
 */
/**
 * @param {Hit[]} hits found locations
 * @param {ExportMeta} meta world description repeated on each row
 * @returns {string} CSV text
 */
export function resultsToCSV(hits, meta) {
  const head = 'x,z,nearby_structures,seed,mc_version';
  const rows = hits.map((h) => [h.x, h.z, h.count, meta.seed, meta.mcLabel].map(csvField).join(','));
  return [head, ...rows].join('\n') + '\n';
}

// Full export: world, criteria and hits, pretty-printed.
/**
 * @param {Hit[]} hits found locations
 * @param {ExportMeta} meta world and criteria description
 * @returns {string} pretty-printed JSON text
 */
export function resultsToJSON(hits, meta) {
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
/**
 * @param {{seed: string|number, mcLabel: string, large: boolean,
 *          dimension: string, cx: number, cz: number}} meta view description
 * @returns {string[]} cartouche lines
 */
export function mapCartoucheLines(meta) {
  return [
    `Seed: ${meta.seed}`,
    `Java ${meta.mcLabel}${meta.large ? ' (Large Biomes)' : ''} — ${meta.dimension}`,
    `Center: ${meta.cx}, ${meta.cz}`
  ];
}

// ---- high-resolution map export (#231) ----
// The HD export re-renders the current view at a fixed output width in the
// worker, band by band. These helpers are pure so the geometry is shared
// between app.js (canvas assembly) and worker.js (band rendering) and unit
// tested without a DOM or a WASM engine.

// Memory guard: cap on output pixels (RGBA ≈ 4 bytes each). 32M pixels keep
// the composed canvas around 128 MB, safely below browser canvas limits.
export const EXPORT_MAX_PIXELS = 32 * 1024 * 1024;

// smallest cubiomes sampling scale that keeps the cell grid <= output pixels
/**
 * @param {number} bpp blocks per output pixel
 * @returns {number} cubiomes scale (4, 16, 64 or 256)
 */
export function hdExportScale(bpp) {
  for (const s of [4, 16, 64]) if (s >= bpp) return s;
  return 256;
}

// Geometry of an HD export of the current view at `outW` pixels wide: output
// size (same aspect as the viewport), blocks-per-pixel, world NW corner and
// sampling scale — or null when the output would blow the pixel budget.
/**
 * @param {{cx: number, cz: number, bpp: number}} view current map view
 * @param {number} viewW viewport width in CSS pixels
 * @param {number} viewH viewport height in CSS pixels
 * @param {number} outW requested output width in pixels
 * @param {number} [maxPixels] memory guard, in output pixels
 * @returns {{outW: number, outH: number, bppOut: number, wx0: number,
 *            wz0: number, scale: number}|null}
 */
export function hdExportGeometry(view, viewW, viewH, outW, maxPixels = EXPORT_MAX_PIXELS) {
  const outH = Math.max(1, Math.round(outW * viewH / viewW));
  if (outW * outH > maxPixels) return null;
  const bppOut = (viewW * view.bpp) / outW;
  return {
    outW, outH, bppOut,
    wx0: view.cx - (outW * bppOut) / 2,
    wz0: view.cz - (outH * bppOut) / 2,
    scale: hdExportScale(bppOut)
  };
}

// Cell-grid span covering `extent` output pixels starting at world coord
// `w0` (pixels sample at their center, hence the half-pixel end offset).
/**
 * @param {number} w0 world coordinate of the first pixel's edge
 * @param {number} extent number of output pixels
 * @param {number} bppOut blocks per output pixel
 * @param {number} scale cubiomes sampling scale
 * @returns {{c0: number, count: number}} first cell index and cell count
 */
export function hdCellSpan(w0, extent, bppOut, scale) {
  const c0 = Math.floor(w0 / scale);
  const c1 = Math.floor((w0 + (extent - 0.5) * bppOut) / scale);
  return { c0, count: c1 - c0 + 1 };
}

// cell row/column of one output pixel (sampled at the pixel center)
/**
 * @param {number} p output pixel index (row or column)
 * @param {number} w0 world coordinate of the first pixel's edge
 * @param {number} bppOut blocks per output pixel
 * @param {number} scale cubiomes sampling scale
 * @returns {number} absolute cell index
 */
export function hdCellIndex(p, w0, bppOut, scale) {
  return Math.floor((w0 + (p + 0.5) * bppOut) / scale);
}

// Cartouche band metrics scaled to the export width so the text stays
// readable on a poster-sized PNG (1024 px wide ≈ the on-screen sizing).
/**
 * @param {number} width export width in pixels
 * @returns {{band: number, font: number, padX: number,
 *            baseline: number, lineStep: number}}
 */
export function cartoucheMetrics(width) {
  const s = Math.max(1, width / 1024);
  return {
    band: Math.round(64 * s),
    font: Math.round(12 * s),
    padX: Math.round(10 * s),
    baseline: Math.round(18 * s),
    lineStep: Math.round(17 * s)
  };
}

// download name for an export of `kind` ('map', 'csv'…): seed sanitized to
// filesystem-safe characters
/**
 * @param {string|number|bigint} seed world seed (sanitized)
 * @param {string} kind export kind ('map', 'results'…)
 * @param {string} ext file extension without the dot
 * @returns {string}
 */
export function exportFileName(seed, kind, ext) {
  return `seedcartographer-${String(seed).replace(/[^\w-]+/g, '_')}-${kind}.${ext}`;
}

// split one CSV line into cells, honouring quoted fields ("" = escaped quote)
/**
 * @param {string} line one CSV line
 * @returns {string[]} cells
 */
export function splitCSVLine(line) {
  const out = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch !== '"') { cur += ch; }
      else if (line[i + 1] === '"') { cur += '"'; i++; }
      else { quoted = false; }
    } else if (ch === '"') { quoted = true; }
    else if (ch === ',') { out.push(cur); cur = ''; }
    else { cur += ch; }
  }
  out.push(cur);
  return out;
}

// Parse a locations CSV back into pins — the mirror of resultsToCSV, but
// lenient: only the two leading x,z columns are required, a header line is
// ignored, malformed rows are counted in `skipped`, output capped at `max`.
/**
 * @param {string} text CSV file content
 * @param {number} [max] cap on returned locations
 * @returns {{hits: Hit[], skipped: number}}
 */
export function parseLocationsCSV(text, max = 1500) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim() !== '');
  /** @type {Hit[]} */
  const hits = [];
  let skipped = 0;
  lines.forEach((line, idx) => {
    if (hits.length >= max) return;
    const cells = splitCSVLine(line);
    // Number('') is 0, so blank cells must be rejected explicitly
    const int = (/** @type {string|undefined} */ v) => {
      const s = String(v ?? '').trim();
      return s !== '' && Number.isInteger(Number(s)) ? Number(s) : null;
    };
    const x = int(cells[0]), z = int(cells[1]);
    if (x === null || z === null) {
      if (idx > 0) skipped++;   // a non-numeric first line is just the header
      return;
    }
    const count = int(cells[2]) ?? 0;
    hits.push({ x, z, count });
  });
  return { hits, skipped };
}
