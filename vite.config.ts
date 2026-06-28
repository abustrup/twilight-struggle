/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const base = process.env.DEPLOY_TARGET === 'github-pages' ? '/twilight-struggle/' : '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    // Honor a PORT assigned by the environment (e.g. preview harness),
    // otherwise fall back to Vite's default 5173.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  resolve: {
    alias: {
      '@engine': '/src/engine',
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
