import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
  },
  test: {
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts'],
  },
});