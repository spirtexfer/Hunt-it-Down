// All drawing: background, parallax dust, arena, particles, actors (with trail/motion-blur/
// squash-stretch), the off-screen prey indicator, cinematic speed bars, and the HUD.
import * as C from './config.js';
import { walls, plats, WALL_T } from './level.js';
import { game, screen } from './state.js';
import { cv, ctx, view } from './view.js';
import { parts, dust } from './fx.js';
import { clamp } from './physics.js';

export const lerp = (a, b, t) => a + (b - a) * t;

export function render(alpha) {
  const { scale, offX, offY, dpr } = view;
  const W = cv.width, H = cv.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // screen-space transform (logical 960x540 -> device, letterboxed)
  const sh = (screen.trauma * screen.trauma) * 16;
  const shx = (Math.random() * 2 - 1) * sh, shy = (Math.random() * 2 - 1) * sh;
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offX * dpr, offY * dpr);

  // background gradient (screen space)
  const g = ctx.createLinearGradient(0, 0, 0, C.VIEW_H);
  g.addColorStop(0, '#0c0518'); g.addColorStop(.55, '#150826'); g.addColorStop(1, '#070310');
  ctx.fillStyle = g; ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);

  const camx = game.cam.x, camy = game.cam.y;

  // dust parallax (screen space using cam)
  ctx.save();
  for (const d of dust) {
    const px = ((d.x - camx * d.z) % C.WORLD_W + C.WORLD_W) % C.WORLD_W;
    const py = ((d.y - camy * d.z) % C.WORLD_H + C.WORLD_H) % C.WORLD_H;
    if (px < -5 || px > C.VIEW_W + 5 || py < -5 || py > C.VIEW_H + 5) continue;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(d.ph + game.ticks * 0.02));
    ctx.fillStyle = 'rgba(200,170,230,' + (0.10 + 0.25 * d.z * tw) + ')';
    ctx.fillRect(px, py, d.s, d.s);
  }
  ctx.restore();

  // world space
  ctx.save();
  ctx.translate(-camx + shx, -camy + shy);

  // boundary box — solid walls so the arena edges read clearly
  for (const wll of walls) {
    const wg = ctx.createLinearGradient(wll.x, wll.y, wll.x, wll.y + wll.h);
    wg.addColorStop(0, '#0e0720'); wg.addColorStop(1, '#1a0d2e');
    ctx.fillStyle = wg; ctx.fillRect(wll.x, wll.y, wll.w, wll.h);
  }
  // glowing inner frame around the play area
  ctx.save();
  ctx.strokeStyle = 'rgba(255,90,170,0.6)'; ctx.lineWidth = 3;
  ctx.shadowColor = '#ff3a8c'; ctx.shadowBlur = 14;
  ctx.strokeRect(WALL_T, WALL_T, C.WORLD_W - 2 * WALL_T, C.WORLD_H - 2 * WALL_T);
  ctx.restore();

  // platforms
  for (const p of plats) {
    ctx.fillStyle = '#1c1130';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = 'rgba(255,90,170,0.55)';
    ctx.fillRect(p.x, p.y, p.w, 2);                 // neon top edge
    ctx.fillStyle = 'rgba(95,232,255,0.06)';
    ctx.fillRect(p.x, p.y + 2, p.w, 5);
  }

  // particles
  drawParts();

  // actors only exist once a game has started
  const { player, prey } = game;
  if (player && prey) {
    const prx = lerp(prey.px, prey.x, alpha), pry = lerp(prey.py, prey.y, alpha);
    const plx = lerp(player.px, player.x, alpha), ply = lerp(player.py, player.y, alpha);

    drawActor(prey, prx, pry, '#5fe8ff', 'rgba(95,232,255,', true);
    drawActor(player, plx, ply, '#ff3a8c', 'rgba(255,58,140,', false);

    ctx.restore();
    // off-screen prey indicator (screen space, transform restored)
    drawIndicator(prx + prey.w / 2, pry + prey.h / 2);
  } else {
    ctx.restore();
  }

  // catch flash (screen)
  if (screen.flash > 0) {
    ctx.fillStyle = 'rgba(220,245,255,' + (screen.flash * 0.6) + ')';
    ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
  }

  // vignette
  const vg = ctx.createRadialGradient(C.VIEW_W / 2, C.VIEW_H / 2, C.VIEW_H * 0.35, C.VIEW_W / 2, C.VIEW_H / 2, C.VIEW_H * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);

  // cinematic speed bars — close in the faster you fly
  let barTarget = 0;
  if (player && game.started) {
    const sp = Math.hypot(player.vx, player.vy);
    barTarget = clamp((sp - 6) / 11, 0, 1) * 50;     // ramps in only when you're really moving
  }
  // asymmetric ease — slow on the way in, slower on the way out (no snap)
  const easeIn = 0.045, easeOut = 0.025;
  screen.bars += (barTarget - screen.bars) * (barTarget > screen.bars ? easeIn : easeOut);

  // never let bars cover the player — leave a safety gap
  if (player && game.started) {
    const psy = (player.y - game.cam.y) - 14;                 // player's top in screen space (with headroom)
    const pby = C.VIEW_H - ((player.y + player.h) - game.cam.y) - 14;
    const safe = Math.min(psy, pby);
    if (screen.bars > safe) screen.bars = Math.max(0, safe);
  }

  if (screen.bars > 0.5) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, C.VIEW_W, screen.bars);
    ctx.fillRect(0, C.VIEW_H - screen.bars, C.VIEW_W, screen.bars);
    ctx.fillStyle = 'rgba(255,90,170,0.35)';
    ctx.fillRect(0, screen.bars - 1, C.VIEW_W, 1.2);
    ctx.fillRect(0, C.VIEW_H - screen.bars, C.VIEW_W, 1.2);
  }

  // HUD
  if (game.started) drawHUD();
}

function drawParts() {
  for (const p of parts) {
    const a = 1 - p.life / p.max;
    ctx.fillStyle = p.col + (a * 0.9) + ')';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2); ctx.fill();
  }
}

function drawActor(a, x, y, core, glow, isPrey) {
  const cx = x + a.w / 2, cy = y + a.h / 2;
  // trail / afterimages
  for (let i = 0; i < a.trail.length; i++) {
    const t = a.trail[i], k = i / a.trail.length;
    const al = (a.dashTime > 0 ? 0.40 : 0.22) * k;
    ctx.fillStyle = glow + al + ')';
    const r = (a.w * 0.42) * k;
    ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2); ctx.fill();
  }
  // motion blur — smear across this tick's travel, scales with speed
  const sm = Math.hypot(a.vx, a.vy);
  if (sm > 3) {
    const copies = Math.min(14, Math.round(sm / 1.1));
    ctx.fillStyle = core;
    for (let k = 1; k <= copies; k++) {
      const f = k / (copies + 1);
      ctx.globalAlpha = 0.40 * (1 - f);
      roundRect(cx - a.vx * f - a.w / 2, cy - a.vy * f - a.h / 2, a.w, a.h, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // squash/stretch
  let sx = 1 + clamp(Math.abs(a.vx) * 0.012, 0, 0.35) - clamp(Math.abs(a.vy) * 0.006, 0, 0.18);
  let sy = 1 + clamp(Math.abs(a.vy) * 0.012, 0, 0.35) - clamp(Math.abs(a.vx) * 0.006, 0, 0.18);
  if (a.dashTime > 0) { sx = 1 + Math.abs(a.dashDX) * 0.4; sy = 1 + Math.abs(a.dashDY) * 0.4; }

  ctx.save();
  ctx.translate(cx, cy);
  // glow halo
  ctx.shadowColor = core; ctx.shadowBlur = isPrey ? 22 : 26;
  ctx.scale(sx, sy);
  // body
  const w = a.w, h = a.h;
  roundRect(-w / 2, -h / 2, w, h, 7);
  const bg = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  if (isPrey) { bg.addColorStop(0, '#e9ffff'); bg.addColorStop(1, '#5fe8ff'); }
  else { bg.addColorStop(0, '#ff8fc4'); bg.addColorStop(.5, '#ff3a8c'); bg.addColorStop(1, '#5a0f33'); }
  ctx.fillStyle = bg; ctx.fill();
  ctx.shadowBlur = 0;
  // eyes
  const ex = a.facing * 3.2;
  ctx.fillStyle = isPrey ? '#0a2a30' : '#1a0010';
  ctx.beginPath(); ctx.arc(ex - 3.4, -3, 1.7, 0, 7); ctx.arc(ex + 3.4, -3, 1.7, 0, 7); ctx.fill();
  ctx.restore();

  // dash charge bar (player only) — segments fill as the bar regenerates
  if (!isPrey) {
    const segs = a.dashMax, gap = 2, bw = Math.max(a.w + 8, segs * 8);
    const seg = (bw - (segs - 1) * gap) / segs, by = y - 13, bx0 = cx - bw / 2;
    for (let i = 0; i < segs; i++) {
      const sx0 = bx0 + i * (seg + gap);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(sx0, by, seg, 4);
      const f = clamp(a.dashCharge - i, 0, 1);
      if (f > 0) {
        ctx.fillStyle = f >= 1 ? '#ff7ab8' : 'rgba(255,122,184,0.65)';
        if (f >= 1) { ctx.shadowColor = core; ctx.shadowBlur = 7; }
        ctx.fillRect(sx0, by, seg * f, 4);
        ctx.shadowBlur = 0;
      }
    }
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawIndicator(tx, ty) {
  const sx = tx - game.cam.x, sy = ty - game.cam.y;
  if (sx > 12 && sx < C.VIEW_W - 12 && sy > 12 && sy < C.VIEW_H - 12) return; // on screen
  const m = 26;
  const ax = clamp(sx, m, C.VIEW_W - m), ay = clamp(sy, m, C.VIEW_H - m);
  const ang = Math.atan2(sy - C.VIEW_H / 2, sx - C.VIEW_W / 2);
  ctx.save();
  ctx.translate(ax, ay); ctx.rotate(ang);
  ctx.fillStyle = 'rgba(95,232,255,0.92)'; ctx.shadowColor = '#5fe8ff'; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -7); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawHUD() {
  const { scale, offX, offY, dpr } = view;
  ctx.save();
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offX * dpr, offY * dpr);
  // catch pips
  const pad = 18;
  ctx.font = '700 14px Chakra Petch, monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(230,210,245,0.65)';
  ctx.fillText('CAUGHT', pad, pad);
  for (let i = 0; i < C.TARGET; i++) {
    const x = pad + i * 15, y = pad + 20;
    if (i < game.caught) { ctx.fillStyle = '#5fe8ff'; ctx.shadowColor = '#5fe8ff'; ctx.shadowBlur = 8; }
    else { ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.shadowBlur = 0; }
    ctx.beginPath(); ctx.arc(x + 4, y + 4, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;
  // timer
  ctx.textAlign = 'right';
  ctx.font = '700 26px Chakra Petch, monospace';
  ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(255,58,140,.5)'; ctx.shadowBlur = 12;
  ctx.fillText((game.ticks / 60).toFixed(2), C.VIEW_W - pad, pad - 2);
  ctx.shadowBlur = 0;
  ctx.font = '600 11px Chakra Petch, monospace';
  ctx.fillStyle = 'rgba(200,170,230,.6)';
  ctx.fillText(game.best != null ? 'BEST ' + game.best.toFixed(2) : 'BEST --', C.VIEW_W - pad, pad + 28);
  ctx.textAlign = 'left';
  ctx.restore();
}
