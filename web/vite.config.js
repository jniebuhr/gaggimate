import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { lingui } from '@lingui/vite-plugin';
import { execSync } from 'node:child_process';

// Same version string as the firmware, so an app web bundle maps to a firmware build.
function bundleVersion() {
  if (process.env.BUNDLE_VERSION) return process.env.BUNDLE_VERSION;
  try {
    return execSync('git describe --tags --dirty --match "v*"', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    // The Lingui macro (t, Trans, msg, plural) compiles messages at build time; the plugin compiles .po catalogs on import.
    preact({ babel: { plugins: ['@lingui/babel-plugin-lingui-macro'] } }),
    lingui(),
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

  define: {
    'import.meta.env.BUNDLE_VERSION': JSON.stringify(mode === 'app' ? bundleVersion() : ''),
  },

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
