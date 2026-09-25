import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

const mockEnabled = process.env.POS_MOCK_API === '1';
const mockPlugin = {
  name: 'local-pos-mock-api',
  apply: 'serve',
  async configureServer(server) {
    if (mockEnabled) {
      const { createPosMockMiddleware } = await import('./dev/pos-mock-api.mjs');
      server.middlewares.use(createPosMockMiddleware(process.env.POS_MOCK_ROLE));
    }
  },
};

export default defineConfig({
  output: 'static',
  integrations: [react()],
  server: {
    host: mockEnabled ? '127.0.0.1' : true,
    port: 3000
  },
  vite: {
    plugins: mockEnabled ? [mockPlugin] : [],
    css: {
      postcss: 'postcss.config.mjs',
    },
  },
});
