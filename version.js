// version.js — deployed-build stamp shown in the help dialog. The checked-in
// file keeps a fixed dev placeholder for local serving; each deployment
// (Pages, Docker) regenerates it from package.json and the git commit via
// scripts/app-version.js.

export const APP_VERSION = { version: 'dev', commit: '' };
