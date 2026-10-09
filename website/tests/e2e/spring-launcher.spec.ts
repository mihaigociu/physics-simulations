import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator('astro-island:not([ssr])').first().waitFor({ state: 'attached' });
}

async function launchFast(page: Page, label = 'Launch!', faster = /Faster/) {
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: faster }).click(); // 8x
  await page.getByRole('button', { name: label }).click();
}

test.describe('spring launcher', () => {
  test('lands where the formula says', async ({ page }) => {
    await open(page, 'en/spring-launcher/');
    await expect(page.locator('.prediction')).toContainText('62.5 J');
    await expect(page.locator('.prediction')).toContainText('15.8 m/s');
    await launchFast(page);
    await expect(page.locator('.banner')).toHaveText('25.5 m!', { timeout: 10_000 });
    await expect(page.locator('.result')).toContainText('Landed 25.5 m away after 2.28 s');
  });

  test('a shared link sets up the Moon in Romanian', async ({ page }) => {
    await open(page, 'ro/spring-launcher/?world=moon&a=30');
    await expect(page.getByRole('radio', { name: /Luna/ })).toHaveAttribute('aria-checked', 'true');
    // R = v²·sin(60°)/g = 250 × 0.866 / 1.62
    await expect(page.locator('.prediction')).toContainText('134 m');
  });

  test('changing a slider updates the share link', async ({ page }) => {
    await open(page, 'en/spring-launcher/');
    await page.getByRole('slider', { name: /Angle/ }).fill('60');
    await expect(page).toHaveURL(/\?a=60$/);
  });

  test('the quiz loads without a Learn tab', async ({ page }) => {
    await open(page, 'en/spring-launcher/quiz/');
    await expect(page.getByRole('link', { name: 'Learn' })).toHaveCount(0);
    await expect(page.locator('.quiz h2').first()).toContainText('k = 500 N/m');
  });
});
