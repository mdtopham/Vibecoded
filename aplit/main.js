import { CanvasRenderer } from './canvas_renderer.js';
import { createAssets, createInitialState, resetGame, updateGame, firePlayer } from './game_logic.js';

const canvas = document.getElementById('c');
const renderer = new CanvasRenderer(canvas);
const assets = createAssets();
const state = createInitialState(renderer.width, renderer.height);

const hud = {
  lives: document.getElementById('lives'),
  score: document.getElementById('score'),
  round: document.getElementById('round'),
  status: document.getElementById('status')
};

const input = {
  keys: Object.create(null),
  pointer: { x: innerWidth * 0.5, y: innerHeight * 0.5, down: false, id: null }
};

function syncHud() {
  hud.lives.textContent = String(state.lives);
  hud.score.textContent = String(state.score);
  hud.round.textContent = String(state.round);
  if (state.gameOver.active) hud.status.textContent = 'Game Over';
  else if (state.roundDelay > 0) hud.status.textContent = 'Preparing next round';
  else if (!state.ship.alive) hud.status.textContent = 'Respawning';
  else if (state.ship.invuln > 0) hud.status.textContent = 'Shielded';
  else if (state.alien) hud.status.textContent = 'Alien fly-by';
  else hud.status.textContent = 'Ready';
}

function updateStateSize() {
  state.width = renderer.width;
  state.height = renderer.height;
}

window.addEventListener('resize', () => {
  renderer.resize();
  updateStateSize();
});

window.addEventListener('keydown', e => {
  input.keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'Space') firePlayer(state, performance.now());
  else if (e.key === 'b' || e.key === 'B') renderer.bloomEnabled = !renderer.bloomEnabled;
  else if (e.key === 'c' || e.key === 'C') renderer.paletteOffset = (renderer.paletteOffset + 1) % renderer.palette.length;
  else if (e.key === 'r' || e.key === 'R') { resetGame(state); syncHud(); }
});
window.addEventListener('keyup', e => { input.keys[e.code] = false; });

function setPointer(e) {
  input.pointer.x = e.clientX;
  input.pointer.y = e.clientY;
}
function onPointerDown(e) {
  if (e.cancelable) e.preventDefault();
  if (state.gameOver.active) {
    resetGame(state);
    syncHud();
    return;
  }
  setPointer(e);
  input.pointer.down = true;
  input.pointer.id = e.pointerId;
  firePlayer(state, performance.now());
}
function onPointerMove(e) {
  if (input.pointer.id !== null && e.pointerId !== input.pointer.id) return;
  if (e.cancelable) e.preventDefault();
  setPointer(e);
}
function onPointerUp(e) {
  if (input.pointer.id !== null && e.pointerId !== input.pointer.id) return;
  if (e.cancelable) e.preventDefault();
  input.pointer.down = false;
  input.pointer.id = null;
}
canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
canvas.addEventListener('pointermove', onPointerMove, { passive: false });
canvas.addEventListener('pointerup', onPointerUp, { passive: false });
canvas.addEventListener('pointercancel', onPointerUp, { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('selectstart', e => e.preventDefault());

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  updateGame(state, input, assets, dt, now);
  syncHud();
  renderer.drawScene(state, assets, now / 1000);
  requestAnimationFrame(frame);
}

resetGame(state);
syncHud();
requestAnimationFrame(frame);