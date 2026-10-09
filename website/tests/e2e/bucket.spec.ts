import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator('astro-island:not([ssr])').first().waitFor({ state: 'attached' });
}

test.describe('bucket', () => {
  test('drains in the predicted time, the second half slower than the first', async ({ page }) => {
    await open(page, 'en/bucket/');
    await expect(page.locator('.prediction')).toContainText('1 min 42 s');
    await page.getByRole('button', { name: 'Faster' }).click();
    await page.getByRole('button', { name: 'Faster' }).click();
    await page.getByRole('button', { name: 'Faster' }).click();
    await expect(page.getByRole('group', { name: 'Simulation speed' })).toContainText('50×');
    await page.getByRole('button', { name: 'Pull the plug!' }).click();
    await expect(page.locator('.banner')).toHaveText('EMPTY after 1 min 42 s!', { timeout: 10_000 });
    await expect(page.locator('.result')).toContainText('first half of the water took 29.8 s');
  });

  test('twice the hole radius empties four times faster', async ({ page }) => {
    await open(page, 'en/bucket/?d=20');
    await expect(page.locator('.prediction')).toContainText('25.5 s');
  });

  test('Moon setup from a shared link, in Romanian', async ({ page }) => {
    await open(page, 'ro/bucket/?world=moon');
    await expect(page.locator('.prediction')).toContainText('4 min 11 s');
  });
});
