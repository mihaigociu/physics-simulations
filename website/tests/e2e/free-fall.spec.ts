import { expect, test, type Page } from '@playwright/test';

/** Open a page and wait until its interactive parts are running (islands hydrated). */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator('astro-island:not([ssr])').first().waitFor({ state: 'attached' });
}

async function dropFast(page: Page, dropLabel = 'Drop!') {
  await page.getByRole('button', { name: /Faster|Mai repede/ }).click();
  await page.getByRole('button', { name: /Faster|Mai repede/ }).click(); // 4x
  await page.getByRole('button', { name: dropLabel }).click();
}

test.describe('free fall', () => {
  test('two different masses land at the same time in a vacuum', async ({ page }) => {
    await open(page, 'en/free-fall/');
    await dropFast(page);
    await expect(page.getByRole('status').filter({ hasText: 'SAME TIME!' })).toBeVisible({ timeout: 10_000 });
    const result = page.locator('.result');
    await expect(result).toContainText('Clock: 2.02 s');
    await expect(result).toContainText('1.0 kg · landed at 2.02 s');
    await expect(result).toContainText('20.0 kg · landed at 2.02 s');
  });

  test('with air on Earth the heavy ball wins (shared link, Romanian numbers)', async ({ page }) => {
    await open(page, 'ro/free-fall/?h=100&m1=0.1&m2=50&air=1');
    await dropFast(page, 'Dă drumul!');
    await expect(page.locator('.banner')).toHaveText('La 0,59 s distanță', { timeout: 15_000 });
    await expect(page.locator('.result')).toContainText('50,0 kg · a ajuns jos la 4,60 s');
  });

  test('on the Moon the air switch changes nothing', async ({ page }) => {
    await open(page, 'en/free-fall/?world=moon&air=1&m1=0.1&m2=50');
    await expect(page.getByText('The Moon has no air, so this changes nothing.')).toBeVisible();
    await dropFast(page);
    await expect(page.locator('.banner')).toHaveText('SAME TIME!', { timeout: 15_000 });
    await expect(page.locator('.result')).toContainText('Clock: 4.97 s');
  });

  test('changing a setting updates the share link', async ({ page }) => {
    await open(page, 'en/free-fall/');
    await page.getByRole('radio', { name: /Mars/ }).click();
    await page.getByRole('switch', { name: /Air resistance/ }).click();
    await expect(page).toHaveURL(/\?world=mars&air=1$/);
  });

  test('keyboard: space drops, then pauses', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard shortcuts are a desktop extra');
    await open(page, 'en/free-fall/?h=100&world=moon');
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
    const clock = await page.locator('.result .mono').textContent();
    await page.waitForTimeout(300);
    await expect(page.locator('.result .mono')).toHaveText(clock!);
  });
});

test.describe('free-fall quiz', () => {
  test('gives feedback and a final score', async ({ page }) => {
    await open(page, 'en/free-fall/quiz/');
    const quiz = page.locator('.quiz');
    await quiz.getByText('They land at the same time').click();
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(quiz.locator('.feedback')).toContainText('Correct!');
    await expect(quiz.getByRole('link', { name: /Try it in the simulation/ })).toHaveAttribute('href', /free-fall\/\?m1=1&m2=10$/);
    for (let i = 1; i < 10; i++) {
      await page.getByRole('button', { name: /Next question|See my score/ }).click();
      await quiz.locator('.option').first().click();
      await page.getByRole('button', { name: 'Check' }).click();
    }
    await page.getByRole('button', { name: 'See my score' }).click();
    await expect(quiz.locator('.result h2')).toHaveText('You got 1 out of 10!');
  });
});
