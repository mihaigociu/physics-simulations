import { expect, test } from '@playwright/test';

test.describe('site', () => {
  test('root sends visitors to their browser language', async ({ browser }) => {
    for (const [locale, lang] of [['en-GB', 'en'], ['ro-RO', 'ro'], ['fr-FR', 'ro']] as const) {
      const context = await browser.newContext({ locale });
      const page = await context.newPage();
      await page.goto('./');
      await expect(page).toHaveURL(new RegExp(`/${lang}/$`));
      await context.close();
    }
  });

  test('a language picked with the switch is remembered', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US' });
    const page = await context.newPage();
    await page.goto('en/');
    await page.locator('.lang-switch a[data-lang="ro"]').click();
    await expect(page).toHaveURL(/\/ro\/$/);
    await page.goto('./');
    await expect(page).toHaveURL(/\/ro\/$/);
    await context.close();
  });

  test('every page loads without errors in both languages', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const lang of ['ro', 'en']) {
      for (const path of ['', 'free-fall/', 'free-fall/learn/', 'free-fall/quiz/', 'spring-launcher/', 'spring-launcher/quiz/', 'bucket/', 'bucket/quiz/', 'electric-field/']) {
        const response = await page.goto(`${lang}/${path}`);
        expect(response?.status(), `${lang}/${path}`).toBe(200);
        await expect(page.locator('h1')).toHaveCount(1);
      }
    }
    expect(errors).toEqual([]);
  });
});
