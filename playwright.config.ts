import { defineConfig, devices } from '@playwright/test';

// The e2e build uses vite's "e2e" mode (not "production"), because the ?e2e=1 test hook is
// switched off in production builds. It goes to node_modules/.e2e-dist (ignored by git and eslint), never to dist/.
// The pages are served by the real production app server (app-server/), so e2e also checks the
// security headers and the same-origin clip route that production sends.
const PORT = Number(process.env.E2E_PORT ?? 4173);

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
  // One worker per core. The GitHub runner for this public repo has 4 cores, like a laptop run.
  // Tests wait on conditions, not the clock, so a busy machine is slower but not flaky.
  workers: 4,
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
        testIgnore: /(portrait|turn-screen)\.spec\.ts/,
        use: { ...devices['Desktop Chrome'], viewport, ...quiet },
      },
      {
        name: `webkit-${name}`,
        testIgnore: /(portrait|turn-screen)\.spec\.ts/,
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
    // Touch tablet checks set their own viewport and touch input.
    {
      name: 'chromium-turn-screen',
      testMatch: /turn-screen\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], ...quiet },
    },
    {
      name: 'webkit-turn-screen',
      testMatch: /turn-screen\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command:
      'npx vite build --mode e2e --outDir node_modules/.e2e-dist --emptyOutDir && echo e2e > node_modules/.e2e-dist/version.txt && ' +
      `PORT=${PORT} DIST_DIR=node_modules/.e2e-dist npx tsx app-server/server.ts`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI && process.env.E2E_REUSE_SERVER === '1',
    timeout: 180_000,
  },
});
