// ── BREWINGS ON THE CHORDSTONE: the shared rules (BETA M188 s4) ──────────────────────────────────────────────────────────
// Pure (no node, no React): the server record (brewings.ts) and the client (the Chordstone's brewings card, the map door)
// read the same numbers. Canon (62a71de, game/alchemy.md): the word is 'a brewing', scheduled or not; brewings post to the
// Chordstone; a brewing gives MORE, never ONLY (a seat is a hand, never a key to a recipe). Alex 11-26: a host schedules
// ahead (public / private, the potion, which steps keepers may sign up for); a finder takes a seat and holds an RSVP that
// expires at the scheduled time; 5-20 min before, the host's garden shows at the map's door with a potion icon.

/** the earliest a brewing may be set (from now) and the furthest ahead */
export const BREW_LEAD_MIN_MS = 2 * 60_000
export const BREW_LEAD_MAX_MS = 7 * 24 * 3600_000
/** how long before the start the host's garden shows at the map door (Alex: "5-20 min before") */
export const BREW_DOOR_MS = 20 * 60_000
/** upcoming brewings one host may hold at once (a bound, not a target) */
export const BREW_HOST_MAX = 3
/** the lead times the Host tab offers (ms from now) */
export const BREW_LEADS: readonly number[] = [5, 15, 30, 60, 120, 240, 24 * 60].map(m => m * 60_000)

/** the RSVP is live until the scheduled time; after it, it is gone (Alex: "it expires and disappears after the scheduled time") */
export const rsvpLive = (at: number, now: number) => now < at
/** the map door shows the host's garden from BREW_DOOR_MS before the start until the start */
export const doorOpen = (at: number, now: number) => now >= at - BREW_DOOR_MS && now < at

/** "in 12 min" / "in 2 h 5 min" / "Tue 18:30": a plain label for a start time */
export function whenLabel(at: number, now: number): string {
  const d = at - now
  if (d <= 0) return 'now'
  const m = Math.ceil(d / 60_000)
  if (m < 60) return `in ${m} min`
  if (m < 12 * 60) { const h = Math.floor(m / 60), r = m % 60; return `in ${h} h${r ? ` ${r} min` : ''}` }
  const t = new Date(at)
  return `${t.toLocaleDateString(undefined, { weekday: 'short' })} ${t.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
}

/** clean a host's seat pick: unique step indexes in 0..steps-1, sorted; null = not a pick (empty or out of range) */
export function cleanSeats(x: unknown, steps: number): number[] | null {
  if (!Array.isArray(x) || !x.length || x.length > steps) return null
  const out = new Set<number>()
  for (const v of x) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= steps) return null
    out.add(v)
  }
  return [...out].sort((a, b) => a - b)
}
