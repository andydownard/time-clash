import { expect, test } from './fixtures';

test('page loads with a canvas and a version file', async ({ page, request }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Time Clash');
  await expect(page.locator('#game canvas')).toBeVisible();
  const res = await request.get('/version.txt');
  expect(res.ok()).toBe(true);
  expect((await res.text()).trim().length).toBeGreaterThan(0);
});
