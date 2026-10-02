import { test, expect } from '@playwright/test';
import { startPvpGame, dragBoard, boardCellCenter } from './helpers.js';

// El dispositivo (Pixel 7) lo define el proyecto "mobile-chrome" en playwright.config.js.
test.describe('Arrastre en tamaño de celular', () => {
  test('el tablero es cuadrado y usable en una pantalla vertical de celular', async ({ page }) => {
    await startPvpGame(page);
    const box = await page.locator('#board').boundingBox();
    expect(Math.abs(box.width - box.height)).toBeLessThan(1);
    expect(box.width).toBeGreaterThan(200); // áreas táctiles amplias, no un tablero diminuto
  });

  test('arrastrar una ficha funciona igual que en PC (Pointer Events unifica mouse y touch)', async ({ page }) => {
    await startPvpGame(page);
    const from = await boardCellCenter(page, 4, 0);
    const to = await boardCellCenter(page, 0, 0);
    await dragBoard(page, from, to);

    await expect(page.locator('#status-bar')).toHaveText('Turno de Jugador 2');
    await expect(page.locator('.piece[data-row="1"][data-col="0"]')).toHaveCount(1);
  });
});
