// Utilidades de color: paletas fijas del juego, y elección automática del
// color de las líneas del tablero para que contrasten contra el fondo y no
// se confundan con ninguna pieza.

const PIECE_COLORS = {
  blanco: '#f4f1ea',
  negro: '#1c1c1c',
  rojo: '#c0392b',
  azul: '#2d6fd1',
  violeta: '#7a4fd1',
  amarillo: '#e3c23c',
};

const BOARD_COLORS = {
  verde: '#2f6b46',
  rosa: '#e8b4c4',
  marron: '#7a5137',
  gris: '#8a8f94',
};

// Candidatos para las líneas divisorias: neutros + extremos claro/oscuro.
const LINE_CANDIDATES = ['#ffffff', '#1c1c1c', '#f4f1ea', '#2b2b2b', '#cfcfcf', '#4a4a4a'];

function hexToRgb(hex) {
  const n = hex.replace('#', '');
  const r = parseInt(n.substring(0, 2), 16);
  const g = parseInt(n.substring(2, 4), 16);
  const b = parseInt(n.substring(4, 6), 16);
  return { r, g, b };
}

function channelLuminance(c) {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

// Relación de contraste WCAG entre dos colores (1 a 21).
function contrastRatio(hexA, hexB) {
  const lA = relativeLuminance(hexA) + 0.05;
  const lB = relativeLuminance(hexB) + 0.05;
  return lA > lB ? lA / lB : lB / lA;
}

function sameColor(hexA, hexB) {
  return hexA.toLowerCase() === hexB.toLowerCase();
}

// Elige el color de las líneas del tablero: contraste >= 3:1 contra el fondo,
// y que no coincida con el color del tablero, de ninguna ficha ni del neutrón.
function pickLineColor(boardColorHex, usedColors) {
  const forbidden = [boardColorHex, ...usedColors];
  let best = null;
  let bestRatio = 0;
  for (const candidate of LINE_CANDIDATES) {
    if (forbidden.some((c) => sameColor(c, candidate))) continue;
    const ratio = contrastRatio(candidate, boardColorHex);
    if (ratio >= 3 && ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
  }
  if (best) return best;
  // Último recurso: negro o blanco, el que dé más contraste (ignorando choques de color).
  const blackRatio = contrastRatio('#000000', boardColorHex);
  const whiteRatio = contrastRatio('#ffffff', boardColorHex);
  return blackRatio >= whiteRatio ? '#000000' : '#ffffff';
}

// Sortea el color del neutrón entre los 6 colores de ficha no usados por los jugadores.
function pickNeutronColor(usedColors, random = Math.random) {
  const available = Object.values(PIECE_COLORS).filter(
    (c) => !usedColors.some((u) => sameColor(u, c)),
  );
  const pool = available.length > 0 ? available : Object.values(PIECE_COLORS);
  return pool[Math.floor(random() * pool.length)];
}

export {
  PIECE_COLORS,
  BOARD_COLORS,
  LINE_CANDIDATES,
  relativeLuminance,
  contrastRatio,
  pickLineColor,
  pickNeutronColor,
};
