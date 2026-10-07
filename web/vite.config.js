import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    preact(),
    tailwindcss(),
    // The native app draws edge-to-edge (layout pads with env(safe-area-inset-*)) and, like a native app, never zooms.
    mode === 'app' && {
      name: 'app-viewport',
      transformIndexHtml: html =>
        html.replace(
          'width=device-width, initial-scale=1.0',
          'width=device-width, initial-scale=1.0, maximum-scale=1, user-scalable=no, viewport-fit=cover',
        ),
    },
  ],

  build: {
    // App builds go to their own dir so the firmware build's in-place gzip never leaks into the native bundle.
    outDir: mode === 'app' ? 'dist-app' : 'dist',
    // SPIFFS on the firmware caps path length at 32 chars and silently drops
    // files whose path exceeds it. Default Vite chunk names like
    // `assets/chartjs-plugin-annotation.esm-_AL1m4_O.js.gz` blow past that and
    // never make it to the device, leaving the served index.html referencing
    // nonexistent JS files. Emit hash-only filenames so every asset path stays
    // well under the limit.
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[hash].js',
        chunkFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash][extname]',
      },
    },
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
    watch: {
      usePolling: true,
    },
  },
}));
