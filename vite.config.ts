import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Browser preview only (npm run dev without Electron): the public Supabase URL + anon key from config/supabase.json
// so the sign-in screen can talk to the server. Inside Electron every request goes through the main process instead.
let sb: { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string } = {};
try { sb = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'config/supabase.json'), 'utf8')); } catch { /* no config: preview shows demo data only */ }

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  define: {
    __SB_URL__: JSON.stringify(sb.SUPABASE_URL || ''),
    __SB_KEY__: JSON.stringify(sb.SUPABASE_ANON_KEY || ''),
  },
  build: {
    target: 'chrome120', // Electron's Chromium: no legacy transpilation, smaller bundles
    cssCodeSplit: true,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'vendor-react';
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
