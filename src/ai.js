// Prey "brain": a deterministic, anticipatory evader. No RNG, so identical inputs reproduce the
// same chase every time (speedrun fairness). See docs/MOVEMENT-AND-AI.md for the design.
import { WORLD_W, PREY_LOOKAHEAD, PREY_COMMIT, PREY_PANIC_DIST, PREY_CLIMB_DIST, PREY_EDGE_PAD } from './config.js';
import { solidAt } from './level.js';

const wallAhead = (a, dir) => !!solidAt(a.x + (dir > 0 ? a.w : -8), a.y + 2, 8, a.h - 8);
const tallWallAhead = (a, dir) => !!solidAt(a.x + (dir > 0 ? a.w : -12), a.y - 26, 12, a.h + 26);
function gapAhead(a, dir) {
  if (!a.onGround) return false;
  const px = a.x + (dir > 0 ? a.w + 10 : -12);
  return !solidAt(px, a.y + a.h + 2, 6, 10);
}

export function aiInput(pr, pl) {
  const inp = { left: false, right: false, up: false, down: false, jump: false, dash: false };

  // Anticipate where the shadow is *heading*, not just where it is — this is what lets the prey
  // slip out of your dash line instead of running straight into it.
  const threatX = pl.x + pl.vx * PREY_LOOKAHEAD;
  const dxNow = pl.x - pr.x, dyNow = pl.y - pr.y;
  const dist = Math.hypot(dxNow, dyNow);
  const dxThreat = threatX - pr.x;                      // predicted horizontal offset to the shadow

  if (pr.fleeDir === undefined) pr.fleeDir = dxThreat >= 0 ? -1 : 1;
  pr.commit = (pr.commit || 0) - 1;
  let dir = pr.fleeDir;
  const desired = dxThreat >= 0 ? -1 : 1;               // run away from the *predicted* threat

  const nearL = pr.x < PREY_EDGE_PAD;
  const nearR = pr.x > WORLD_W - PREY_EDGE_PAD - pr.w;

  if (nearL) { dir = 1; pr.commit = PREY_COMMIT; }                                   // hugging left  -> peel right
  else if (nearR) { dir = -1; pr.commit = PREY_COMMIT; }                             // hugging right -> peel left
  else if (tallWallAhead(pr, dir) && !tallWallAhead(pr, -dir)) { dir = -dir; pr.commit = PREY_COMMIT; } // pillar -> peel off
  else if (pr.commit <= 0 && desired !== dir) {
    // switch sides only once the commit window passes AND the shadow is actually cutting this way off
    const cutOff = (dir > 0 && dxThreat > 0 && dxThreat < 260) || (dir < 0 && dxThreat < 0 && -dxThreat < 260);
    if (cutOff) { dir = desired; pr.commit = PREY_COMMIT; }
  }
  pr.fleeDir = dir; pr.facing = dir;
  if (dir > 0) inp.right = true; else inp.left = true;

  // traversal: hop walls and gaps in the run direction
  if (pr.onGround && (wallAhead(pr, dir) || gapAhead(pr, dir))) inp.jump = true;

  // evasive leaps (deterministic — replaces the old random juke): when the shadow is close and
  // roughly level, bound away to break the chase and gain height. Every jump trigger is gated on
  // onGround, so jump releases naturally in the air and re-fires on the next landing (bunny-hop).
  if (pr.onGround && dist < PREY_PANIC_DIST && Math.abs(dyNow) < 70) {
    const closingFromAhead = (dir > 0 && dxNow > 0) || (dir < 0 && dxNow < 0);
    if (closingFromAhead || dist < PREY_PANIC_DIST * 0.6) inp.jump = true;
  }
  // cornered against an edge with the shadow bearing down -> climb for higher ground
  if (pr.onGround && (nearL || nearR) && dist < PREY_CLIMB_DIST) inp.jump = true;

  // kick off a wall it's sliding down
  if ((pr.wallL || pr.wallR) && !pr.onGround && pr.vy > 0) inp.jump = true;
  return inp;
}
