import { describe, it, expect } from 'vitest';
import * as Engine from '../engine.js';
import { easyMove, mediumMove, hardMove, chooseMove } from '../ai.js';

function isLegalTurn(state, turn) {
  const legal = Engine.generateLegalTurns(state);
  return legal.some((t) => t.pieceFrom?.row === turn.pieceFrom?.row
    && t.pieceFrom?.col === turn.pieceFrom?.col
    && t.pieceTo?.row === turn.pieceTo?.row
    && t.pieceTo?.col === turn.pieceTo?.col
    && (t.neutronTo === null ? turn.neutronTo === null
      : turn.neutronTo && t.neutronTo.row === turn.neutronTo.row && t.neutronTo.col === turn.neutronTo.col));
}

function midGameState() {
  // Una posición intermedia cualquiera, jugando varios turnos desde el inicio.
  let state = Engine.createInitialState(1);
  state = Engine.movePiece(state, 4, 0, 1, 0);
  state = Engine.moveNeutron(state, 1, 2);
  state = Engine.movePiece(state, 0, 0, 3, 3);
  return state;
}

describe('IA: siempre devuelve jugadas legales', () => {
  it('Fácil solo elige entre las jugadas legales', () => {
    const state = Engine.createInitialState(1);
    for (let i = 0; i < 15; i++) {
      const turn = easyMove(state, Math.random);
      expect(isLegalTurn(state, turn)).toBe(true);
    }
  });

  it('Medio solo elige entre las jugadas legales', () => {
    const state = midGameState();
    const turn = mediumMove(state, Math.random, 2);
    expect(isLegalTurn(state, turn)).toBe(true);
  });

  it('Difícil solo elige entre las jugadas legales (con tiempo acotado para el test)', () => {
    const state = midGameState();
    const turn = hardMove(state, Math.random, 150);
    expect(isLegalTurn(state, turn)).toBe(true);
  });

  it('chooseMove respeta la dificultad pedida y siempre es legal', () => {
    const state = midGameState();
    for (const difficulty of ['easy', 'medium', 'hard']) {
      const turn = chooseMove(state, difficulty, Math.random);
      expect(isLegalTurn(state, turn)).toBe(true);
    }
  });
});

describe('IA: aprovecha una victoria inmediata', () => {
  it('Fácil gana ya mismo si hay una jugada ganadora disponible', () => {
    const board = Array.from({ length: 5 }, () => Array(5).fill(null));
    for (let col = 0; col < 4; col++) board[0][col] = { type: 'piece', owner: 1 };
    board[1][4] = { type: 'piece', owner: 1 };
    board[2][2] = { type: 'neutron' };
    board[4][4] = { type: 'piece', owner: 2 };
    const state = {
      board, turn: 1, step: 'neutron', isFirstMove: false, winner: null, winReason: null, moveNumber: 20,
    };
    const turn = easyMove(state, Math.random);
    expect(turn.resultState.winner).toBe(1);
  });
});
