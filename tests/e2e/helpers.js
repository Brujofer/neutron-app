// Helpers compartidos por los tests de Playwright.

async function selectSegment(page, groupId, value) {
  await page.locator(`#${groupId} .segment[data-value="${value}"]`).click();
}

async function selectSwatch(page, groupId, name) {
  await page.locator(`#${groupId} .swatch[data-name="${name}"]`).click();
}

// Arranca una partida 2 jugadores (sin IA, para que los tests de arrastre no
// dependan de los tiempos de la IA) con colores conocidos.
async function startPvpGame(page, { boardColor = 'verde', p1Color = 'blanco', p2Color = 'negro' } = {}) {
  await page.goto('/');
  await selectSegment(page, 'mode-group', 'pvp');
  await selectSwatch(page, 'p1-color-group', p1Color);
  await selectSwatch(page, 'p2-color-group', p2Color);
  await selectSwatch(page, 'board-color-group', boardColor);
  await page.locator('#btn-play').click();
  await page.locator('#board').waitFor({ state: 'visible' });
}

// Arrastra con mouse (Pointer Events: el mismo código del juego atiende mouse
// y touch de forma unificada, así que esto ejercita el mismo camino de código
// que un arrastre táctil).
async function dragBoard(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

async function boardCellCenter(page, row, col) {
  const box = await page.locator('#board').boundingBox();
  const cell = box.width / 5;
  return { x: box.x + (col + 0.5) * cell, y: box.y + (row + 0.5) * cell };
}

export {
  selectSegment, selectSwatch, startPvpGame, dragBoard, boardCellCenter,
};
