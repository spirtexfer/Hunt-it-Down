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

// breakthrough: a high-energy neon explosion when the player phases up through a platform.
// Purely cosmetic — the platform itself is 100% intact. Built to feel GOOD.
export function phaseFx(x, y) {
  // small white core
  burst(x, y, 6, 'rgba(255,255,255,', 0, -0.3);
  // a modest sideways neon shatter — slower, smaller, shorter-lived
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1;
    const s = 2.5 + Math.random() * 5;
    const cyan = Math.random() < 0.4;
    parts.push({
      x: x + side * (Math.random() * 5),
      y: y + (Math.random() * 8 - 4),
      vx: side * s * (0.7 + Math.random() * 0.7),
      vy: (Math.random() * 2 - 1) * 1.6 - 0.3,
      life: 0, max: 10 + Math.random() * 14,
      col: cyan ? 'rgba(120,240,255,' : 'rgba(255,110,200,',
      size: 1.6 + Math.random() * 2.4, grav: 0.05,
    });
  }
  // one tight, fast-fading shockwave ring (small radius — doesn't sweep the screen)
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2, s = 2.4 + Math.random() * 1.8;
    parts.push({
      x, y, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s,
      life: 0, max: 11 + Math.random() * 8, col: 'rgba(255,160,220,', size: 1.8 + Math.random() * 1.8, grav: 0.03,
    });
  }
  // light shake only — no flash
  screen.trauma = Math.min(1, screen.trauma + 0.12);
}

export function updateParts() {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life++; p.vy += p.grav; p.x += p.vx; p.y += p.vy; p.vx *= 0.97;
    if (p.life >= p.max) parts.splice(i, 1);
  }
}

// player-dash flourish: the Celeste dash "snap" — hitstop + flash + screenshake + back-blast,
// turned up a notch. Juicy only for the player.
export function onPlayerDash(a, dx, dy) {
  screen.freeze = 4;                              // hitstop — the dash "snap", a touch longer
  screen.trauma = Math.min(1, screen.trauma + 0.5);
  screen.flash = Math.max(screen.flash, 0.14);    // quick bright dash flash (brief — it decays fast)
  const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
  burst(cx, cy, 18, 'rgba(255,90,170,', dx * -3, dy * -3); // directional pink spray
  burst(cx, cy, 6, 'rgba(255,255,255,', 0, 0);             // white core pop
  ring(cx, cy, 9, 'rgba(255,150,200,');
}

// ---------- background dust ----------
export const dust = [];
for (let i = 0; i < 90; i++) {
  dust.push({
    x: Math.random() * WORLD_W, y: Math.random() * WORLD_H,
    z: 0.2 + Math.random() * 0.8, s: 0.5 + Math.random() * 1.8, ph: Math.random() * Math.PI * 2,
  });
}
