import * as Engine from './engine.js';
import * as Colors from './colors.js';
import * as Storage from './storage.js';
import * as Audio from './audio.js';

// ===================== Estado de la app =====================

let settings = null; // configuración elegida en el menú (se recuerda entre partidas)
let session = null;  // partida en curso: { state, mode, difficulty, humanSide, colores..., history }
let selected = null; // { row, col, options } de la pieza/neutrón tomada
let aiThinking = false;

function defaultSettings() {
  return {
    mode: 'pvc',
    starter: '1',
    p1Color: 'blanco',
    p2Color: 'negro',
    boardColor: 'verde',
    difficulty: 'medium',
    highlight: true,
    sound: true,
  };
}

// ===================== Referencias DOM =====================

const el = (id) => document.getElementById(id);
const screenMenu = el('screen-menu');
const screenGame = el('screen-game');
const boardEl = el('board');
const statusBar = el('status-bar');
const statusSub = el('status-sub');
const btnUndo = el('btn-undo');
const btnContinue = el('btn-continue');

// ===================== Utilidades de juego =====================

function playerName(n) {
  if (session && session.mode === 'pvc') return n === session.humanSide ? 'vos' : 'la IA';
  return `Jugador ${n}`;
}

function playerNameCap(n) {
  const name = playerName(n);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function isInteractive() {
  return !!session && !session.state.winner && !aiThinking
    && (session.mode === 'pvp' || session.state.turn === session.humanSide);
}

function colorFor(ownerOrNeutron) {
  if (ownerOrNeutron === 'neutron') return session.neutronColor;
  return ownerOrNeutron === 1 ? session.p1ColorHex : session.p2ColorHex;
}

// ===================== IA (corre en un Web Worker para no trabar la interfaz) =====================

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const aiWorker = new Worker('./ai-worker.js', { type: 'module' });
let aiRequestId = 0;
const pendingAiRequests = new Map();

aiWorker.addEventListener('message', (ev) => {
  const { requestId, neutronTo, pieceFrom, pieceTo } = ev.data;
  const resolve = pendingAiRequests.get(requestId);
  if (!resolve) return;
  pendingAiRequests.delete(requestId);
  resolve({ neutronTo, pieceFrom, pieceTo });
});

function requestAiMove(state, difficulty) {
  const requestId = ++aiRequestId;
  return new Promise((resolve) => {
    pendingAiRequests.set(requestId, resolve);
    aiWorker.postMessage({ state, difficulty, requestId });
  });
}

// ===================== Historial / deshacer =====================

function pushHistory() {
  session.history.push({ state: session.state, mover: session.state.turn });
}

function onUndo() {
  if (!session || session.history.length === 0 || aiThinking) return;
  if (session.mode === 'pvc') {
    while (session.history.length && session.history[session.history.length - 1].mover !== session.humanSide) {
      session.state = session.history.pop().state;
    }
    while (session.history.length && session.history[session.history.length - 1].mover === session.humanSide) {
      session.state = session.history.pop().state;
    }
  } else {
    session.state = session.history.pop().state;
  }
  selected = null;
  renderBoard();
  persist();
}

// ===================== Persistencia =====================

function persist() {
  if (!session || session.state.winner) return;
  Storage.saveGame({
    state: session.state,
    mode: session.mode,
    difficulty: session.difficulty,
    humanSide: session.humanSide,
    p1ColorHex: session.p1ColorHex,
    p2ColorHex: session.p2ColorHex,
    boardColorHex: session.boardColorHex,
    neutronColor: session.neutronColor,
    lineColor: session.lineColor,
    history: session.history,
  });
}

function refreshContinueButton() {
  const saved = Storage.loadGame();
  btnContinue.classList.toggle('hidden', !saved || !!saved.state.winner);
}

// ===================== Render del tablero =====================

function boardCellSize() {
  return boardEl.getBoundingClientRect().width / Engine.SIZE;
}

function applyBoardTheme() {
  document.documentElement.style.setProperty('--board-color', session.boardColorHex);
  document.documentElement.style.setProperty('--line-color', session.lineColor);
}

function renderBoard() {
  if (!session) return;
  const cell = boardCellSize();
  boardEl.innerHTML = '';
  for (let row = 0; row < Engine.SIZE; row++) {
    for (let col = 0; col < Engine.SIZE; col++) {
      const data = session.state.board[row][col];
      if (!data) continue;
      const piece = document.createElement('div');
      piece.className = `piece ${data.type === 'neutron' ? 'neutron' : `owner-${data.owner}`}`;
      piece.dataset.row = String(row);
      piece.dataset.col = String(col);
      piece.style.transform = `translate(${col * cell}px, ${row * cell}px)`;
      if (selected && selected.row === row && selected.col === col) piece.classList.add('selected');

      const shape = document.createElement('div');
      shape.className = 'piece-shape';
      shape.style.background = data.type === 'neutron' ? session.neutronColor : colorFor(data.owner);
      piece.appendChild(shape);

      piece.addEventListener('pointerdown', onPiecePointerDown);
      boardEl.appendChild(piece);
    }
  }
  renderHighlights(cell);
  updateStatusText();
  updateUndoButton();
}

function renderHighlights(cell) {
  if (!selected || !settings.highlight) return;
  for (const dest of selected.options) {
    const dot = document.createElement('div');
    dot.className = 'highlight-dot';
    dot.style.transform = `translate(${dest.col * (cell ?? boardCellSize())}px, ${dest.row * (cell ?? boardCellSize())}px)`;
    boardEl.appendChild(dot);
  }
}

function updateStatusText() {
  if (!session) return;
  const state = session.state;
  if (state.winner) return; // el modal de fin de partida se encarga del mensaje
  statusBar.textContent = `Turno de ${playerNameCap(state.turn)}`;
  if (session.mode === 'pvc' && state.turn !== session.humanSide) {
    statusSub.textContent = 'La IA está pensando…';
  } else {
    statusSub.textContent = state.step === 'neutron' ? 'Mové el neutrón' : 'Mové una de tus fichas';
  }
}

function updateUndoButton() {
  btnUndo.disabled = !session || session.history.length === 0 || aiThinking;
}

function findPieceEl(row, col) {
  return boardEl.querySelector(`.piece[data-row="${row}"][data-col="${col}"]`);
}

// ===================== Selección e interacción (arrastre + toque) =====================

// Seleccionar/deseleccionar NO reconstruye el tablero: si lo hiciera, destruiría
// el elemento que el usuario está arrastrando en ese mismo instante y cortaría
// el gesto de arrastre a mitad de camino.
function clearHighlightDots() {
  boardEl.querySelectorAll('.highlight-dot').forEach((d) => d.remove());
}

function applySelectedClass() {
  boardEl.querySelectorAll('.piece.selected').forEach((p) => p.classList.remove('selected'));
  if (selected) {
    const p = findPieceEl(selected.row, selected.col);
    if (p) p.classList.add('selected');
  }
}

function selectCell(row, col, options) {
  selected = { row, col, options };
  applySelectedClass();
  clearHighlightDots();
  renderHighlights();
}

function clearSelection() {
  selected = null;
  clearHighlightDots();
  applySelectedClass();
}

function optionsFor(row, col) {
  const data = session.state.board[row][col];
  if (!data) return [];
  if (session.state.step === 'neutron') {
    return data.type === 'neutron' ? Engine.getNeutronOptions(session.state) : [];
  }
  if (data.type !== 'piece' || data.owner !== session.state.turn) return [];
  return Engine.getPieceOptions(session.state, row, col);
}

function matchDirection(row, col, dx, dy, options) {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < 4 && ady < 4) return null;
  let dRow;
  let dCol;
  const ratio = Math.min(adx, ady) / Math.max(adx, ady);
  if (ratio > 0.5) {
    dRow = dy > 0 ? 1 : -1;
    dCol = dx > 0 ? 1 : -1;
  } else if (adx > ady) {
    dRow = 0;
    dCol = dx > 0 ? 1 : -1;
  } else {
    dRow = dy > 0 ? 1 : -1;
    dCol = 0;
  }
  return options.find((o) => Math.sign(o.row - row) === dRow && Math.sign(o.col - col) === dCol) || null;
}

function onPiecePointerDown(ev) {
  if (!isInteractive()) return;
  const pieceEl = ev.currentTarget;
  const row = Number(pieceEl.dataset.row);
  const col = Number(pieceEl.dataset.col);
  const options = optionsFor(row, col);
  if (options.length === 0) return;

  ev.preventDefault();
  pieceEl.setPointerCapture(ev.pointerId);
  const cell = boardCellSize();
  const baseX = col * cell;
  const baseY = row * cell;
  const startX = ev.clientX;
  const startY = ev.clientY;
  let moved = false;

  selectCell(row, col, options);
  pieceEl.classList.add('dragging');

  function onMove(e) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
    pieceEl.style.transform = `translate(${baseX + dx}px, ${baseY + dy}px)`;
  }

  function onUp(e) {
    pieceEl.removeEventListener('pointermove', onMove);
    pieceEl.removeEventListener('pointerup', onUp);
    pieceEl.removeEventListener('pointercancel', onUp);
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    pieceEl.classList.remove('dragging');

    if (!moved) {
      pieceEl.style.transform = `translate(${baseX}px, ${baseY}px)`;
      return; // quedó seleccionada, esperando el toque de destino
    }
    const dest = matchDirection(row, col, dx, dy, options);
    if (dest) {
      commitMove(row, col, dest, pieceEl, cell);
    } else {
      Audio.play('invalid');
      pieceEl.classList.add('animating');
      pieceEl.style.transform = `translate(${baseX}px, ${baseY}px)`;
      setTimeout(() => { pieceEl.classList.remove('animating'); }, 240);
    }
  }

  pieceEl.addEventListener('pointermove', onMove);
  pieceEl.addEventListener('pointerup', onUp);
  pieceEl.addEventListener('pointercancel', onUp);
}

function onBoardClick(ev) {
  if (!selected || !isInteractive()) return;
  if (ev.target.closest('.piece')) return;
  const rect = boardEl.getBoundingClientRect();
  const cell = rect.width / Engine.SIZE;
  const col = Math.floor((ev.clientX - rect.left) / cell);
  const row = Math.floor((ev.clientY - rect.top) / cell);
  const dest = selected.options.find((o) => o.row === row && o.col === col);
  if (dest) {
    const pieceEl = findPieceEl(selected.row, selected.col);
    commitMove(selected.row, selected.col, dest, pieceEl, cell);
  } else {
    clearSelection();
  }
}

function commitMove(fromRow, fromCol, dest, pieceEl, cell) {
  const stepType = session.state.step;
  let done = false;
  Audio.play('slide');
  if (pieceEl) {
    pieceEl.classList.add('animating');
    pieceEl.style.transform = `translate(${dest.col * cell}px, ${dest.row * cell}px)`;
  }

  function finish() {
    if (done) return;
    done = true;
    pushHistory();
    const newState = stepType === 'neutron'
      ? Engine.moveNeutron(session.state, dest.row, dest.col)
      : Engine.movePiece(session.state, fromRow, fromCol, dest.row, dest.col);
    session.state = newState;
    selected = null;
    Audio.play('collide');
    persist();
    renderBoard();
    if (newState.winner) {
      onGameEnd(newState);
      return;
    }
    if (stepType === 'piece') {
      Audio.play('turn');
      maybeTriggerAi();
    }
  }

  if (pieceEl) {
    pieceEl.addEventListener('transitionend', finish, { once: true });
  }
  setTimeout(finish, 260);
}

// ===================== Turno de la IA =====================

async function maybeTriggerAi() {
  if (!session || session.mode !== 'pvc' || session.state.winner) return;
  if (session.state.turn === session.humanSide) return;
  aiThinking = true;
  updateStatusText();
  updateUndoButton();
  await delay(350);
  const chosen = await requestAiMove(session.state, session.difficulty);

  if (chosen.neutronTo) {
    pushHistory();
    const afterNeutron = Engine.moveNeutron(session.state, chosen.neutronTo.row, chosen.neutronTo.col);
    session.state = afterNeutron;
    Audio.play('slide');
    Audio.play('collide');
    renderBoard();
    persist();
    if (afterNeutron.winner) {
      aiThinking = false;
      onGameEnd(afterNeutron);
      return;
    }
    await delay(450);
  }

  pushHistory();
  const afterPiece = Engine.movePiece(
    session.state, chosen.pieceFrom.row, chosen.pieceFrom.col, chosen.pieceTo.row, chosen.pieceTo.col,
  );
  session.state = afterPiece;
  Audio.play('slide');
  Audio.play('collide');
  aiThinking = false;
  renderBoard();
  persist();
  if (afterPiece.winner) {
    onGameEnd(afterPiece);
  } else {
    Audio.play('turn');
  }
}

// ===================== Fin de partida =====================

const REASON_TEXT = {
  [Engine.WIN_REASONS.NEUTRON_HOME_ROW]: (winner) => `El neutrón llegó a la fila de salida de ${playerName(winner)}.`,
  [Engine.WIN_REASONS.NEUTRON_BLOCKED]: (winner) => `${playerNameCap(Engine.otherPlayer(winner))} se quedó sin movimientos para el neutrón.`,
  [Engine.WIN_REASONS.FIVE_IN_ROW]: (winner) => `${playerNameCap(winner)} llevó sus 5 fichas a la fila rival.`,
  [Engine.WIN_REASONS.NO_PIECE_MOVES]: (winner) => `${playerNameCap(Engine.otherPlayer(winner))} se quedó sin fichas para mover.`,
};

function onGameEnd(state) {
  Storage.clearGame();
  if (session.mode === 'pvc') {
    Audio.play(state.winner === session.humanSide ? 'win' : 'lose');
  } else {
    Audio.play('win');
  }
  el('end-title').textContent = `¡Ganó ${playerNameCap(state.winner)}!`;
  el('end-reason').textContent = REASON_TEXT[state.winReason](state.winner);
  showOverlay('modal-end');
}

// ===================== Pantallas y overlays =====================

function showScreen(name) {
  screenMenu.classList.toggle('hidden', name !== 'menu');
  screenGame.classList.toggle('hidden', name !== 'game');
}

function showOverlay(id) { el(id).classList.remove('hidden'); }
function hideOverlay(id) { el(id).classList.add('hidden'); }

// ===================== Menú: colores =====================

function buildSwatchGroup(container, colorMap) {
  container.innerHTML = '';
  for (const [name, hex] of Object.entries(colorMap)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.style.background = hex;
    btn.dataset.name = name;
    container.appendChild(btn);
  }
}

function refreshColorAvailability() {
  const p1Group = el('p1-color-group');
  const p2Group = el('p2-color-group');
  for (const btn of p1Group.children) {
    btn.classList.toggle('disabled', btn.dataset.name === settings.p2Color);
    btn.disabled = btn.dataset.name === settings.p2Color;
    btn.classList.toggle('selected', btn.dataset.name === settings.p1Color);
  }
  for (const btn of p2Group.children) {
    btn.classList.toggle('disabled', btn.dataset.name === settings.p1Color);
    btn.disabled = btn.dataset.name === settings.p1Color;
    btn.classList.toggle('selected', btn.dataset.name === settings.p2Color);
  }
}

function refreshBoardColorSelection() {
  const group = el('board-color-group');
  for (const btn of group.children) {
    btn.classList.toggle('selected', btn.dataset.name === settings.boardColor);
  }
}

function wireColorGroups() {
  el('p1-color-group').addEventListener('click', (e) => {
    const btn = e.target.closest('.swatch');
    if (!btn || btn.disabled) return;
    settings.p1Color = btn.dataset.name;
    refreshColorAvailability();
  });
  el('p2-color-group').addEventListener('click', (e) => {
    const btn = e.target.closest('.swatch');
    if (!btn || btn.disabled) return;
    settings.p2Color = btn.dataset.name;
    refreshColorAvailability();
  });
  el('board-color-group').addEventListener('click', (e) => {
    const btn = e.target.closest('.swatch');
    if (!btn) return;
    settings.boardColor = btn.dataset.name;
    refreshBoardColorSelection();
  });
}

// ===================== Menú: segmentados y toggles =====================

function wireSegmented(containerId, settingKey, onChange) {
  const container = el(containerId);
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.segment');
    if (!btn) return;
    settings[settingKey] = btn.dataset.value;
    refreshSegmented(containerId, settingKey);
    if (onChange) onChange();
  });
}

function refreshSegmented(containerId, settingKey) {
  const container = el(containerId);
  for (const btn of container.children) {
    btn.classList.toggle('active', btn.dataset.value === settings[settingKey]);
  }
}

function updateModeDependentUI() {
  const isPvc = settings.mode === 'pvc';
  el('difficulty-section').classList.toggle('hidden', !isPvc);
  el('label-p1').textContent = isPvc ? 'Tu color' : 'Color del jugador 1';
  el('label-p2').textContent = isPvc ? 'Color de la IA' : 'Color del jugador 2';
  const starterGroup = el('starter-group');
  starterGroup.children[1].textContent = isPvc ? 'La IA' : 'Jugador 2';
}

function applySettingsToMenuUI() {
  refreshSegmented('mode-group', 'mode');
  refreshSegmented('starter-group', 'starter');
  refreshSegmented('difficulty-group', 'difficulty');
  refreshColorAvailability();
  refreshBoardColorSelection();
  el('toggle-highlight').checked = settings.highlight;
  el('toggle-sound').checked = settings.sound;
  updateModeDependentUI();
}

// ===================== Partida nueva / continuar =====================

function buildSessionFromSettings() {
  const starter = settings.starter === 'random' ? (Math.random() < 0.5 ? 1 : 2) : Number(settings.starter);
  const humanSide = settings.mode === 'pvc' ? 1 : null;
  const p1ColorHex = Colors.PIECE_COLORS[settings.p1Color];
  const p2ColorHex = Colors.PIECE_COLORS[settings.p2Color];
  const neutronColor = Colors.pickNeutronColor([p1ColorHex, p2ColorHex]);
  const boardColorHex = Colors.BOARD_COLORS[settings.boardColor];
  const lineColor = Colors.pickLineColor(boardColorHex, [p1ColorHex, p2ColorHex, neutronColor]);
  return {
    state: Engine.createInitialState(starter),
    mode: settings.mode,
    difficulty: settings.difficulty,
    humanSide,
    p1ColorHex,
    p2ColorHex,
    boardColorHex,
    neutronColor,
    lineColor,
    history: [],
  };
}

function startNewGame() {
  Storage.saveSettings(settings);
  session = buildSessionFromSettings();
  selected = null;
  applyBoardTheme();
  showScreen('game');
  renderBoard();
  persist();
  maybeTriggerAi();
}

function resumeSavedGame() {
  const saved = Storage.loadGame();
  if (!saved) return;
  session = {
    state: saved.state,
    mode: saved.mode,
    difficulty: saved.difficulty,
    humanSide: saved.humanSide,
    p1ColorHex: saved.p1ColorHex,
    p2ColorHex: saved.p2ColorHex,
    boardColorHex: saved.boardColorHex,
    neutronColor: saved.neutronColor,
    lineColor: saved.lineColor,
    history: saved.history || [],
  };
  selected = null;
  applyBoardTheme();
  showScreen('game');
  renderBoard();
  maybeTriggerAi();
}

// ===================== Wiring general =====================

function wireMenuEvents() {
  wireColorGroups();
  wireSegmented('mode-group', 'mode', updateModeDependentUI);
  wireSegmented('starter-group', 'starter');
  wireSegmented('difficulty-group', 'difficulty');

  el('toggle-highlight').addEventListener('change', (e) => {
    settings.highlight = e.target.checked;
    Storage.saveSettings(settings);
  });
  el('toggle-sound').addEventListener('change', (e) => {
    settings.sound = e.target.checked;
    Audio.setEnabled(settings.sound);
    Storage.saveSettings(settings);
  });

  el('btn-play').addEventListener('click', startNewGame);
  el('btn-continue').addEventListener('click', resumeSavedGame);
  el('btn-rules').addEventListener('click', () => showOverlay('modal-rules'));
  el('btn-rules-game').addEventListener('click', () => showOverlay('modal-rules'));
  el('btn-close-rules').addEventListener('click', () => hideOverlay('modal-rules'));
}

function wireGameEvents() {
  boardEl.addEventListener('click', onBoardClick);
  btnUndo.addEventListener('click', onUndo);
  el('btn-new').addEventListener('click', startNewGame);
  el('btn-menu').addEventListener('click', () => { showScreen('menu'); refreshContinueButton(); });
  el('btn-end-new').addEventListener('click', () => { hideOverlay('modal-end'); startNewGame(); });
  el('btn-end-menu').addEventListener('click', () => {
    hideOverlay('modal-end');
    showScreen('menu');
    refreshContinueButton();
  });
  window.addEventListener('resize', () => { if (session) renderBoard(); });
}

// ===================== Arranque =====================

function init() {
  settings = Object.assign(defaultSettings(), Storage.loadSettings() || {});
  Audio.setEnabled(settings.sound);
  buildSwatchGroup(el('p1-color-group'), Colors.PIECE_COLORS);
  buildSwatchGroup(el('p2-color-group'), Colors.PIECE_COLORS);
  buildSwatchGroup(el('board-color-group'), Colors.BOARD_COLORS);
  applySettingsToMenuUI();
  wireMenuEvents();
  wireGameEvents();
  refreshContinueButton();
  showScreen('menu');
}

init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Si falla (por ejemplo, abierta como archivo local sin servidor), la app sigue andando igual.
    });
  });
}
