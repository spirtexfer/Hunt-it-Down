// Orchestration: run lifecycle (reset/catch/win), input, and the fixed-timestep loop that drives
// the simulation and hands an interpolation alpha to the renderer.
import * as C from './config.js';
import { spawns } from './level.js';
import { game, screen } from './state.js';
import { cv, resize } from './view.js';
import { parts, updateParts, burst, ring } from './fx.js';
import { makeActor, step, clamp } from './physics.js';
import { aiInput } from './ai.js';
import { render } from './render.js';

// ---------- best-time persistence ----------
function loadBest() { try { const v = localStorage.getItem('afterimage_best'); return v ? parseFloat(v) : null; } catch (e) { return null; } }
function saveBest(t) { try { localStorage.setItem('afterimage_best', String(t)); } catch (e) {} }
game.best = loadBest();

// ---------- run lifecycle ----------
function reset() {
  game.player = makeActor(120, C.WORLD_H - 130, 24, 34, 1);
  game.prey = makeActor(C.WORLD_W - 180, C.WORLD_H - 130, 22, 30, 1);
  const { player, prey } = game;
  player.dashMax = C.PLAYER_DASH_MAX; player.dashRegen = C.PLAYER_DASH_REGEN; player.dashCharge = C.PLAYER_DASH_MAX;
  player.fricG = C.PLAYER_FRIC_G; player.fricA = C.PLAYER_FRIC_A; player.gravMult = 0.9; player.bounce = C.PLAYER_BOUNCE; // you slide, float & bounce
  player.trailLen = 22;                                    // longer afterimage tail than the prey
  prey.dashMax = 0; prey.dashCharge = 0;                    // prey can't dash — it just runs fast
  prey.spd = C.PREY_SPEED_MULT; prey.invuln = 20;
  game.cam.x = clamp(player.x - C.VIEW_W / 2, 0, C.WORLD_W - C.VIEW_W);
  game.cam.y = clamp(player.y - C.VIEW_H / 2, 0, C.WORLD_H - C.VIEW_H);
  game.caught = 0; game.ticks = 0; game.won = false; game.running = true;
  screen.trauma = 0; screen.flash = 0; screen.freeze = 0;
  parts.length = 0;
}

function farSpawn() {
  let best = spawns[0], bd = -1;
  for (const s of spawns) {
    const d = Math.hypot(s.x - game.player.x, s.y - game.player.y);
    if (d > bd) { bd = d; best = s; }
  }
  return best;
}

function onCatch() {
  game.caught++;
  screen.trauma = 1; screen.flash = 1; screen.freeze = 8;
  const { prey } = game;
  const cx = prey.x + prey.w / 2, cy = prey.y + prey.h / 2;
  ring(cx, cy, 30, 'rgba(180,245,255,');
  burst(cx, cy, 26, 'rgba(255,255,255,');
  if (game.caught >= C.TARGET) { winGame(); return; }
  const s = farSpawn();
  prey.x = s.x; prey.y = s.y; prey.vx = 0; prey.vy = 0; prey.dashTime = 0; prey.invuln = 34;
  prey.spd = Math.min(C.PREY_SPEED_CAP, C.PREY_SPEED_MULT + game.caught * C.PREY_SPEED_GROWTH);
  prey.trail.length = 0;
}

function winGame() {
  game.running = false; game.won = true;
  const t = game.ticks / 60;
  let line = '';
  if (game.best === null || t < game.best) { game.best = t; saveBest(t); line = 'NEW BEST'; }
  else line = 'best  ' + game.best.toFixed(2) + 's';
  document.getElementById('endTime').textContent = t.toFixed(2);
  document.getElementById('bestLine').textContent = line;
  document.getElementById('end').classList.remove('hidden');
}

// ---------- input ----------
const keys = {};
// W = jump (and "up" for dash aiming) ; A/D move ; S aim down ; Space = dash
const map = {
  KeyA: ['left'], KeyD: ['right'],
  KeyW: ['up', 'jump'],
  KeyS: ['down'],
  Space: ['dash'],
};
function startGame() {
  document.getElementById('title').classList.add('hidden');
  document.getElementById('end').classList.add('hidden');
  game.started = true; reset();
}
addEventListener('keydown', e => {
  if (e.code === 'KeyR') { if (game.started) { document.getElementById('end').classList.add('hidden'); reset(); } e.preventDefault(); return; }
  if (!game.started) { startGame(); e.preventDefault(); return; }
  if (game.won) return;
  const acts = map[e.code];
  if (acts) { for (const a of acts) keys[a] = true; e.preventDefault(); }
});
addEventListener('keyup', e => { const acts = map[e.code]; if (acts) { for (const a of acts) keys[a] = false; e.preventDefault(); } });
cv.addEventListener('pointerdown', () => { if (!game.started) startGame(); });
document.getElementById('title').addEventListener('pointerdown', () => { if (!game.started) startGame(); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// ---------- loop ----------
const STEP = 1000 / 60;
let acc = 0, last = performance.now();
function frame(now) {
  let dt = now - last; last = now;
  if (dt > 100) dt = 100;        // tab-switch guard
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 5) { tick(); acc -= STEP; n++; }
  render(acc / STEP);
  requestAnimationFrame(frame);
}
function tick() {
  if (screen.trauma > 0) screen.trauma = Math.max(0, screen.trauma - 0.045);
  if (screen.flash > 0) screen.flash = Math.max(0, screen.flash - 0.06);
  if (!game.running) { updateParts(); return; }
  if (screen.freeze > 0) { screen.freeze--; updateParts(); return; }

  game.ticks++;
  const { player, prey } = game;
  const pin = { left: !!keys.left, right: !!keys.right, up: !!keys.up, down: !!keys.down, jump: !!keys.jump, dash: !!keys.dash };
  step(player, pin, true);
  step(prey, aiInput(prey, player), false);

  // catch test (small margin so high-speed fly-bys still register)
  const M = 5;
  if (prey.invuln === 0 &&
      player.x < prey.x + prey.w + M && player.x + player.w > prey.x - M &&
      player.y < prey.y + prey.h + M && player.y + player.h > prey.y - M) {
    onCatch();
  }

  // camera follow (player, biased slightly toward prey)
  const midx = player.x * 0.7 + prey.x * 0.3 + player.w / 2;
  const midy = player.y * 0.8 + prey.y * 0.2 + player.h / 2;
  const tx = clamp(midx - C.VIEW_W / 2, 0, C.WORLD_W - C.VIEW_W);
  const ty = clamp(midy - C.VIEW_H / 2, 0, C.WORLD_H - C.VIEW_H);
  game.cam.x += (tx - game.cam.x) * 0.12; game.cam.y += (ty - game.cam.y) * 0.12;

  updateParts();
}

// ---------- bootstrap ----------
document.getElementById('targetTxt').textContent = C.TARGET;
resize();
requestAnimationFrame(frame);
