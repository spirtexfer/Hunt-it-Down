// Juice: particle bursts/rings, the player-dash flourish, and the parallax dust field.
// Mutates screen-feel state (trauma/freeze) but has no dependency on physics or render.
import { WORLD_W, WORLD_H } from './config.js';
import { screen } from './state.js';

export const parts = [];

export function burst(x, y, n, colPrefix, bx = 0, by = 0) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 4.5;
    parts.push({
      x, y, vx: Math.cos(a) * s + bx, vy: Math.sin(a) * s + by - 1,
      life: 0, max: 18 + Math.random() * 22, col: colPrefix, size: 2 + Math.random() * 3, grav: 0.18,
    });
  }
}

export function ring(x, y, n, colPrefix) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, s = 4 + Math.random() * 5;
    parts.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0, max: 26 + Math.random() * 16, col: colPrefix, size: 3 + Math.random() * 4, grav: 0.05,
    });
  }
}

export function updateParts() {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life++; p.vy += p.grav; p.x += p.vx; p.y += p.vy; p.vx *= 0.97;
    if (p.life >= p.max) parts.splice(i, 1);
  }
}

// player-dash flourish: brief freeze + screenshake + back-blast (juicy only for the player)
export function onPlayerDash(a, dx, dy) {
  screen.freeze = 3;
  screen.trauma = Math.min(1, screen.trauma + 0.55);
  burst(a.x + a.w / 2, a.y + a.h / 2, 12, 'rgba(255,90,170,', dx * -2.5, dy * -2.5);
}

// ---------- background dust ----------
export const dust = [];
for (let i = 0; i < 90; i++) {
  dust.push({
    x: Math.random() * WORLD_W, y: Math.random() * WORLD_H,
    z: 0.2 + Math.random() * 0.8, s: 0.5 + Math.random() * 1.8, ph: Math.random() * Math.PI * 2,
  });
}
