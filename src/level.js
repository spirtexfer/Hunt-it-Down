// Arena geometry: collidable boundary box + floating ledges, prey spawn points, and the
// broadphase-free AABB query everything uses for collision.
//
// Layout: a 180° point-symmetric field — a left half + its exact rotation as the right half, on an
// even 75px vertical ladder, plus long shelves and centred top/bottom ledges.
import { WORLD_W, WORLD_H } from './config.js';

export const WALL_T = 24;

export const walls = [
  { x: 0, y: 0, w: WALL_T, h: WORLD_H },                  // left wall
  { x: WORLD_W - WALL_T, y: 0, w: WALL_T, h: WORLD_H },   // right wall
  { x: 0, y: 0, w: WORLD_W, h: WALL_T },                  // ceiling
  { x: 0, y: WORLD_H - WALL_T, w: WORLD_W, h: WALL_T },   // floor
];

export const plats = [
  // Equal width (160); 6 columns evenly spaced; even 75px vertical ladder (R4 == C2 == 415).
  // LEFT half
  { x: 329, y: 176.5, w: 160, h: 22 },   // L1
  { x: 65,  y: 251.5, w: 160, h: 22 },   // L2
  { x: 329, y: 326.5, w: 424, h: 22 },   // L3 (long shelf)
  { x: 65,  y: 476.5, w: 160, h: 22 },   // L4
  { x: 593, y: 476.5, w: 160, h: 22 },   // L5
  { x: 329, y: 551.5, w: 160, h: 22 },   // L6
  { x: 65,  y: 626.5, w: 160, h: 22 },   // L7
  { x: 593, y: 626.5, w: 160, h: 22 },   // L8
  { x: 329, y: 701.5, w: 160, h: 22 },   // L9
  { x: 65,  y: 776.5, w: 160, h: 22 },   // L10
  // RIGHT half — 180° point-reflection of the left half
  { x: 1375, y: 101.5, w: 160, h: 22 },  // R1
  { x: 1111, y: 176.5, w: 160, h: 22 },  // R2
  { x: 847,  y: 251.5, w: 160, h: 22 },  // R3
  { x: 1375, y: 251.5, w: 160, h: 22 },  // R4
  { x: 1111, y: 326.5, w: 160, h: 22 },  // R5
  { x: 847,  y: 401.5, w: 160, h: 22 },  // R6
  { x: 1375, y: 401.5, w: 160, h: 22 },  // R7
  { x: 847,  y: 551.5, w: 424, h: 22 },  // R8 (long shelf)
  { x: 1375, y: 626.5, w: 160, h: 22 },  // R9
  { x: 1111, y: 701.5, w: 160, h: 22 },  // R10
  // CENTRE long platforms (centered on x800)
  { x: 593, y: 101.5, w: 414, h: 22 },   // C1 (top)
  { x: 593, y: 776.5, w: 414, h: 22 },   // C2 (bottom)
];

export const solids = walls.concat(plats);

// prey spawn points (one just above a ledge), spread across the whole arena.
// Interior spawn points only — each sits on a mid-map platform with room to flee in multiple
// directions, so the prey is never dumped into a walled-off corner (which would give it no chance).
export const spawns = [
  { x: 450, y: 296 }, { x: 662, y: 446 }, { x: 398, y: 521 }, { x: 662, y: 596 }, { x: 398, y: 671 },
  { x: 916, y: 221 }, { x: 1180, y: 296 }, { x: 916, y: 371 }, { x: 1050, y: 521 }, { x: 1180, y: 671 },
];

export function solidAt(x, y, w, h, wallsOnly) {
  const list = wallsOnly ? walls : solids;   // wallsOnly skips floating platforms (up-dash phasing)
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (x < s.x + s.w && x + w > s.x && y < s.y + s.h && y + h > s.y) return s;
  }
  return null;
}

// true if the box overlaps a floating platform — used to know when an up-dash has cleared one.
export function platAt(x, y, w, h) {
  for (let i = 0; i < plats.length; i++) {
    const s = plats[i];
    if (x < s.x + s.w && x + w > s.x && y < s.y + s.h && y + h > s.y) return s;
  }
  return null;
}
