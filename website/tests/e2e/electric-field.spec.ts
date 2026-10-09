import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator('astro-island:not([ssr])').first().waitFor({ state: 'attached' });
}

/** Screen point of a world position (the −2…2 m square is centred, 10 px padding). */
async function point(page: Page, x: number, y: number) {
  const canvas = page.locator('.field-scene canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const side = Math.min(box.width, box.height) - 20;
  return { x: box.x + box.width / 2 + (x / 4) * side, y: box.y + box.height / 2 - (y / 4) * side };
}

test.describe('electric field', () => {
  test('the particle moves and total energy is conserved', async ({ page }) => {
    await open(page, 'en/electric-field/');
    await expect(page.locator('.result .total')).toHaveText('1.291 nJ');
    await page.getByRole('button', { name: 'Faster' }).click();
    await page.getByRole('button', { name: 'Release the particle!' }).click();
    await expect(page.locator('.result .mono').first()).not.toHaveText('0.0 s', { timeout: 5_000 });
    await page.waitForTimeout(1500);
    await expect(page.locator('.result .total')).toHaveText('1.291 nJ');
  });

  test('exactly between two equal charges the force is zero (Q13)', async ({ page }) => {
    await open(page, 'en/electric-field/?layout=pair');
    const mid = await point(page, 0, 0);
    await page.mouse.click(mid.x + 1, mid.y + 1); // snaps to the grid
    await expect(page.getByText('The force is exactly zero here')).toBeVisible();
    await expect(page).toHaveURL(/\?layout=pair&p=0,0$/);
  });

  test('charges can be dragged, flipped, added and removed', async ({ page, isMobile }) => {
    test.skip(isMobile, 'mouse drag; touch uses the same pointer events');
    await open(page, 'en/electric-field/?layout=single');
    const from = await point(page, 0, 0);
    const to = await point(page, -1, 1);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
    await expect(page).toHaveURL(/\?c=-1,1,%2B&p=0.5,0.2$/);
    await page.getByRole('button', { name: 'Flip sign' }).click();
    await expect(page).toHaveURL(/\?c=-1,1,-&p=0.5,0.2$/);
    await page.getByRole('button', { name: 'Add +' }).click();
    await expect(page).toHaveURL(/c=-1,1,-;[^&]+,%2B/);
    await page.getByRole('button', { name: 'Remove' }).click();
    await page.getByRole('button', { name: 'Remove' }).isDisabled();
    await expect(page).toHaveURL(/\?c=-1,1,-&p=0.5,0.2$/);
  });

  test('a negative particle crashes into a positive charge', async ({ page }) => {
    await open(page, 'ro/electric-field/?layout=single&p=0.5,0&qs=-');
    await page.getByRole('button', { name: 'Mai repede' }).click();
    await page.getByRole('button', { name: 'Mai repede' }).click();
    await page.getByRole('button', { name: 'Dă drumul particulei!' }).click();
    await expect(page.locator('.banner')).toHaveText('Ciocnire!', { timeout: 15_000 });
  });
});
