import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    // Every test is CPU-bound and takes tens of milliseconds alone, but a full run beside builds
    // and other agents (load far above the core count) stretches single tests past the 5 s default.
    // Which test trips changes each run, so the limit is global. A real hang still fails at 30 s.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Makes every unit test silent. See tests/setup/silent.ts.
    setupFiles: ['tests/setup/silent.ts'],
    coverage: { provider: 'v8', include: ['src/**/*.ts'], exclude: ['src/main.ts'] },
  },
});
