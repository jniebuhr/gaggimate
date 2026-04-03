import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact(), tailwindcss()],

  server: {
    proxy: {
      '/api': {
        // target: 'http://gaggimate.local/',
        // changeOrigin: true,
        target: 'http://192.168.0.110',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: 'ws://192.168.0.110',
        ws: true,
      },
    },
    watch: {
      usePolling: true,
    },
  },
});
