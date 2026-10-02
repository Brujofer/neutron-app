import { describe, it, expect } from 'vitest';
import {
  PIECE_COLORS, BOARD_COLORS, contrastRatio, pickLineColor, pickNeutronColor,
} from '../colors.js';

describe('contraste', () => {
  it('blanco vs negro da el contraste máximo (21:1)', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });

  it('un color contra sí mismo da contraste 1 (ninguno)', () => {
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 2);
  });
});

describe('color de las líneas del tablero', () => {
  it('para cada color de tablero, elige una línea con contraste >= 3:1 y sin chocar con ninguna ficha', () => {
    const usedPieceColors = Object.values(PIECE_COLORS);
    for (const boardHex of Object.values(BOARD_COLORS)) {
      const line = pickLineColor(boardHex, usedPieceColors);
      expect(contrastRatio(line, boardHex)).toBeGreaterThanOrEqual(3);
      expect(usedPieceColors.some((c) => c.toLowerCase() === line.toLowerCase())).toBe(false);
      expect(line.toLowerCase()).not.toBe(boardHex.toLowerCase());
    }
  });
});

describe('color del neutrón', () => {
  it('nunca sortea un color ya elegido por los jugadores', () => {
    const used = [PIECE_COLORS.blanco, PIECE_COLORS.negro];
    for (let i = 0; i < 50; i++) {
      const n = pickNeutronColor(used, Math.random);
      expect(used.some((c) => c.toLowerCase() === n.toLowerCase())).toBe(false);
    }
  });

  it('si por algún motivo los 6 colores estuvieran usados, no rompe (usa el pool completo)', () => {
    const used = Object.values(PIECE_COLORS);
    const n = pickNeutronColor(used, Math.random);
    expect(Object.values(PIECE_COLORS)).toContain(n);
  });
});
