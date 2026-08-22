// Feature-scoped constants for the calibration state machine and I/O timing.
// Kept in the feature folder because none of these are meaningful elsewhere.

export const PHASE = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  ANALYZING: 'analyzing',
  DONE: 'done',
  ERROR: 'error',
});

export const MODE_BREW = 1;
export const SHOT_END_TIMEOUT_MS = 5 * 60 * 1000;
export const POST_MODE_SETTLE_MS = 1500;
export const POST_SHOT_SETTLE_MS = 1500;
export const SLOG_FETCH_RETRIES = 20;
export const SLOG_FETCH_DELAY_MS = 1000;
