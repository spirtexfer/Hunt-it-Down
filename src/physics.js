// Actor model + the shared movement step (used by both player and prey). Collision is AABB vs
// the level's solids, resolved X then Y. The player's bounce / dive-bounce techs live in moveX/moveY.
import * as C from './config.js';
import { solidAt, platAt } from './level.js';
import { screen } from './state.js';
import { burst, ring, onPlayerDash, phaseFx } from './fx.js';

export const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
export const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));

export function makeActor(x, y, w, h, spd) {
  return {
    x, y, px: x, py: y, vx: 0, vy: 0, w, h, spd,
    fricG: C.FRICTION_G, fricA: C.FRICTION_A, gravMult: 1,
    onGround: false, wallL: false, wallR: false, wallSlide: false,
    dashTime: 0, dashDX: 0, dashDY: 0, dashCharge: 3, dashMax: 3, dashRegen: 0.025,
    coyote: 0, jumpBuf: 0, jumpCut: false, varLock: 0, facing: 1,
    trail: [], pInp: {}, aiDashCD: 0, invuln: 0, bounce: 0, inL: false, inR: false,
    diveArmed: false, diveDist: 0, phasing: false, lastPhasePlat: null, trailLen: 11,
  };
}

// distance (px) from an actor's feet straight down to the nearest floor (0 if standing on one).
function floorDistBelow(a) {
  for (let d = 0; d <= C.WORLD_H; d += 4) {
    if (solidAt(a.x + 2, a.y + a.h + d, a.w - 4, 2)) return d;
  }
  return C.WORLD_H;
}

function moveX(a) {
  a.x += a.vx;
  const s = solidAt(a.x, a.y + 1, a.w, a.h - 2, a.phasing);
  if (s) {
    const into = a.vx > 0;
    if (into) a.x = s.x - a.w; else a.x = s.x + s.w;
    if (a.bounce > 0 && Math.abs(a.vx) > 2) {
      const v0 = Math.abs(a.vx);
      a.vx = -a.vx * a.bounce;                      // always bounce off the wall
      if (v0 > 7) {
        screen.trauma = Math.min(1, screen.trauma + 0.16);
        burst(a.x + (into ? a.w : 0), a.y + a.h / 2, 9, 'rgba(255,120,190,', (into ? -1 : 1) * 2, 0);
      }
    } else {
      a.vx = 0;
    }
  }
}

function moveY(a) {
  a.y += a.vy;
  const s = solidAt(a.x + 1, a.y, a.w - 2, a.h, a.phasing);
  if (s) {
    if (a.vy > 0) {
      a.y = s.y - a.h;
      // dive-bounce / hyperdash: an armed downward dash converts the moment it meets a floor.
      //   - diagonal: skims purely horizontal when launched from the ground, gaining more upward
      //     bounce the higher you were when you dashed (a hyperbolized Celeste hyperdash).
      //   - pure-straight-down: a fixed vertical stomp-bounce (trampoline).
      if (a.bounce > 0 && a.diveArmed && a.dashDY > 0.35) {
        const pureDown = Math.abs(a.dashDX) < 0.35;
        const t = clamp(a.diveDist / C.DIVE_HEIGHT_RANGE, 0, 1);   // 0 on the ground -> 1 at full height
        if (pureDown) {
          a.vy = -C.DIVE_PURE_VEL;
        } else {
          a.vy = -C.DIVE_VERT_MAX * t;                            // verticality scales with launch height
          a.vx = Math.sign(a.dashDX) * C.DIVE_HYPER_SPEED * a.spd; // strong horizontal skim
        }
        a.diveArmed = false;
        a.dashTime = 0;                             // dash spent — you keep this exit velocity
        a.coyote = 0; a.jumpCut = false;
        screen.trauma = Math.min(1, screen.trauma + (pureDown ? 0.45 : 0.28 + 0.22 * t));
        burst(a.x + a.w / 2, a.y + a.h, pureDown ? 16 : 12, 'rgba(255,120,190,', pureDown ? 0 : Math.sign(a.dashDX) * 2, -2);
        ring(a.x + a.w / 2, a.y + a.h, 10, 'rgba(255,180,220,');
        return;
      }
    } else if (a.vy < 0) {
      a.y = s.y + s.h;
    }
    a.vy = 0;
  }
}

function probe(a) {
  a.onGround = !!solidAt(a.x + 2, a.y + a.h, a.w - 4, 2, a.phasing);
  a.wallL = !!solidAt(a.x - 2, a.y + 4, 2, a.h - 8, a.phasing);
  a.wallR = !!solidAt(a.x + a.w, a.y + 4, 2, a.h - 8, a.phasing);
}

// onDash flourish is juicy only for the player
export function step(a, inp, isPlayer) {
  const p = a.pInp;
  const jp = !!inp.jump && !p.jump;
  const dp = !!inp.dash && !p.dash;
  const spd = a.spd;

  a.dashCharge = Math.min(a.dashMax, a.dashCharge + a.dashRegen);
  a.aiDashCD = Math.max(0, a.aiDashCD - 1);
  a.invuln = Math.max(0, a.invuln - 1);
  if (jp) a.jumpBuf = C.JUMP_BUFFER;

  // start dash
  if (dp && a.dashCharge >= 1 && a.dashTime === 0) {
    let dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    let dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    if (dx === 0 && dy === 0) dx = a.facing;
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    a.vx = dx * C.DASH_SPEED * spd; a.vy = dy * C.DASH_SPEED * spd;
    a.dashDX = dx; a.dashDY = dy; a.dashTime = C.DASH_TIME; a.dashCharge -= 1;
    // arm the dive-bounce on a downward dash, capturing how high above the floor we launched from
    if (a.bounce > 0 && dy > 0.35) { a.diveArmed = true; a.diveDist = floorDistBelow(a); }
    else a.diveArmed = false;
    // phase through floating platforms while dashing upward (boundary walls stay solid)
    a.phasing = dy < -0.35;
    if (dx !== 0) a.facing = Math.sign(dx);
    if (isPlayer) onPlayerDash(a, dx, dy);
    else burst(a.x + a.w / 2, a.y + a.h / 2, 8, 'rgba(150,240,255,', dx * -3, dy * -3);
  }

  // jump (ground/coyote or wall)
  if (a.jumpBuf > 0) {
    if (a.coyote > 0 && a.dashTime === 0) {
      a.vy = C.JUMP_VEL; a.jumpBuf = 0; a.coyote = 0; a.jumpCut = true;
      if (isPlayer) burst(a.x + a.w / 2, a.y + a.h, 6, 'rgba(255,150,200,', 0, 1.5);
    } else if ((a.wallL || a.wallR) && a.dashTime === 0 && !a.onGround) {
      const away = a.wallL ? 1 : -1;
      a.vx = away * C.WALLJUMP_X * spd; a.vy = C.WALLJUMP_VY; a.varLock = C.WALLJUMP_LOCK;
      a.jumpBuf = 0; a.jumpCut = true; a.facing = away;
      if (isPlayer) burst(a.x + (away > 0 ? 0 : a.w), a.y + a.h / 2, 8, 'rgba(255,140,200,', away * 2, 0);
    }
  }

  if (a.dashTime > 0) {
    a.dashTime--;
    if (a.dashTime === 0) {
      a.vx *= C.DASH_END_KEEP;
      a.vy = a.vy < 0 ? a.vy * C.DASH_END_KEEP : a.vy * 0.55;
    }
  } else {
    // horizontal
    if (a.varLock > 0) { a.varLock--; }
    else {
      const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      if (dir !== 0) {
        a.facing = dir;
        const ac = a.onGround ? C.RUN_ACCEL : C.AIR_ACCEL;
        const cap = C.MAX_RUN * spd;
        if (Math.sign(a.vx) === dir) {
          // same direction: only accelerate up to base run; never brake past current speed
          const target = dir * Math.max(cap, Math.abs(a.vx));
          a.vx = approach(a.vx, target, ac);
        } else if (Math.abs(a.vx) < cap) {
          // opposite direction at low speed: turn around normally
          a.vx = approach(a.vx, dir * cap, ac);
        } else {
          // opposite direction at high momentum: brake at base accel (toward 0, not reverse)
          a.vx = approach(a.vx, 0, ac);
        }
      } else {
        a.vx = approach(a.vx, 0, a.onGround ? a.fricG : a.fricA);
      }
    }
    // gravity
    a.vy += C.GRAVITY * a.gravMult; if (a.vy > C.MAX_FALL) a.vy = C.MAX_FALL;
    a.wallSlide = false;
    // variable jump cut
    if (!inp.jump && a.vy < 0 && a.jumpCut) { a.vy *= C.JUMP_CUT; a.jumpCut = false; }
  }

  // integrate
  a.inL = !!inp.left; a.inR = !!inp.right;
  a.px = a.x; a.py = a.y;
  moveX(a); moveY(a); probe(a);

  // phase-through: spawn a breakthrough effect each time we punch into a new platform, and stop
  // phasing once the up-dash is over and we've fully cleared the platform we passed through.
  if (a.phasing) {
    const onPlat = platAt(a.x, a.y, a.w, a.h);
    if (onPlat && onPlat !== a.lastPhasePlat && a.bounce > 0) {
      phaseFx(a.x + a.w / 2, onPlat.y + onPlat.h / 2);
    }
    a.lastPhasePlat = onPlat || null;
    if (a.dashTime === 0 && !onPlat) a.phasing = false;
  }

  // post
  if (a.onGround) a.coyote = C.COYOTE;
  else a.coyote = Math.max(0, a.coyote - 1);
  a.jumpBuf = Math.max(0, a.jumpBuf - 1);

  // trail
  a.trail.push({ x: a.x + a.w / 2, y: a.y + a.h / 2 });
  while (a.trail.length > a.trailLen) a.trail.shift();

  a.pInp = { jump: !!inp.jump, dash: !!inp.dash, left: !!inp.left, right: !!inp.right, up: !!inp.up, down: !!inp.down };
}
