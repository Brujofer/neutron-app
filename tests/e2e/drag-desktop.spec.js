import { test, expect } from '@playwright/test';
import { startPvpGame, dragBoard, boardCellCenter } from './helpers.js';

test.describe('Arrastre en tamaño de PC', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('arrastrar una ficha hasta el choque mueve la pieza y pasa el turno', async ({ page }) => {
    await startPvpGame(page);
    await expect(page.locator('#status-sub')).toHaveText('Mové una de tus fichas');

    const from = await boardCellCenter(page, 4, 0);
    const to = await boardCellCenter(page, 0, 0); // dirección hacia arriba; el motor desliza hasta el choque
    await dragBoard(page, from, to);

    await expect(page.locator('#status-bar')).toHaveText('Turno de Jugador 2');
    await expect(page.locator('#status-sub')).toHaveText('Mové el neutrón');
    // La ficha debería haber llegado a (1,0): justo antes de la pieza rival en (0,0).
    const piece = page.locator('.piece[data-row="1"][data-col="0"]');
    await expect(piece).toHaveCount(1);
  });

  test('soltar en una dirección sin movimiento posible no mueve la pieza', async ({ page }) => {
    await startPvpGame(page);
    const from = await boardCellCenter(page, 4, 2);
    const to = await boardCellCenter(page, 4, 1); // lateral: la celda contigua ya está ocupada
    await dragBoard(page, from, to);

    // Sigue siendo el turno de Jugador 1, sin avanzar de paso.
    await expect(page.locator('#status-bar')).toHaveText('Turno de Jugador 1');
    await expect(page.locator('.piece[data-row="4"][data-col="2"]')).toHaveCount(1);
  });

  test('tocar una pieza y después el destino también mueve la pieza', async ({ page }) => {
    await startPvpGame(page);
    const pieceEl = page.locator('.piece[data-row="4"][data-col="0"]');
    await pieceEl.click();
    await expect(page.locator('.highlight-dot')).not.toHaveCount(0);

    const dest = page.locator('.highlight-dot').first();
    const box = await dest.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await expect(page.locator('#status-bar')).toHaveText('Turno de Jugador 2');
  });
});
