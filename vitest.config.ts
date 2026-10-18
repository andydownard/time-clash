import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts', 'server/tests/**/*.test.ts'],
    environment: 'node',
    // Makes every unit test silent. See tests/setup/silent.ts.
    setupFiles: ['tests/setup/silent.ts'],
    coverage: { provider: 'v8', include: ['src/**/*.ts'], exclude: ['src/main.ts'] },
  },
});
