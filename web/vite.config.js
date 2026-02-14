import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact(), tailwindcss()],

  server: {
    proxy: {
      '/api': {
        target: 'http://gm-e24.local/',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://gm-e24.local',
        ws: true,
      },
    },
    watch: {
      usePolling: true,
    },
  },
});
