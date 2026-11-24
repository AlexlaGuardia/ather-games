// ★ SIGNED by Alex 2026-11-24 (athernyx c1d5903): CANON/game/shimmer-lines-batch-2026-11-24b.md › A, MAIN word for word
// (lines-batch-24b.test.ts reads the file). The training pool's words on the spirit panel. Fix canon first, never here.
export const TRAIN_UI = {
  unknown: 'Your spirit',
  header: 'Training points',
  /** one play's preview; canon's "point(s)" = 1 point, any other count points */
  play: (spend: number, stat: string, from: number, to: number) => `One play: ${spend} ${spend === 1 ? 'point' : 'points'}, ${stat} ${from} → ${to}`,
  cap: (stat: string) => `${stat} at its limit`,
  empty: 'No points left',
  allow: 'Allow',
  allowed: 'Allowed',
  footer: 'Points spent stay spent.',
  none: 'No training pieces on the plot yet.',
} as const
