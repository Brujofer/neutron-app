import { describe, it, expect } from 'vitest';
import * as Engine from '../engine.js';

function emptyBoard() {
  return Array.from({ length: Engine.SIZE }, () => Array(Engine.SIZE).fill(null));
}

function place(board, row, col, cell) {
  board[row][col] = cell;
  return board;
}

describe('estado inicial', () => {
  it('arma el tablero 5x5 con 5 fichas por jugador y el neutrón al centro', () => {
    const state = Engine.createInitialState(1);
    expect(state.board.length).toBe(5);
    expect(Engine.ownerPieces(state.board, 1).length).toBe(5);
    expect(Engine.ownerPieces(state.board, 2).length).toBe(5);
    expect(Engine.ownerPieces(state.board, 1).every((p) => p.row === 4)).toBe(true);
    expect(Engine.ownerPieces(state.board, 2).every((p) => p.row === 0)).toBe(true);
    const n = Engine.findNeutron(state.board);
    expect(n).toEqual({ row: 2, col: 2 });
  });

  it('la primera jugada de la partida salta el paso del neutrón', () => {
    const state = Engine.createInitialState(1);
    expect(state.step).toBe('piece');
    expect(state.isFirstMove).toBe(true);

    // La columna 0 está libre hasta la fila 0 (pieza rival): el deslizamiento
    // obligatorio hasta el choque la lleva a (1,0), no se puede parar antes.
    const next = Engine.movePiece(state, 4, 0, 1, 0);
    expect(next.isFirstMove).toBe(false);
    expect(next.turn).toBe(2);
    expect(next.step).toBe('neutron');
  });

  it('no modifica el estado original (inmutabilidad)', () => {
    const state = Engine.createInitialState(1);
    const before = JSON.stringify(state.board);
    Engine.movePiece(state, 4, 0, 1, 0);
    expect(JSON.stringify(state.board)).toBe(before);
  });
});

describe('deslizamiento hasta el choque', () => {
  it('se desliza hasta el borde del tablero si no hay nada en el camino', () => {
    const board = place(emptyBoard(), 2, 2, { type: 'neutron' });
    const target = Engine.slideTarget(board, 2, 2, 0, 1);
    expect(target).toEqual({ row: 2, col: 4 });
  });

  it('se detiene justo antes de otra pieza (no la salta)', () => {
    const board = place(
      place(emptyBoard(), 2, 2, { type: 'neutron' }),
      2, 4, { type: 'piece', owner: 1 },
    );
    const target = Engine.slideTarget(board, 2, 2, 0, 1);
    expect(target).toEqual({ row: 2, col: 3 });
  });

  it('una dirección con la celda contigua ocupada no es válida', () => {
    const board = place(
      place(emptyBoard(), 2, 2, { type: 'neutron' }),
      2, 3, { type: 'piece', owner: 1 },
    );
    const target = Engine.slideTarget(board, 2, 2, 0, 1);
    expect(target).toBeNull();
  });

  it('funciona también en diagonal', () => {
    const board = place(emptyBoard(), 0, 0, { type: 'neutron' });
    const target = Engine.slideTarget(board, 0, 0, 1, 1);
    expect(target).toEqual({ row: 4, col: 4 });
  });
});

describe('condiciones de victoria', () => {
  it('neutrón en la fila de salida: gana el dueño de esa fila aunque lo haya movido el rival', () => {
    // Turno del jugador 2; el neutrón está a un paso de la fila de salida del jugador 1 (fila 4).
    const board = emptyBoard();
    place(board, 3, 2, { type: 'neutron' });
    place(board, 0, 0, { type: 'piece', owner: 2 }); // ficha cualquiera para que el jugador 2 tenga con qué jugar
    const state = {
      board, turn: 2, step: 'neutron', isFirstMove: false, winner: null, winReason: null, moveNumber: 5,
    };
    const next = Engine.moveNeutron(state, 4, 2);
    expect(next.winner).toBe(1);
    expect(next.winReason).toBe(Engine.WIN_REASONS.NEUTRON_HOME_ROW);
  });

  it('neutrón bloqueado al empezar el turno: pierde quien tiene el turno', () => {
    const board = emptyBoard();
    // Neutrón en la esquina, rodeado por sus 3 vecinos posibles.
    place(board, 0, 0, { type: 'neutron' });
    place(board, 0, 1, { type: 'piece', owner: 1 });
    place(board, 1, 0, { type: 'piece', owner: 1 });
    place(board, 1, 1, { type: 'piece', owner: 1 });
    const state = {
      board, turn: 2, step: 'neutron', isFirstMove: false, winner: null, winReason: null, moveNumber: 5,
    };
    expect(Engine.isNeutronBlocked(state)).toBe(true);
  });

  it('cinco fichas propias en la fila rival: gana tras mover la ficha', () => {
    const board = emptyBoard();
    for (let col = 0; col < 4; col++) place(board, 0, col, { type: 'piece', owner: 1 });
    place(board, 1, 4, { type: 'piece', owner: 1 }); // la quinta, a punto de entrar a la fila 0
    place(board, 2, 2, { type: 'neutron' });
    const state = {
      board, turn: 1, step: 'piece', isFirstMove: false, winner: null, winReason: null, moveNumber: 10,
    };
    const next = Engine.movePiece(state, 1, 4, 0, 4);
    expect(next.winner).toBe(1);
    expect(next.winReason).toBe(Engine.WIN_REASONS.FIVE_IN_ROW);
  });

  it('si tras mover el neutrón el jugador de turno no tiene ninguna ficha movible, pierde', () => {
    const board = emptyBoard();
    place(board, 2, 2, { type: 'neutron' });
    // Única ficha del jugador 1, totalmente rodeada: no podrá moverse después.
    place(board, 0, 0, { type: 'piece', owner: 1 });
    place(board, 0, 1, { type: 'piece', owner: 2 });
    place(board, 1, 0, { type: 'piece', owner: 2 });
    place(board, 1, 1, { type: 'piece', owner: 2 });
    // Bloquea el deslizamiento hacia abajo en (3,2) para que no termine cayendo
    // en la fila de salida (lo que ganaría la partida por otra regla).
    place(board, 4, 2, { type: 'piece', owner: 2 });
    const state = {
      board, turn: 1, step: 'neutron', isFirstMove: false, winner: null, winReason: null, moveNumber: 10,
    };
    const next = Engine.moveNeutron(state, 3, 2);
    expect(next.winner).toBe(2);
    expect(next.winReason).toBe(Engine.WIN_REASONS.NO_PIECE_MOVES);
  });
});

describe('generador de jugadas legales (para la IA)', () => {
  it('en la primera jugada solo genera movimientos de ficha, sin neutrón', () => {
    const state = Engine.createInitialState(1);
    const turns = Engine.generateLegalTurns(state);
    expect(turns.length).toBeGreaterThan(0);
    expect(turns.every((t) => t.neutronTo === null)).toBe(true);
  });

  it('en un turno normal, cada jugada generada es legal según el motor', () => {
    const afterFirst = Engine.movePiece(Engine.createInitialState(1), 4, 0, 1, 0);
    const turns = Engine.generateLegalTurns(afterFirst);
    expect(turns.length).toBeGreaterThan(0);
    for (const t of turns) {
      expect(t.resultState).toBeTruthy();
      expect(t.neutronTo).toBeTruthy();
    }
  });
});
