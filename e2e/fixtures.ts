// Every spec imports test and expect from here, not from @playwright/test.
// The page it hands out is silent, and the test fails if the app:
//   - asks for anything outside this site (privacy: no network calls to other origins),
//   - logs a console error or throws an uncaught error.
import { expect, test as base, type Page } from '@playwright/test';
import { installSilent } from './support/silent';

type Options = {
  /** Set false for a test that expects errors. Default true. */
  strictConsole: boolean;
};

export const test = base.extend<Options & { page: Page }>({
  strictConsole: [true, { option: true }],
  page: async ({ page, baseURL, strictConsole }, use) => {
    await installSilent(page);
    const home = new URL(baseURL ?? 'http://localhost:4173').origin;
    const outside: string[] = [];
    const problems: string[] = [];
    page.on('request', (r) => {
      const url = r.url();
      if (/^(data|blob|about):/.test(url)) return;
      if (new URL(url).origin !== home) outside.push(url);
    });
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`console.error: ${m.text()}`);
    });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    await use(page);
    expect(outside, 'requests to other origins').toEqual([]);
    if (strictConsole) expect(problems, 'console errors').toEqual([]);
  },
});

export { expect };
