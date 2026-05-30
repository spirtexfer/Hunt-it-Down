// Drives the prey with the trained PPO network (a snapshot baked into the game as prey-policy.json).
// Self-contained: the observation builder and the forward pass below are copies of the ones used in
// training (rl/env.mjs + rl/policy.js), so in-game behaviour matches exactly what was learned. Falls
// back to the hand-coded heuristic until the weights finish loading.
import * as C from './config.js';
import { aiInput } from './ai.js';

const DIAG = Math.hypot(C.WORLD_W, C.WORLD_H);
const SPD = 16;                          // velocity normalizer (must match training)
const clamp1 = v => (v < -1 ? -1 : v > 1 ? 1 : v);

// the prey's movement-only action menu (identical to training's PREY_ACTIONS)
const PREY_ACTIONS = [
  [0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 0], [1, 0, 0, 0, 1, 0], [0, 1, 0, 0, 1, 0],
];

// the prey's 13-number view of the world, normalized to ~[-1, 1] (copy of training's observe())
function observe(self, other) {
  const cx = self.x + self.w / 2, cy = self.y + self.h / 2;
  const ox = other.x + other.w / 2, oy = other.y + other.h / 2;
  return [
    cx / C.WORLD_W * 2 - 1, cy / C.WORLD_H * 2 - 1,
    clamp1(self.vx / SPD), clamp1(self.vy / SPD),
    self.onGround ? 1 : 0, self.dashCharge / Math.max(1, self.dashMax || 1),
    ox / C.WORLD_W * 2 - 1, oy / C.WORLD_H * 2 - 1,
    clamp1(other.vx / SPD), clamp1(other.vy / SPD),
    clamp1((ox - cx) / C.WORLD_W), clamp1((oy - cy) / C.WORLD_H),
    Math.hypot(ox - cx, oy - cy) / DIAG,
  ];
}

// tiny MLP forward pass -> argmax action index (deterministic; copy of training's forward())
function forward(w, obs) {
  let x = obs;
  for (let i = 0; i < w.layers.length; i++) {
    const W = w.layers[i].W, b = w.layers[i].b, y = new Array(W.length);
    for (let o = 0; o < W.length; o++) {
      let s = b[o]; const row = W[o];
      for (let j = 0; j < row.length; j++) s += row[j] * x[j];
      y[o] = s;
    }
    if (i < w.layers.length - 1) for (let o = 0; o < y.length; o++) y[o] = Math.tanh(y[o]);
    x = y;
  }
  let best = 0; for (let i = 1; i < x.length; i++) if (x[i] > x[best]) best = i;
  return best;
}

let weights = null;
fetch(new URL('./prey-policy.json', import.meta.url)).then(r => r.json()).then(w => { weights = w; }).catch(() => {});

export function preyAI(prey, player) {
  if (!weights) return aiInput(prey, player);                  // heuristic until the network is ready
  const b = PREY_ACTIONS[forward(weights, observe(prey, player))];
  return { left: !!b[0], right: !!b[1], up: !!b[2], down: !!b[3], jump: !!b[4], dash: !!b[5] };
}
