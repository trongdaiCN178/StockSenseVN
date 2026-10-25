import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/core/**/*.test.js',
      'apps/api/**/*.test.js',
      'apps/worker/**/*.test.js',
    ],
    exclude: ['**/node_modules/**'],
  },
});
