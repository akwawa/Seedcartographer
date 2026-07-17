// keys.js — global keyboard shortcuts (#230): pure, testable mapping from a
// simplified keydown context to an action name. The DOM glue (reading the
// event target, running the action) lives in app.js — same split as tour.js.

/**
 * @typedef {Object} KeyContext
 * @property {string} key         KeyboardEvent.key
 * @property {boolean} mod        a Ctrl/Meta/Alt modifier is held (browser
 *                                shortcuts like Ctrl+R must stay untouched)
 * @property {boolean} inInput    focus is in an input, textarea or select
 * @property {boolean} inSearchField focus is in a field of the criteria
 *                                panel (input/select, not textarea)
 * @property {boolean} tourOpen   the guided tour (#229) is running
 * @property {boolean} dialogOpen a modal dialog (help, gallery) is open
 */

/**
 * Map a keydown to a shortcut action, or null when the key must keep its
 * default behavior. Rules, in priority order:
 * - a held modifier disables everything (never shadow browser shortcuts);
 * - while the tour runs, Escape skips it and every other shortcut is off;
 * - Escape always closes the active dialog/tool/popup;
 * - Enter submits the search, but only from a criteria-panel field;
 * - the single-letter shortcuts are off while typing in any field or while
 *   a modal dialog is open.
 * @param {KeyContext} ctx
 * @returns {string|null} action name, or null when nothing should happen
 */
export function keyAction(ctx) {
  if (ctx.mod) return null;
  if (ctx.tourOpen) return ctx.key === 'Escape' ? 'skip-tour' : null;
  if (ctx.key === 'Escape') return 'close';
  if (ctx.key === 'Enter') return ctx.inSearchField && !ctx.dialogOpen ? 'search' : null;
  if (ctx.inInput || ctx.dialogOpen) return null;
  if (ctx.key === '+' || ctx.key === '=') return 'zoom-in';
  if (ctx.key === '-' || ctx.key === '_') return 'zoom-out';
  if (ctx.key === 'g' || ctx.key === 'G') return 'goto';
  if (ctx.key === 'r' || ctx.key === 'R') return 'ruler';
  if (ctx.key === '?') return 'help';
  return null;
}
