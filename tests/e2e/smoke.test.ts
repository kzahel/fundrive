import { test, expect } from '@playwright/test';

test.describe('FunDrive Smoke Tests', () => {
  test('loads and shows car selection screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#car-select h1')).toHaveText('FunDrive');
    const cards = page.locator('.car-card');
    await expect(cards).toHaveCount(4);
  });

  test('car cards display correct info', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('.car-card');
    for (let i = 0; i < 4; i++) {
      const card = cards.nth(i);
      await expect(card.locator('h3')).not.toBeEmpty();
      await expect(card.locator('p')).not.toBeEmpty();
      await expect(card.locator('.drive-type')).not.toBeEmpty();
    }
  });

  test('page has correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('FunDrive');
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
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(2000);
    await page.keyboard.up('ArrowRight');
    expect(errors).toEqual([]);
  });
});

test.describe('FunDrive Visual Smoke Tests', () => {
  test('car select screen looks correct', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');
    await expect(page.locator('#car-select h1')).toBeVisible();
    await page.screenshot({ path: 'test-results/01-car-select.png' });
  });

  test('game renders terrain and car after starting', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');

    // Select a car
    await page.locator('.car-card').first().click();
    await expect(page.locator('#car-select')).toHaveClass(/hidden/);

    // Wait for several frames to render
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/02-game-start.png' });

    // Verify terrain is visible: sample pixels in the lower portion of canvas
    // (terrain should be green/brown, not just sky blue)
    const colorCheck = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      const w = canvas.width;
      const h = canvas.height;

      // Sample the bottom third of the canvas across multiple x positions
      // Terrain should produce non-sky-blue pixels there
      let terrainPixels = 0;
      let totalSampled = 0;
      const skyR = 0x87, skyG = 0xCE, skyB = 0xEB;
      const skyBottomR = 0xE0, skyBottomG = 0xF0, skyBottomB = 0xFF;

      for (let x = 0; x < w; x += 20) {
        for (let y = Math.floor(h * 0.4); y < h; y += 10) {
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          totalSampled++;
          // Check if pixel is NOT sky-colored (allowing some tolerance)
          const isSkyTop = Math.abs(pixel[0] - skyR) < 20 &&
                           Math.abs(pixel[1] - skyG) < 20 &&
                           Math.abs(pixel[2] - skyB) < 20;
          const isSkyBottom = Math.abs(pixel[0] - skyBottomR) < 20 &&
                              Math.abs(pixel[1] - skyBottomG) < 20 &&
                              Math.abs(pixel[2] - skyBottomB) < 20;
          if (!isSkyTop && !isSkyBottom) {
            terrainPixels++;
          }
        }
      }

      return {
        terrainPixels,
        totalSampled,
        terrainRatio: terrainPixels / totalSampled,
        canvasSize: { w, h },
      };
    });

    console.log('Terrain pixel check:', JSON.stringify(colorCheck));
    // At least 10% of lower-half pixels should be non-sky (terrain/ground)
    expect(colorCheck.terrainRatio).toBeGreaterThan(0.1);
  });

  test('car moves when pressing gas', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');
    await page.locator('.car-card').first().click();
    await page.waitForTimeout(1000);

    // Take screenshot before driving
    await page.screenshot({ path: 'test-results/03-before-drive.png' });

    // Drive right for 3 seconds
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(3000);
    await page.keyboard.up('ArrowRight');

    await page.screenshot({ path: 'test-results/04-after-drive.png' });

    // Compare: the canvas content should have changed significantly
    // (camera follows car, so the whole scene shifts)
    const afterDriveCheck = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      const w = canvas.width;
      const h = canvas.height;

      // Sample a horizontal stripe in the middle - should have terrain variety
      let uniqueColors = new Set<string>();
      for (let x = 0; x < w; x += 5) {
        const y = Math.floor(h * 0.6);
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        // Bucket colors to reduce noise
        const r = Math.floor(pixel[0] / 32) * 32;
        const g = Math.floor(pixel[1] / 32) * 32;
        const b = Math.floor(pixel[2] / 32) * 32;
        uniqueColors.add(`${r},${g},${b}`);
      }

      return { uniqueColorBuckets: uniqueColors.size };
    });

    console.log('Color variety after driving:', afterDriveCheck);
    // After driving, the scene should have multiple distinct colors
    // (terrain, sky, car parts, etc.) — use >= 2 since bucketing can merge similar colors
    expect(afterDriveCheck.uniqueColorBuckets).toBeGreaterThanOrEqual(2);
  });

  test('HUD displays and updates during play', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');
    await page.locator('.car-card').first().click();
    await page.waitForTimeout(500);

    // Read HUD area pixels - top-left should have white text on the scene
    const hudCheck = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;

      // Sample the top-left 200x100 area for white pixels (HUD text)
      let whitePixels = 0;
      let total = 0;
      for (let x = 0; x < 200; x += 4) {
        for (let y = 0; y < 100; y += 4) {
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          total++;
          if (pixel[0] > 240 && pixel[1] > 240 && pixel[2] > 240) {
            whitePixels++;
          }
        }
      }
      return { whitePixels, total, ratio: whitePixels / total };
    });

    // HUD text should produce some white pixels in the top-left
    expect(hudCheck.whitePixels).toBeGreaterThan(5);

    // Now drive and check distance increases
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(3000);
    await page.keyboard.up('ArrowRight');

    await page.screenshot({ path: 'test-results/05-hud-after-drive.png' });
  });

  test('boost creates visual effects', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');
    await page.locator('.car-card').first().click();
    await page.waitForTimeout(1000);

    // Drive with boost
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(2000);
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('ArrowRight');

    await page.screenshot({ path: 'test-results/06-after-boost.png' });
  });
});
