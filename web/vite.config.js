import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact(), tailwindcss()],

  server: {
    proxy: {
      '/api': {
        target: 'http://4.4.4.1/',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://4.4.4.1',
        ws: true,
      },
    },
  },
});
