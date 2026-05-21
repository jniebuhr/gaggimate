import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const configuredHost = env.VITE_GAGGIMATE_HOST;
  const httpTarget = normalizeTarget(configuredHost, 'http');
  const wsTarget = normalizeTarget(configuredHost, 'ws');

  return {
    plugins: [preact(), tailwindcss()],

    server: {
      proxy: {
        '/api': {
          target: httpTarget,
          changeOrigin: true,
        },
        '/ws': {
          target: wsTarget,
          ws: true,
          changeOrigin: true,
        },
      },
      watch: {
        usePolling: true,
      },
    },
  };
});