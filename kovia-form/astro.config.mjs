import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';

const apiTarget = process.env.PUBLIC_API_URL || 'http://localhost:3000';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  server: {
    port: 4321,
    host: '0.0.0.0',
  },
  vite: {
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  },
});
