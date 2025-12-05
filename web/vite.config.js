import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact(), tailwindcss()],

  server: {
    proxy: {
      '/api': {
        target: 'http://192.168.3.183/',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://192.168.3.183',
        ws: true,
      },
    },
    watch: {
      usePolling: true,
    },
  },
});
