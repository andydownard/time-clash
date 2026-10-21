// Run with: npx playwright test -c scripts/ipad-audit.config.ts
// Screenshots every screen at the iPad sizes in WebKit and writes docs/screenshots/ipad-audit/.
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.AUDIT_PORT ?? 4391);
const sizes = [
  { device: 'ipad-mini', orientation: 'landscape', width: 1133, height: 744 },
  { device: 'ipad-mini', orientation: 'portrait', width: 744, height: 1133 },
  { device: 'ipad-pro-11', orientation: 'landscape', width: 1194, height: 834 },
  { device: 'ipad-pro-11', orientation: 'portrait', width: 834, height: 1194 },
  { device: 'ipad-pro-13', orientation: 'landscape', width: 1376, height: 1032 },
  { device: 'ipad-pro-13', orientation: 'portrait', width: 1032, height: 1376 },
];

export default defineConfig({
  testDir: '.',
  testMatch: /ipad-audit\.spec\.ts/,
  fullyParallel: true,
  workers: 3,
  timeout: 300_000,
  expect: { timeout: 15_000 },
  use: { baseURL: `http://localhost:${PORT}` },
  projects: sizes.map((s) => ({
    name: `${s.device}-${s.orientation}`,
    metadata: s,
    use: {
      ...devices['Desktop Safari'],
      viewport: { width: s.width, height: s.height },
      hasTouch: true,
    },
  })),
  // AUDIT_DIST: an already built e2e bundle to serve (for example from another commit).
  webServer: {
    command: process.env.AUDIT_DIST
      ? `npx vite preview --mode e2e --outDir ${process.env.AUDIT_DIST} --port ${PORT} --strictPort`
      : 'npx vite build --mode e2e --outDir node_modules/.audit-dist --emptyOutDir && echo audit > node_modules/.audit-dist/version.txt && ' +
        `npx vite preview --mode e2e --outDir node_modules/.audit-dist --port ${PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
