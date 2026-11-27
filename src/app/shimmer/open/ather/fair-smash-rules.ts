// BETA M233 s1: SMASH, the Thistledown Fair's bell contest (Alex 11-27: "smash is a line up of contestant that try to hit the
// highest damage on a special bell"; RULED Magii b4f51aa: the keeper's OWN spirits swing, by choice; the troupe shows none).
// The RULES both sides share, PURE and server-safe (no 'use client' reach: api/fair/smash imports it). The hit itself is
// fair-smash.ts (client: it reads her stat record).
//  - a keeper gets SMASH_TRIES swings a day (the troupe's signed bark B3: "Three tries each. Nobody counts the misses.")
//  - the board is the SEASON's: one row per keeper, their best hit, the spirit that struck it
//  - prizes: none yet. TODO(M233 prizes): fair cosmetics / recipes / Marks to the season's top hits, never raw power.

export const SMASH_TRIES = 3
/** the board's season: network.ts SEASON (copied, not imported: network.ts reaches a client module; fair-smash.test holds them equal) */
export const SMASH_SEASON = 1
/** the bell rings at the top of the pole from this hit up; below it the striker rises part way (sqrt scale, so a fresh
 *  spirit's hit still climbs a fair way) */
export const BELL_RING = 60
/** a sanity cap on what the server takes (a hit past it is refused, never clamped) */
export const MAX_HIT = 1_000_000
export const BOARD_TOP = 20

/** the striker's height up the pole, 0..1 */
export const strikerRise = (hit: number) => Math.max(0, Math.min(1, Math.sqrt(Math.max(0, hit) / BELL_RING)))
export const rings = (hit: number) => hit >= BELL_RING

/** the contest day (UTC), the tries' window */
export const smashDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10)

/** a hit the server may record: a whole number, 1..MAX_HIT */
export function cleanHit(v: unknown): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= MAX_HIT ? n : null
}
/** the spirit's shown name: letters, spaces, apostrophes and dashes, at most 24 */
export const cleanSpirit = (v: unknown) => String(v ?? '').replace(/[^\p{L} '\-]/gu, '').trim().slice(0, 24) || 'a spirit'

export interface SmashRow { who: string; best: number; spirit: string; mine: boolean }
export interface SmashBoard { season: number; top: SmashRow[]; signedIn: boolean; best: number | null; triesLeft: number }

/** plain UI labels (@lark may reword; no canon words beyond the signed bark) */
export const SMASH_UI = {
  title: 'Smash',
  hit: (n: number) => `Hit: ${n}`,
  rang: 'The bell rings!',
  best: (n: number | null) => (n == null ? 'Your best: none yet' : `Your best: ${n}`),
  tries: (n: number) => `Tries left today: ${n}`,
  noTries: 'No tries left today. Come back tomorrow.',
  board: 'Season board',
  empty: 'No hits on the board yet.',
  signIn: 'Sign in to put a hit on the board.',
  close: 'Close',
} as const
