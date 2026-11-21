/**
 * Bundles the Electron main process into single files in dist-electron/, so the packaged app ships no node_modules.
 * Type checking is done separately by `tsc -p tsconfig.electron.json --noEmit`.
 *
 * The Supabase URL and the public anon key come from config/supabase.json (git-ignored; written by
 * `node --env-file=.env scripts/app-env.mjs` in the backend folder) and are compiled into the main-process bundle.
 * The anon key is public by design: row-level security and the staff roles decide what a signed-in account may do.
 */
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');

const define = {};
try {
  const sb = JSON.parse(fs.readFileSync(path.join(root, 'config', 'supabase.json'), 'utf8'));
  if (sb.SUPABASE_URL && sb.SUPABASE_ANON_KEY) {
    define['process.env.HM_SUPABASE_URL_BUILT'] = JSON.stringify(sb.SUPABASE_URL);
    define['process.env.HM_SUPABASE_KEY_BUILT'] = JSON.stringify(sb.SUPABASE_ANON_KEY);
    console.log('Supabase project found in config/supabase.json');
  }
} catch {
  console.warn('config/supabase.json not found: the app will ask for the server address on the sign-in screen');
}

esbuild.buildSync({
  absWorkingDir: root,
  entryPoints: ['electron/main.ts', 'electron/preload.ts'],
  outdir: 'dist-electron',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
  legalComments: 'none',
  define,
  logLevel: 'warning',
});
console.log('electron bundle ready');
