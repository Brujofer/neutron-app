// Motor de reglas de Neutrón. Sin DOM, sin dependencias: estado -> estado.
// Tablero 5x5. Filas 0..4. Fila de salida del jugador 1 = fila 4 (abajo).
// Fila de salida del jugador 2 = fila 0 (arriba). El neutrón arranca en el centro.

const SIZE = 5;
const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

const WIN_REASONS = {
  NEUTRON_HOME_ROW: 'neutron-home-row',
  NEUTRON_BLOCKED: 'neutron-blocked',
  FIVE_IN_ROW: 'five-in-row',
  NO_PIECE_MOVES: 'no-piece-moves',
};

function otherPlayer(owner) {
  return owner === 1 ? 2 : 1;
}

function homeRowOf(owner) {
  return owner === 1 ? SIZE - 1 : 0;
}

function inBounds(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

function cloneBoard(board) {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function cloneState(state) {
  return {
    board: cloneBoard(state.board),
    turn: state.turn,
    step: state.step,
    isFirstMove: state.isFirstMove,
    winner: state.winner,
    winReason: state.winReason,
    moveNumber: state.moveNumber,
  };
}

function createInitialState(firstPlayer = 1) {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (let col = 0; col < SIZE; col++) {
    board[homeRowOf(1)][col] = { type: 'piece', owner: 1 };
    board[homeRowOf(2)][col] = { type: 'piece', owner: 2 };
  }
  const center = Math.floor(SIZE / 2);
  board[center][center] = { type: 'neutron' };
  return {
    board,
    turn: firstPlayer,
    // La primerísima jugada de la partida salta el paso del neutrón.
    step: 'piece',
    isFirstMove: true,
    winner: null,
    winReason: null,
    moveNumber: 0,
  };
}

function getCell(board, row, col) {
  return board[row][col];
}

function findNeutron(board) {
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (board[row][col] && board[row][col].type === 'neutron') return { row, col };
    }
  }
  return null;
}

// Devuelve el destino final en una dirección (desliza hasta chocar), o null si
// esa dirección no tiene ningún movimiento válido (la celda contigua ya está ocupada
// o está fuera del tablero).
function slideTarget(board, row, col, dRow, dCol) {
  const nr = row + dRow;
  const nc = col + dCol;
  if (!inBounds(nr, nc) || board[nr][nc]) return null;
  let lastRow = nr;
  let lastCol = nc;
  let r = nr + dRow;
  let c = nc + dCol;
  while (inBounds(r, c) && !board[r][c]) {
    lastRow = r;
    lastCol = c;
    r += dRow;
    c += dCol;
  }
  return { row: lastRow, col: lastCol };
}

function pieceDestinations(board, row, col) {
  const dests = [];
  for (const [dr, dc] of DIRS) {
    const target = slideTarget(board, row, col, dr, dc);
    if (target) dests.push(target);
  }
  return dests;
}

function ownerPieces(board, owner) {
  const pieces = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const cell = board[row][col];
      if (cell && cell.type === 'piece' && cell.owner === owner) pieces.push({ row, col });
    }
  }
  return pieces;
}

function getNeutronOptions(state) {
  const n = findNeutron(state.board);
  if (!n) return [];
  return pieceDestinations(state.board, n.row, n.col);
}

function getPieceOptions(state, row, col) {
  const cell = getCell(state.board, row, col);
  if (!cell || cell.type !== 'piece' || cell.owner !== state.turn) return [];
  return pieceDestinations(state.board, row, col);
}

function getMovablePieces(state, owner = state.turn) {
  return ownerPieces(state.board, owner).filter(
    (p) => getPieceOptions({ ...state, turn: owner }, p.row, p.col).length > 0,
  );
}

function isNeutronBlocked(state) {
  return getNeutronOptions(state).length === 0;
}

function checkFiveInRow(board, owner) {
  const targetRow = homeRowOf(otherPlayer(owner));
  let count = 0;
  for (let col = 0; col < SIZE; col++) {
    const cell = board[targetRow][col];
    if (cell && cell.type === 'piece' && cell.owner === owner) count++;
  }
  return count === SIZE;
}

// Mueve el neutrón. Devuelve un nuevo estado; si la jugada termina la partida
// (neutrón cae en una fila de salida, o el jugador de turno se queda sin
// fichas movibles) el estado resultante ya tiene winner/winReason seteados.
function moveNeutron(state, toRow, toCol) {
  if (state.step !== 'neutron') {
    throw new Error('No corresponde mover el neutrón en este paso');
  }
  const options = getNeutronOptions(state);
  if (!options.some((o) => o.row === toRow && o.col === toCol)) {
    throw new Error('Movimiento de neutrón inválido');
  }
  const next = cloneState(state);
  const n = findNeutron(next.board);
  next.board[n.row][n.col] = null;
  next.board[toRow][toCol] = { type: 'neutron' };
  next.step = 'piece';

  if (toRow === homeRowOf(1)) {
    next.winner = 1;
    next.winReason = WIN_REASONS.NEUTRON_HOME_ROW;
    return next;
  }
  if (toRow === homeRowOf(2)) {
    next.winner = 2;
    next.winReason = WIN_REASONS.NEUTRON_HOME_ROW;
    return next;
  }

  if (getMovablePieces(next).length === 0) {
    next.winner = otherPlayer(next.turn);
    next.winReason = WIN_REASONS.NO_PIECE_MOVES;
  }
  return next;
}

// Mueve una ficha propia del jugador de turno. Devuelve el nuevo estado,
// ya con el turno pasado al rival (o con winner/winReason si la jugada ganó
// o si el rival queda sin poder mover el neutrón en su próximo turno).
function movePiece(state, fromRow, fromCol, toRow, toCol) {
  if (state.step !== 'piece') {
    throw new Error('No corresponde mover una ficha en este paso');
  }
  const options = getPieceOptions(state, fromRow, fromCol);
  if (!options.some((o) => o.row === toRow && o.col === toCol)) {
    throw new Error('Movimiento de ficha inválido');
  }
  const next = cloneState(state);
  const mover = next.turn;
  next.board[toRow][toCol] = next.board[fromRow][fromCol];
  next.board[fromRow][fromCol] = null;
  next.moveNumber += 1;
  next.isFirstMove = false;

  if (checkFiveInRow(next.board, mover)) {
    next.winner = mover;
    next.winReason = WIN_REASONS.FIVE_IN_ROW;
    return next;
  }

  next.turn = otherPlayer(mover);
  next.step = 'neutron';

  if (isNeutronBlocked(next)) {
    next.winner = mover;
    next.winReason = WIN_REASONS.NEUTRON_BLOCKED;
  }
  return next;
}

// Genera todas las jugadas completas legales para el jugador de turno, para
// uso de la IA. Cada jugada es { neutronTo, pieceFrom, pieceTo, resultState }.
// En la primerísima jugada de la partida, neutronTo es null.
function generateLegalTurns(state) {
  const turns = [];

  if (state.step === 'piece' && state.isFirstMove) {
    for (const piece of ownerPieces(state.board, state.turn)) {
      for (const dest of getPieceOptions(state, piece.row, piece.col)) {
        const resultState = movePiece(state, piece.row, piece.col, dest.row, dest.col);
        turns.push({
          neutronTo: null,
          pieceFrom: piece,
          pieceTo: dest,
          resultState,
        });
      }
    }
    return turns;
  }

  // Paso neutrón -> paso ficha, dentro de un turno normal.
  for (const neutronDest of getNeutronOptions(state)) {
    const afterNeutron = moveNeutron(state, neutronDest.row, neutronDest.col);
    if (afterNeutron.winner) {
      // El neutrón ya decidió la partida (cayó en una fila de salida, o dejó
      // al jugador de turno sin fichas para mover).
      turns.push({
        neutronTo: neutronDest,
        pieceFrom: null,
        pieceTo: null,
        resultState: afterNeutron,
      });
      continue;
    }
    for (const piece of ownerPieces(afterNeutron.board, state.turn)) {
      for (const dest of getPieceOptions(afterNeutron, piece.row, piece.col)) {
        const resultState = movePiece(afterNeutron, piece.row, piece.col, dest.row, dest.col);
        turns.push({
          neutronTo: neutronDest,
          pieceFrom: piece,
          pieceTo: dest,
          resultState,
        });
      }
    }
  }
  return turns;
}

export {
  SIZE,
  DIRS,
  WIN_REASONS,
  otherPlayer,
  homeRowOf,
  cloneState,
  createInitialState,
  findNeutron,
  slideTarget,
  pieceDestinations,
  ownerPieces,
  getNeutronOptions,
  getPieceOptions,
  getMovablePieces,
  isNeutronBlocked,
  moveNeutron,
  movePiece,
  generateLegalTurns,
};
