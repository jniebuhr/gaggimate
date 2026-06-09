import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

function normalizeTarget(host, protocol) {
  const fallback = `${protocol}://gaggimate.local`;
  if (!host) return fallback;

  const trimmedHost = host.trim().replace(/\/$/, '');
  if (!trimmedHost) return fallback;

  if (/^https?:\/\//.test(trimmedHost) || /^wss?:\/\//.test(trimmedHost)) {
    return trimmedHost.replace(/^https?:\/\//, `${protocol}://`).replace(/^wss?:\/\//, `${protocol}://`);
  }

  return `${protocol}://${trimmedHost}`;
}

function logProxyUnavailable(scope) {
  return error => {
    const detail = error?.code || error?.message || 'unavailable';
    console.warn(`[gaggigo] ${scope} proxy unavailable: ${detail}`);
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const configuredHost = env.VITE_GAGGIMATE_HOST;
  const httpTarget = normalizeTarget(configuredHost, 'http');
  const wsTarget = normalizeTarget(configuredHost, 'ws');

  return {
    plugins: [
      basicSsl(),
      preact(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['gm.svg', 'gm.png', 'app.webmanifest'],
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
          navigateFallback: '/index.html',
          skipWaiting: true,
          clientsClaim: true,
        },
        manifest: false,
        devOptions: {
          enabled: true,
        },
      }),
    ],

    server: {
      proxy: {
        '/api': {
          target: httpTarget,
          changeOrigin: true,
          configure: proxy => {
            proxy.on('error', logProxyUnavailable('api'));
          },
        },
        '/ws': {
          target: wsTarget,
          ws: true,
          changeOrigin: true,
          configure: proxy => {
            proxy.on('error', logProxyUnavailable('websocket'));
          },
        },
      },
      watch: {
        usePolling: true,
      },
    },
  };
});
