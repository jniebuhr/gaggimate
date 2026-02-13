import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact(), tailwindcss()],

  server: {
    proxy: {
      '/api': {
        target: 'http://gemilai.local/',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://gemilai.local',
        ws: true,
      },
    },
    watch: {
      usePolling: true,
    },
  },
});
