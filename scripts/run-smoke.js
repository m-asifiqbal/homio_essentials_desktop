// Bundles scripts/smoke-core.ts with esbuild and runs it (read-only checks against the live server).
const path = require('path');
const esbuild = require('esbuild');
const out = path.join(__dirname, '..', 'node_modules', '.cache', 'smoke-core.js');   // never inside dist-electron (that folder ships)
esbuild.buildSync({ entryPoints: [path.join(__dirname, 'smoke-core.ts')], outfile: out, bundle: true, platform: 'node', format: 'cjs', target: 'node20', logLevel: 'warning' });
require(out);
