// Persistencia local: última configuración elegida y partida en curso (autoguardado).

const SETTINGS_KEY = 'neutron.settings.v1';
const GAME_KEY = 'neutron.game.v1';

function safeGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // localStorage puede no estar disponible (modo privado); el juego sigue andando sin guardar.
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    // ignorado
  }
}

function loadSettings() {
  return safeGet(SETTINGS_KEY);
}

function saveSettings(settings) {
  safeSet(SETTINGS_KEY, settings);
}

function loadGame() {
  return safeGet(GAME_KEY);
}

function saveGame(gameSnapshot) {
  safeSet(GAME_KEY, gameSnapshot);
}

function clearGame() {
  safeRemove(GAME_KEY);
}

export {
  loadSettings, saveSettings, loadGame, saveGame, clearGame,
};
