import { defineConfig } from 'vitest/config'

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
    },
  },
});
