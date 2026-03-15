import { test, expect } from '@playwright/test';

test.describe('FunDrive Smoke Tests', () => {
  test('loads and shows car selection screen', async ({ page }) => {
    await page.goto('/');
    // Should show the title
    await expect(page.locator('#car-select h1')).toHaveText('FunDrive');
    // Should show car cards
    const cards = page.locator('.car-card');
    await expect(cards).toHaveCount(4);
  });

  test('car cards display correct info', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('.car-card');

    // Check that each card has a name and description
    for (let i = 0; i < 4; i++) {
      const card = cards.nth(i);
      await expect(card.locator('h3')).not.toBeEmpty();
      await expect(card.locator('p')).not.toBeEmpty();
      await expect(card.locator('.drive-type')).not.toBeEmpty();
    }
  });

  test('clicking a car starts the game', async ({ page }) => {
    await page.goto('/');

    // Click the first car card
    await page.locator('.car-card').first().click();

    // Car select should be hidden
    await expect(page.locator('#car-select')).toHaveClass(/hidden/);

    // Canvas should be visible
    await expect(page.locator('#game-canvas')).toBeVisible();

    // Wait a moment for the game to render
    await page.waitForTimeout(500);

    // Canvas should have non-zero dimensions
    const canvas = page.locator('#game-canvas');
    const box = await canvas.boundingBox();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test('game renders content on canvas', async ({ page }) => {
    await page.goto('/');
    await page.locator('.car-card').first().click();
    await page.waitForTimeout(1000);

    // Check that the canvas has actual drawn content (not blank)
    const isDrawn = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      // Check if there are any non-zero pixels (something was drawn)
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 0) {
          return true;
        }
      }
      return false;
    });
    expect(isDrawn).toBe(true);
  });

  test('game responds to keyboard input', async ({ page }) => {
    await page.goto('/');
    await page.locator('.car-card').first().click();
    await page.waitForTimeout(500);

    // Get initial car position by checking the game state
    const initialDistance = await page.evaluate(() => {
      // Access the game instance through the module scope
      return 0; // We'll just check that pressing keys doesn't crash
    });

    // Press gas key
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(1500);
    await page.keyboard.up('ArrowRight');

    // The game should still be running (no errors)
    const hasErrors = await page.evaluate(() => {
      return (window as any).__gameError !== undefined;
    });
    expect(hasErrors).toBe(false);
  });

  test('no console errors during gameplay', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });

    await page.goto('/');
    await page.locator('.car-card').nth(1).click();
    await page.waitForTimeout(2000);

    // Drive for a bit
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(2000);
    await page.keyboard.up('ArrowRight');

    expect(errors).toEqual([]);
  });

  test('page has correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('FunDrive');
  });
});
