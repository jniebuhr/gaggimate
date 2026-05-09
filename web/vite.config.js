import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

const isGhPages = process.env.GITHUB_PAGES === '1';

// https://vitejs.dev/config/
export default defineConfig({
  base: isGhPages ? '/gaggimate/' : '/',
  plugins: [preact(), tailwindcss()],

  server: {
    proxy: {
      '/api': {
        target: 'http://gaggimate.local/',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://gaggimate.local',
        ws: true,
      },
    },
    watch: {
      usePolling: true,
    },
  },
});
