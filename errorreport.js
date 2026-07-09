// errorreport.js — turns a raw JS error into a small, PII-free payload safe
// to send as a custom Umami event (no seed, no coordinates, no user input).
// Pure formatting only; the window/worker listeners and the actual
// umami.track() call live in app.js (DOM glue, exercised by e2e).
'use strict';

const MAX_MESSAGE_LEN = 200;

/**
 * @param {*} message raw error message (any type, defensively stringified)
 * @returns {string} single-line message, truncated to a safe length
 */
function sanitizeErrorMessage(message) {
  const s = String(message == null ? '' : message).replace(/\s+/g, ' ').trim();
  return s.length > MAX_MESSAGE_LEN ? s.slice(0, MAX_MESSAGE_LEN) + '…' : s;
}

/**
 * @param {*} source full script URL/path (may be undefined)
 * @returns {string} basename only — never the full URL, so a share-link
 * hash or query string in the source can't leak into telemetry
 */
function sourceBasename(source) {
  const s = String(source == null ? '' : source).split('?')[0].split('#')[0];
  const parts = s.split('/');
  return parts[parts.length - 1] || '';
}

/**
 * @param {'error'|'promise'|'worker'} kind
 * @param {*} message
 * @param {*} [source]
 * @param {*} [line]
 * @returns {{kind: string, message: string, source: string, line: number}}
 */
function formatErrorEvent(kind, message, source, line) {
  return {
    kind,
    message: sanitizeErrorMessage(message),
    source: sourceBasename(source),
    line: Number.isInteger(line) ? line : 0
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sanitizeErrorMessage, sourceBasename, formatErrorEvent };
}
