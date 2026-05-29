// Cross-cutting mutable game state. Exported as objects so any module can read/mutate fields
// (ES modules can't reassign imported bindings, so we never use bare reassignable primitives here).

// Screen-feel / juice state.
export const screen = { trauma: 0, flash: 0, freeze: 0, bars: 0 };

// Core run state.
export const game = {
  player: null,
  prey: null,
  cam: { x: 0, y: 0 },
  caught: 0,
  ticks: 0,
  running: false,
  won: false,
  started: false,
  best: null,
};
