// theme.js — light/dark theme selection logic. Pure, shared between app.js
// (script tag) and the Node test suite (require).

// browser-chrome color per theme (meta theme-color)
export const THEME_COLORS = { dark: '#0c1016', light: '#eef1f5' };

// stored user choice wins; otherwise follow the system, defaulting to dark
// (the app's historical look) unless the system explicitly asks for light
/**
 * @param {string|null} stored persisted user choice, if any
 * @param {boolean|undefined} prefersLight prefers-color-scheme: light match
 * @returns {'dark'|'light'}
 */
export function resolveTheme(stored, prefersLight) {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersLight ? 'light' : 'dark';
}

/**
 * @param {string} theme current theme
 * @returns {'dark'|'light'} the other theme
 */
export function otherTheme(theme) {
  return theme === 'dark' ? 'light' : 'dark';
}
