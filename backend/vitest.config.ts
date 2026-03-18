import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Allows use of 'describe', 'it', 'expect' without importing
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'], // Path to your global test setup
    include: ['**/*.test.ts'],
    coverage: {
      enabled: true,
      reportOnFailure: true,
      provider: 'v8', // or 'istanbul'
      reporter: ['text','lcov', 'json', 'html'],
      include: ['src/**/*.ts'], // Recommended to limit scope
      exclude: [
        'src/test/**',        // Excludes the entire test folder - contains testing utilities
        'src/**/*.test.ts',   // Ensures individual test files are skipped
        'src/**/index.ts',    // Exclude entry points
      ],
    },
  },
});
