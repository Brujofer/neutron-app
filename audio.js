// Sonidos sintetizados con Web Audio API, sin archivos externos.

let ctx = null;
function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, duration, { type = 'sine', gain = 0.18, delay = 0 } = {}) {
  const c = getCtx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = c.currentTime + delay;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

const SOUNDS = {
  slide: () => tone(520, 0.1, { type: 'triangle', gain: 0.1 }),
  collide: () => tone(180, 0.14, { type: 'square', gain: 0.14 }),
  turn: () => tone(660, 0.09, { type: 'sine', gain: 0.12 }),
  invalid: () => tone(140, 0.12, { type: 'sawtooth', gain: 0.1 }),
  win: () => {
    tone(523, 0.16, { type: 'triangle', gain: 0.18, delay: 0 });
    tone(659, 0.16, { type: 'triangle', gain: 0.18, delay: 0.12 });
    tone(784, 0.26, { type: 'triangle', gain: 0.2, delay: 0.24 });
  },
  lose: () => {
    tone(392, 0.18, { type: 'sawtooth', gain: 0.16, delay: 0 });
    tone(330, 0.18, { type: 'sawtooth', gain: 0.16, delay: 0.14 });
    tone(220, 0.3, { type: 'sawtooth', gain: 0.16, delay: 0.28 });
  },
};

let enabled = true;
function setEnabled(value) { enabled = value; }
function play(name) {
  if (!enabled) return;
  const fn = SOUNDS[name];
  if (!fn) return;
  try { fn(); } catch (err) { /* el audio no debe romper el juego */ }
}

export { play, setEnabled };
