// All gameplay tunables and world dimensions. Pure constants — imported read-only everywhere.

// ---- view / world (pixels) ----
export const VIEW_W = 960, VIEW_H = 540;
export const WORLD_W = 1600, WORLD_H = 900;

// ---- physics (per 60Hz tick) ----
export const GRAVITY = 0.62, MAX_FALL = 13, JUMP_VEL = -11.6;
export const RUN_ACCEL = 1.15, AIR_ACCEL = 0.86, MAX_RUN = 5.25;
export const FRICTION_G = 0.85, FRICTION_A = 0.35;          // default (prey): crisp, stops quickly
export const PLAYER_FRIC_G = 0.045, PLAYER_FRIC_A = 0.02;   // YOU: almost no friction — you glide / fly
export const PLAYER_BOUNCE = 0.75;                          // YOU: bouncier — walls/floor send you flying
export const COYOTE = 6, JUMP_BUFFER = 7, JUMP_CUT = 0.45;
export const WALL_SLIDE_MAX = 2.8, WALLJUMP_X = 7.4, WALLJUMP_VY = -11.0, WALLJUMP_LOCK = 7;
export const DASH_SPEED = 15.0, DASH_TIME = 10, DASH_END_KEEP = 0.97; // big launch, keeps speed -> fly far
export const PLAYER_DASH_MAX = 3, PLAYER_DASH_REGEN = 3 / 120;        // 3 dashes; empty->full in ~2s

// ---- prey balance (no dash; it just runs fast) ----
export const PREY_SPEED_MULT = 1.16;   // prey base run = this × your base run speed (lower = easier)
export const PREY_SPEED_GROWTH = 0.02; // added to the multiplier per catch (0 = no ramp)
export const PREY_SPEED_CAP = 1.55;    // ceiling on the multiplier

// ---- prey AI feel (all deterministic — no RNG, so runs are reproducible) ----
export const PREY_LOOKAHEAD = 11;   // ticks of shadow-velocity it anticipates (higher = dodges your dash harder)
export const PREY_COMMIT = 42;      // ticks it sticks with a flee direction (higher = steadier, lower = twitchier)
export const PREY_PANIC_DIST = 175; // when the shadow is this close, prey makes evasive leaps
export const PREY_CLIMB_DIST = 240; // when cornered near an edge & shadow this close, prey climbs for height
export const PREY_EDGE_PAD = 150;   // distance from an arena wall where prey turns inward early

// ---- run ----
export const TARGET = 8;            // catches to win (Phase 2 will replace with the authored run length)
