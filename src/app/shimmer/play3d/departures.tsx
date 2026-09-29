// ── DEPARTURES: what is left of the 09-28 board (the parchment list) ────────────────────────────────────────
// The board became the full-screen lobby on 2026-09-29 (`deploy-lobby.tsx`, Alex: "it should feel like the apex
// legends lobby"). The finding view's state is still the host's, and still spelled here, because the host owns the
// matchmaking socket (`BreachQueue`) that fills it.

/** the Find others line's state, owned by the host (it holds the queue socket) */
export interface Finding { n: number; need: number; waited: number; names?: string[] }
