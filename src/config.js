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
export const EDGE_BOOST_K = 0.65;                           // hitting a platform's side edge converts this fraction of horizontal speed to an upward pop
export const EDGE_BOOST_KEEP = 0.8;                         // horizontal speed kept after an edge boost (penalty for skimming edges)
export const PHASE_BREAK_KEEP = 0.85;                       // speed kept each time an up-dash punches through a platform from below
export const COYOTE = 6, JUMP_BUFFER = 7, JUMP_CUT = 0.45;
export const WALL_SLIDE_MAX = 2.8, WALLJUMP_X = 7.4, WALLJUMP_VY = -11.0, WALLJUMP_LOCK = 7;
export const DASH_SPEED = 15.0, DASH_TIME = 10, DASH_END_KEEP = 0.97; // big launch, keeps speed -> fly far
export const PLAYER_DASH_MAX = 3, PLAYER_DASH_REGEN = 3 / 120;        // 3 dashes; empty->full in ~2s

// ---- dive-bounce / hyperdash (a downward dash converts on floor contact) ----
export const DIVE_PURE_VEL = 16.5;    // pure-straight-down dash -> fixed vertical stomp-bounce
export const DIVE_VERT_MAX = 15.0;    // diagonal dive: max upward bounce (reached at full launch height)
export const DIVE_HEIGHT_RANGE = 150; // launch height above the floor (px) that maps to the max bounce
export const DIVE_HYPER_SPEED = 16.0; // diagonal dive: horizontal skim speed out the other side (× actor spd)

// ---- prey balance (no dash; it just runs fast) ----
export const PREY_SPEED_MULT = 2.25;   // prey base run = this × your base run speed (lower = easier). It
                                       // out-runs you on foot; only a dash (much faster) can close.
export const PREY_SPEED_GROWTH = 0;    // no per-catch ramp — speed is constant all run (authored difficulty)
export const PREY_SPEED_CAP = 1.90;    // ceiling on the multiplier (unused while growth = 0)

// ---- prey AI feel (all deterministic — no RNG, so runs are reproducible) ----
export const PREY_LOOKAHEAD = 11;   // ticks of shadow-velocity it anticipates (higher = dodges your dash harder)
export const PREY_COMMIT = 24;      // ticks it sticks with a flee direction (light hysteresis — can still peel away to avoid collisions)
export const PREY_CLIMB_DIST = 320; // shadow within this distance -> prey climbs for height to keep maximizing distance
export const PREY_EDGE_PAD = 150;   // distance from an arena wall where prey turns inward early

// ---- run ----
export const TARGET = 8;            // catches to win (Phase 2 will replace with the authored run length)
