import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 60000,  // OAuth flows need time
    hookTimeout: 60000,
    retry: 1,  // Retry flaky network tests once
    reporters: ['verbose'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,  // E2E tests run sequentially
      },
    },
    setupFiles: ['./setup.ts'],
  },
});
