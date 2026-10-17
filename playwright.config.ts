import { defineConfig, devices } from '@playwright/test';

// The e2e build uses vite's "e2e" mode (not "production"), because the ?e2e=1 test hook is
// switched off in production builds. It goes to node_modules/.e2e-dist (ignored by git and eslint), never to dist/.
const PORT = 4173;

const sizes = [
  { name: '1280x800', viewport: { width: 1280, height: 800 } },
  { name: '1024x768', viewport: { width: 1024, height: 768 } },
];
const portrait = { name: '768x1024', viewport: { width: 768, height: 1024 } };

// Chromium also runs muted. The page-level stubs in e2e/support/silent.ts cover WebKit.
const quiet = { launchOptions: { args: ['--mute-audio'] } };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Phaser and four browsers at once starve each other. Fewer workers keeps timing honest.
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    ...sizes.flatMap(({ name, viewport }) => [
      {
        name: `chromium-${name}`,
        testIgnore: /portrait\.spec\.ts/,
        use: { ...devices['Desktop Chrome'], viewport, ...quiet },
      },
      {
        name: `webkit-${name}`,
        testIgnore: /portrait\.spec\.ts/,
        use: { ...devices['Desktop Safari'], viewport },
      },
    ]),
    {
      name: `chromium-${portrait.name}`,
      testMatch: /(portrait|look)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: portrait.viewport, ...quiet },
    },
    {
      name: `webkit-${portrait.name}`,
      testMatch: /(portrait|look)\.spec\.ts/,
      use: { ...devices['Desktop Safari'], viewport: portrait.viewport },
    },
  ],
  webServer: {
    command:
      'npx vite build --mode e2e --outDir node_modules/.e2e-dist --emptyOutDir && echo e2e > node_modules/.e2e-dist/version.txt && ' +
      `npx vite preview --mode e2e --outDir node_modules/.e2e-dist --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI && process.env.E2E_REUSE_SERVER === '1',
    timeout: 180_000,
  },
});
