// version.js — deployed-build stamp shown in the help dialog. The checked-in
// file keeps a fixed dev placeholder for local serving; each deployment
// (Pages, Docker) regenerates it from package.json and the git commit via
// scripts/app-version.js.
'use strict';

const APP_VERSION = { version: 'dev', commit: '' };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { APP_VERSION };
}
