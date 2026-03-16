import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true, // Allows use of 'describe', 'it', 'expect' without importing
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'], // Path to your global test setup
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'], // Recommended to limit scope
      exclude: [
        'src/test/**',        // Excludes the entire test folder - contains testing utilities
        'src/**/*.test.ts',   // Ensures individual test files are skipped
        'src/**/index.ts',    // Exclude entry points
      ],
    },
  },
  resolve: {
    alias: {
      '#': path.resolve(__dirname, './src'),
    }
  }
});
