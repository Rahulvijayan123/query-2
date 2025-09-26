import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/api/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    exclude: ['node_modules', 'tests/e2e/**'],
    globals: true,
    reporters: ['default','json'],
    outputFile: { json: 'vitest-report.json' },
    hookTimeout: 30000,
    testTimeout: 30000,
    allowOnly: false,
    environment: 'node',
    setupFiles: ['./tests/setupTests.ts'],
  },
  coverage: {
    enabled: true,
    provider: 'v8',
    reporter: ['text','lcov'],
    reportsDirectory: './coverage',
    all: true,
    include: ['app/api/**', 'lib/**', 'server/**'],
    lines: 60, functions: 60, branches: 50, statements: 60,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@/': path.resolve(__dirname, '.'),
    },
  },
});


