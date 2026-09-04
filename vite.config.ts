import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Preview environments (e.g. *.e2b.app) must be allowed to load the dev server.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': r('./src/engine'),
      '@ai': r('./src/ai'),
      '@analysis': r('./src/analysis'),
      '@ui': r('./src/ui'),
      '@replay': r('./src/replay'),
      '@state': r('./src/state'),
      '@sim': r('./src/sim'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // Allow any proxied preview host.
    allowedHosts: true,
    hmr: { clientPort: 443 },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  test: {
    environment: 'node',
    environmentMatchGlobs: [['src/ui/**', 'jsdom']],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
} as never);
