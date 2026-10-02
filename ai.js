// IA de Neutrón: funciones puras sobre el estado del motor (engine.js).
// No tocan el DOM; se usan tanto en el Web Worker (ai-worker.js) como en los tests.

import * as Engine from './engine.js';

const WIN_SCORE = 1000000;

function pickRandom(list, random) {
  return list[Math.floor(random() * list.length)];
}

// ----- Evaluación (para Medio y Difícil) -----

function countGuards(board, neutronPos, owner) {
  let count = 0;
  for (const [dr, dc] of Engine.DIRS) {
    const r = neutronPos.row + dr;
    const c = neutronPos.col + dc;
    if (r < 0 || r >= Engine.SIZE || c < 0 || c >= Engine.SIZE) continue;
    const cell = board[r][c];
    if (cell && cell.type === 'piece' && cell.owner === owner) count++;
  }
  return count;
}

function mobilityOf(board, owner) {
  let total = 0;
  for (const p of Engine.ownerPieces(board, owner)) {
    total += Engine.pieceDestinations(board, p.row, p.col).length;
  }
  return total;
}

// Evalúa el estado desde el punto de vista del jugador `me` (más alto = mejor para `me`).
function evaluate(state, me) {
  if (state.winner) return state.winner === me ? WIN_SCORE : -WIN_SCORE;
  const opp = Engine.otherPlayer(me);
  const n = Engine.findNeutron(state.board);
  const distToMyRow = Math.abs(n.row - Engine.homeRowOf(me));
  const distToOppRow = Math.abs(n.row - Engine.homeRowOf(opp));
  const neutronMobility = Engine.getNeutronOptions(state).length;

  let score = 0;
  score += (mobilityOf(state.board, me) - mobilityOf(state.board, opp)) * 2;
  score += neutronMobility; // tener al neutrón con opciones evita quedar bloqueado en tu propio turno
  score += distToMyRow * 3; // cuanto más lejos de tu propia fila, más seguro
  score -= distToOppRow * 3; // cuanto más cerca de la fila rival, más amenaza a tu favor
  score += countGuards(state.board, n, me) * 1.5;
  score -= countGuards(state.board, n, opp) * 1.5;
  return score;
}

// ----- Fácil: casi al azar, pero gana si puede y evita lo más obvio -----

function opponentCanWinNextTurn(resultState, mover) {
  if (resultState.winner) return resultState.winner !== mover;
  const opp = Engine.otherPlayer(mover);
  return Engine.generateLegalTurns(resultState).some((t) => t.resultState.winner === opp);
}

function easyMove(state, random = Math.random) {
  const turns = Engine.generateLegalTurns(state);
  const winning = turns.filter((t) => t.resultState.winner === state.turn);
  if (winning.length) return pickRandom(winning, random);
  const safe = turns.filter((t) => !opponentCanWinNextTurn(t.resultState, state.turn));
  return pickRandom(safe.length ? safe : turns, random);
}

// ----- Medio: minimax/alfa-beta a poca profundidad -----

function minimax(state, depthLeft, alpha, beta, me, ply) {
  if (state.winner) return state.winner === me ? WIN_SCORE - ply : -(WIN_SCORE - ply);
  if (depthLeft === 0) return evaluate(state, me);
  const turns = Engine.generateLegalTurns(state);
  if (turns.length === 0) return evaluate(state, me);
  const maximizing = state.turn === me;
  let best = maximizing ? -Infinity : Infinity;
  for (const t of turns) {
    const val = minimax(t.resultState, depthLeft - 1, alpha, beta, me, ply + 1);
    if (maximizing) {
      if (val > best) best = val;
      if (best > alpha) alpha = best;
    } else {
      if (val < best) best = val;
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break;
  }
  return best;
}

function mediumMove(state, random = Math.random, depth = 2) {
  const me = state.turn;
  const turns = Engine.generateLegalTurns(state);
  let bestScore = -Infinity;
  const scored = turns.map((t) => {
    const score = minimax(t.resultState, depth - 1, -Infinity, Infinity, me, 1);
    if (score > bestScore) bestScore = score;
    return { t, score };
  });
  const EPSILON = 0.001;
  const best = scored.filter((s) => s.score >= bestScore - EPSILON).map((s) => s.t);
  return pickRandom(best, random);
}

// ----- Difícil: alfa-beta con orden de jugadas y profundización iterativa -----

function orderTurns(turns, me) {
  return turns
    .map((t) => ({ t, score: evaluate(t.resultState, me) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t);
}

function hardMove(state, random = Math.random, timeLimitMs = 1200) {
  const me = state.turn;
  const deadline = Date.now() + timeLimitMs;
  const rootTurns = Engine.generateLegalTurns(state);
  if (rootTurns.length === 1) return rootTurns[0];

  let bestTurn = rootTurns[0];
  let depth = 1;

  while (Date.now() < deadline && depth <= 6) {
    const ordered = orderTurns(rootTurns, me);
    let bestScore = -Infinity;
    let currentBest = ordered[0];
    let aborted = false;
    for (const t of ordered) {
      if (Date.now() >= deadline) { aborted = true; break; }
      const score = minimax(t.resultState, depth - 1, -Infinity, Infinity, me, 1);
      if (score > bestScore) {
        bestScore = score;
        currentBest = t;
      }
    }
    if (!aborted) {
      bestTurn = currentBest;
      if (bestScore >= WIN_SCORE - 100) break; // ya encontró una victoria forzada
    }
    depth += 1;
  }
  return bestTurn;
}

// ----- Punto de entrada -----

function chooseMove(state, difficulty, random = Math.random) {
  if (difficulty === 'easy') return easyMove(state, random);
  if (difficulty === 'hard') return hardMove(state, random);
  return mediumMove(state, random);
}

export {
  evaluate, easyMove, mediumMove, hardMove, chooseMove,
};
