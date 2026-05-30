// Prey "brain": a deterministic, distance-maximizing evader that navigates the platforms via a
// precomputed jump table (a tiny navmesh). At module load we simulate the prey's real jump/drop
// arcs between every standable surface and record, for each working move, the exact takeoff point
// and direction. At run time the prey BFS-paths toward the surface that maximizes "distance from
// the shadow + height" and executes the next hop. No RNG -> reproducible.
import * as C from './config.js';
import { plats, solidAt, WALL_T } from './level.js';

const PW = 22, PH = 30;                                   // prey box
const RUN = C.MAX_RUN * C.PREY_SPEED_MULT;                // prey top run speed
const FLOOR_Y = C.WORLD_H - WALL_T;                       // top of the floor surface

// ---- surfaces: floor + every platform top ----
const surf = [{ x0: WALL_T, x1: C.WORLD_W - WALL_T, y: FLOOR_Y }]
  .concat(plats.map(p => ({ x0: p.x, x1: p.x + p.w, y: p.y })));
const cx = s => (s.x0 + s.x1) / 2;

// overlap test of a box against a platform body (used to reject arcs that punch through one)
function hitsPlatBody(ax, ay) {
  for (let i = 0; i < plats.length; i++) {
    const p = plats[i];
    if (ax < p.x + p.w && ax + PW > p.x && ay < p.y + p.h && ay + PH > p.y) return p;
  }
  return null;
}

// Simulate one launch from a takeoff (foot at top of surface `from`) with initial vy/vx (vx held at
// full run, gravity applied). Returns the surface index it lands on, or -1 (fell out) / -2 (blocked).
function arc(txLeft, fromY, vy, vx) {
  let ax = txLeft, ay = fromY - PH;
  for (let t = 0; t < 240; t++) {
    vy += C.GRAVITY; if (vy > C.MAX_FALL) vy = C.MAX_FALL;
    const prevBottom = ay + PH;
    ax += vx; ay += vy;
    if (ax < WALL_T) { ax = WALL_T; vx = 0; }
    if (ax + PW > C.WORLD_W - WALL_T) { ax = C.WORLD_W - WALL_T - PW; vx = 0; }
    const nowBottom = ay + PH;
    if (vy > 0) {
      for (let k = 0; k < surf.length; k++) {
        const s = surf[k];
        if (ax + PW > s.x0 + 2 && ax < s.x1 - 2 && prevBottom <= s.y + 0.01 && nowBottom >= s.y) return k;
      }
    }
    // punched into a platform's side/underside (not a clean top landing) -> this launch is blocked
    if (hitsPlatBody(ax, ay)) return -2;
    if (ay > C.WORLD_H) return -1;
  }
  return -1;
}

// ---- build the jump table: graph[a] = [{to, tx, dir, jump}] ----
const graph = surf.map(() => []);
for (let a = 0; a < surf.length; a++) {
  const s = surf[a];
  const best = new Map();                                 // to -> {tx, dir, jump, clear}
  const txs = [];
  for (let x = s.x0; x <= s.x1 - PW; x += 12) txs.push(x);
  const launches = [
    { vy: C.JUMP_VEL, vx: RUN }, { vy: C.JUMP_VEL, vx: -RUN }, { vy: C.JUMP_VEL, vx: 0 },
    { vy: 0, vx: RUN }, { vy: 0, vx: -RUN },                // walk-off drops
  ];
  for (const tx of txs) for (const L of launches) {
    const to = arc(tx, s.y, L.vy, L.vx);
    if (to < 0 || to === a) continue;
    // prefer the takeoff that lands most centrally on the target (most forgiving)
    const clear = Math.min(tx - s.x0, s.x1 - PW - tx);
    const prev = best.get(to);
    if (!prev || clear > prev.clear) best.set(to, { tx, dir: Math.sign(L.vx) || 1, jump: L.vy < 0, clear });
  }
  for (const [to, e] of best) graph[a].push({ to, tx: e.tx, dir: e.dir, jump: e.jump });
}

// BFS next-hop from `src` toward `dst`; returns the edge to take, or null.
function nextHop(src, dst) {
  if (src === dst) return null;
  const prev = new Array(surf.length).fill(-1);
  const seen = new Array(surf.length).fill(false);
  const q = [src]; seen[src] = true;
  while (q.length) {
    const u = q.shift();
    if (u === dst) break;
    for (const e of graph[u]) if (!seen[e.to]) { seen[e.to] = true; prev[e.to] = u; q.push(e.to); }
  }
  if (!seen[dst]) return null;
  let cur = dst; while (prev[cur] !== src && prev[cur] !== -1) cur = prev[cur];
  if (prev[cur] !== src) return null;
  return graph[src].find(e => e.to === cur) || null;
}

// which surface is the box standing on (or -1 if airborne / between)
function currentSurface(a) {
  if (!a.onGround) return -1;
  const feet = a.y + a.h;
  for (let i = 0; i < surf.length; i++) {
    const s = surf[i];
    if (a.x + a.w > s.x0 + 1 && a.x < s.x1 - 1 && Math.abs(feet - s.y) < 5) return i;
  }
  return -1;
}

// surface directly beneath a box (for an airborne player) — the one it's about to land on
function surfaceBelow(a) {
  const fx = a.x + a.w / 2; let best = -1, bg = 1e9;
  for (let i = 0; i < surf.length; i++) {
    const s = surf[i];
    if (fx > s.x0 && fx < s.x1 && s.y >= a.y + a.h - 4) { const g = s.y - (a.y + a.h); if (g < bg) { bg = g; best = i; } }
  }
  return best;
}

// BFS hop-distances from a source surface across the jump table
function hopDists(src) {
  const d = new Array(surf.length).fill(Infinity);
  if (src < 0) return d;
  d[src] = 0; const q = [src];
  while (q.length) { const u = q.shift(); for (const e of graph[u]) if (d[e.to] === Infinity) { d[e.to] = d[u] + 1; q.push(e.to); } }
  return d;
}

export function aiInput(pr, pl) {
  const inp = { left: false, right: false, up: false, down: false, jump: false, dash: false };
  const plx = pl.x + pl.w / 2, ply = pl.y + pl.h / 2;
  const prx = pr.x + pr.w / 2;
  pr.climbLock = (pr.climbLock || 0) - 1;

  // ---- choose a target surface: the one the shadow is FARTHEST from through the platform graph,
  // so high ground (which the shadow must climb to reach) is genuinely safer than flat distance.
  const here = currentSurface(pr);
  if (here >= 0) {
    const mydist = hopDists(here);                               // prey's own hops to every surface
    let bestT = here, bestScore = -1e9;
    for (let i = 0; i < surf.length; i++) {
      if (i !== here && nextHop(here, i) === null) continue;     // must be reachable from here
      const s = surf[i];
      const mh = mydist[i] === Infinity ? 12 : mydist[i];        // our hops — prefer near high ground
      // how COSTLY this surface is for the shadow to reach: horizontal distance + a stiff penalty
      // per tier it must climb (climbing is slow/indirect for the chaser). Maximizing this is what
      // makes high ground genuinely safer than flat distance, while still respecting where the
      // shadow actually stands (so we don't trek toward it).
      const climb = (FLOOR_Y - s.y) / 86;                        // tiers above the floor
      const playerCost = Math.abs(cx(s) - plx) + 250 * climb;
      const onShadow = (plx > s.x0 - 30 && plx < s.x1 + 30 && Math.abs(ply - s.y) < 60) ? 1 : 0;
      const score = playerCost - mh * 120 - onShadow * 9000;
      if (score > bestScore) { bestScore = score; bestT = i; }
    }
    // hysteresis: stick with the previous target unless the new pick is clearly better (avoids jitter)
    if (pr.navTarget !== undefined && pr.navTarget !== bestT &&
        (pr.navTarget === here || nextHop(here, pr.navTarget))) {
      const t = surf[pr.navTarget];
      const prevScore = Math.abs(cx(t) - plx) + 250 * ((FLOOR_Y - t.y) / 86) - mydist[pr.navTarget] * 120;
      if (prevScore > bestScore - 220) bestT = pr.navTarget;
    }
    pr.navTarget = bestT;
    pr.navEdge = nextHop(here, bestT);
  }

  // ---- execute the current hop ----
  const e = pr.navEdge;
  let dir = pr.facing || 1;
  if (!pr.onGround && pr.climbLock > 0) {
    dir = pr.climbDir;                                            // mid-jump: hold the takeoff heading
    if (pr.vy < 0) inp.jump = true;                              // hold for full height (beat the jump-cut)
  } else if (e && pr.onGround) {
    const ahead = e.tx - pr.x;
    dir = Math.abs(ahead) > 6 ? Math.sign(ahead) : e.dir;        // run to the takeoff point
    // anti-collision: never walk into a close, roughly-level shadow even if the route wants to —
    // peel away and let the planner re-route next tick (this is what stops it pathing into you)
    const dxp = plx - prx, level = Math.abs(ply - (pr.y + pr.h / 2)) < 80;
    if (Math.sign(dxp) === dir && Math.abs(dxp) < 175 && level) {
      dir = -dir;
    } else if (Math.abs(ahead) < 14) {
      if (e.jump) { inp.jump = true; pr.climbLock = 24; pr.climbDir = e.dir; dir = e.dir; }
      else dir = e.dir;                                          // walk off the edge (drop)
    }
  } else if (pr.onGround) {
    // no edge (already at the best surface): flee flat away from the shadow, hop walls/gaps
    dir = plx >= prx ? -1 : 1;
    const wa = !!solidAt(pr.x + (dir > 0 ? pr.w : -8), pr.y + 2, 8, pr.h - 8);
    const ga = !solidAt(pr.x + (dir > 0 ? pr.w + 10 : -12), pr.y + pr.h + 2, 6, 10);
    if (wa || ga) inp.jump = true;
  }

  pr.facing = dir;
  if (dir > 0) inp.right = true; else inp.left = true;
  // kick off a boundary wall it's sliding down
  if ((pr.wallL || pr.wallR) && !pr.onGround && pr.vy > 0) inp.jump = true;
  return inp;
}
