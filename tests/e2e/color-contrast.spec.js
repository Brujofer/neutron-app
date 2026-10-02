import { test, expect } from '@playwright/test';
import { startPvpGame } from './helpers.js';

const BOARD_COLORS = ['verde', 'rosa', 'marron', 'gris'];
const PIECE_COLOR_PAIRS = [
  ['blanco', 'negro'],
  ['rojo', 'azul'],
  ['amarillo', 'violeta'],
];

for (const boardColor of BOARD_COLORS) {
  for (const [p1Color, p2Color] of PIECE_COLOR_PAIRS) {
    test(`contraste: tablero ${boardColor} con fichas ${p1Color}/${p2Color}`, async ({ page }) => {
      await startPvpGame(page, { boardColor, p1Color, p2Color });

      const result = await page.evaluate(async () => {
        const Colors = await import('/colors.js');
        const boardHex = getComputedStyle(document.documentElement).getPropertyValue('--board-color').trim();
        const lineHex = getComputedStyle(document.documentElement).getPropertyValue('--line-color').trim();
        return {
          ratio: Colors.contrastRatio(lineHex, boardHex),
          lineHex,
          boardHex,
        };
      });

      expect(result.ratio).toBeGreaterThanOrEqual(3);

      await page.screenshot({
        path: `test-results/contraste-${boardColor}-${p1Color}-${p2Color}.png`,
      });
    });
  }
}
