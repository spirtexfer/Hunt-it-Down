// Arena geometry: collidable boundary box + floating ledges, prey spawn points, and the
// broadphase-free AABB query everything uses for collision.
import { WORLD_W, WORLD_H } from './config.js';

export const WALL_T = 24;

// Visible boundary box (collidable)
export const walls = [
  { x: 0, y: 0, w: WALL_T, h: WORLD_H },                  // left wall
  { x: WORLD_W - WALL_T, y: 0, w: WALL_T, h: WORLD_H },   // right wall
  { x: 0, y: 0, w: WORLD_W, h: WALL_T },                  // ceiling
  { x: 0, y: WORLD_H - WALL_T, w: WORLD_W, h: WALL_T },   // floor
];

// Open floating ledges (no pillars, no dead ends)
export const plats = [
  { x: 150, y: 715, w: 250, h: 22 },
  { x: 540, y: 655, w: 230, h: 22 },
  { x: 910, y: 705, w: 250, h: 22 },
  { x: 1230, y: 650, w: 240, h: 22 },
  { x: 340, y: 525, w: 230, h: 22 },
  { x: 720, y: 475, w: 250, h: 22 },
  { x: 1080, y: 530, w: 230, h: 22 },
  { x: 170, y: 355, w: 230, h: 22 },
  { x: 560, y: 315, w: 230, h: 22 },
  { x: 960, y: 345, w: 240, h: 22 },
  { x: 1290, y: 400, w: 210, h: 22 },
  { x: 760, y: 185, w: 260, h: 22 },
];

export const solids = walls.concat(plats);

// prey spawn points (all sit above an open platform)
export const spawns = [
  { x: 250, y: 680 }, { x: 640, y: 620 }, { x: 1010, y: 670 }, { x: 1330, y: 615 },
  { x: 440, y: 490 }, { x: 820, y: 440 }, { x: 1170, y: 495 }, { x: 270, y: 320 },
  { x: 660, y: 280 }, { x: 1060, y: 310 }, { x: 1370, y: 365 }, { x: 860, y: 150 },
];

export function solidAt(x, y, w, h) {
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (x < s.x + s.w && x + w > s.x && y < s.y + s.h && y + h > s.y) return s;
  }
  return null;
}
