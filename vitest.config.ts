import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Using node since miniflare requires setup
    setupFiles: ['./test/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['test/**', '**/*.d.ts', '**/*.config.ts'],
    },
    deps: {
      // We're mocking the Cloudflare Workers environment
      // rather than using actual implementations
      interopDefault: true,
    },
  },
});
