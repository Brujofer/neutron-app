// Web Worker: corre la IA sin trabar la interfaz.
import { chooseMove } from './ai.js';

self.onmessage = (ev) => {
  const { state, difficulty, requestId } = ev.data;
  const turn = chooseMove(state, difficulty, Math.random);
  self.postMessage({
    requestId,
    neutronTo: turn.neutronTo,
    pieceFrom: turn.pieceFrom,
    pieceTo: turn.pieceTo,
  });
};
