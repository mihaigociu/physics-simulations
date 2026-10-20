import { expect, test, type Page } from '@playwright/test';

/** Open a page and wait until its interactive parts are running (islands hydrated). */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator('astro-island:not([ssr])').first().waitFor({ state: 'attached' });
}

const speedText = (page: Page) => page.locator('.readings dd').nth(2).textContent();

/** Hold a pedal with a finger (touch screens) or the mouse, near its bottom (= hard). */
async function holdPedal(page: Page, kind: 'gas' | 'brake', ms: number, isMobile: boolean) {
  const pedal = page.locator(`.pedal--${kind}`);
  await pedal.scrollIntoViewIfNeeded();
  const box = (await pedal.boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height * 0.9 };
  if (isMobile) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    await page.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
  }
}

test.describe('car', () => {
  test('the gas pedal drives the car, and it keeps its speed when let go', async ({ page, isMobile }) => {
    await open(page, 'en/car/');
    await holdPedal(page, 'gas', 1000, isMobile);
    await expect(page.locator('.readings')).not.toContainText('Clock0.0 s');
    const v = await speedText(page);
    expect(Number.parseFloat(v!)).toBeGreaterThan(1);
    await page.waitForTimeout(500);
    await expect(page.locator('.readings dd').nth(2)).toHaveText(v!); // no friction
    await expect(page.locator('.readings dd').nth(3)).toHaveText('0.0 m/s²');
  });

  test('the brake stops the car and never reverses it', async ({ page, isMobile }) => {
    await open(page, 'en/car/');
    await holdPedal(page, 'gas', 600, isMobile);
    await holdPedal(page, 'brake', 1500, isMobile);
    await expect(page.locator('.readings dd').nth(2)).toContainText('0.0 m/s');
  });

  test('keyboard: ↑ accelerates, Space pauses', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard shortcuts are a desktop extra');
    await open(page, 'en/car/');
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(800);
    await page.keyboard.up('ArrowUp');
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
    const clock = await page.locator('.readings dd').first().textContent();
    await page.waitForTimeout(300);
    await expect(page.locator('.readings dd').first()).toHaveText(clock!);
  });

  test('hands-off challenge: the speed stays the same with no pedal', async ({ page }) => {
    await open(page, 'en/car/?mode=cruise');
    await page.getByRole('button', { name: 'Faster' }).click();
    await page.getByRole('button', { name: 'Faster' }).click(); // 4x
    await page.keyboard.down('ArrowUp');
    await expect(page.locator('.steps li').first()).toHaveClass(/done/, { timeout: 5000 });
    await page.keyboard.up('ArrowUp');
    await expect(page.locator('.banner')).toHaveText('IT KEEPS GOING!', { timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('picking a challenge updates the share link (Romanian)', async ({ page }) => {
    await open(page, 'ro/car/');
    await page.getByRole('radio', { name: /Parchează la steag/ }).click();
    await expect(page).toHaveURL(/\?mode=park$/);
    await expect(page.locator('.mission')).toContainText('linia galbenă de la 100 m');
  });

  test('touching a graph freezes time and shows that moment', async ({ page, isMobile }) => {
    await open(page, 'en/car/');
    await holdPedal(page, 'gas', 1500, isMobile);
    await page.waitForTimeout(500);
    const plot = page.locator('.chart-slot--active .plot').first();
    await plot.scrollIntoViewIfNeeded();
    const box = (await plot.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height / 2);
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
    await expect(page.locator('.readings .at')).toBeVisible();
  });
});
