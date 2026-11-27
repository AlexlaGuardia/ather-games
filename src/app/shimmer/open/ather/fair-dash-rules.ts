// BETA M233 s2: DASH, the Thistledown Fair's obstacle race (Alex 11-27: "5 spirits race to the finish", inspired by the Chao
// races' MECHANICS only: our own course, look and words). The RULES both sides share, PURE and server-safe (api/fair/dash
// imports it; no 'use client' reach). The race itself is fair-dash-race.ts (pure sim), drawn by dash-view.tsx.
//  - the keeper does NOT steer: her spirit runs the course on her own; ONE cheer button gives a short burst (cooldown)
//  - 5 racers: yours + 4 GHOSTS = other keepers' spirits from the season's pool (entry = spirit + stats, never a live player),
//    filled with fair entrants (a species from the launched roster, base stats) when the pool is thin
//  - a keeper gets DASH_TRIES races a day (Jin's call: the same three as Smash); the board is the SEASON's best time per keeper
//  - prizes: none yet. TODO(M233 prizes): fair cosmetics / recipes / Marks to the season's fastest, never raw power.
import { SMASH_SEASON } from './fair-smash-rules'

export const DASH_TRIES = 3
/** the board's season: the same season as Smash's (network.ts SEASON; fair-smash.test holds them equal) */
export const DASH_SEASON = SMASH_SEASON
export const BOARD_TOP = 20
/** racers in a heat, yours included */
export const RACERS = 5
/** a finish time the server takes, ms (outside it is refused, never clamped) */
export const MIN_MS = 5_000, MAX_MS = 600_000

export const dashDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10)

/** the stats a racer runs on (the four trainable ones) */
export const RACE_STATS = ['pwr', 'grd', 'agi', 'vig'] as const
export type RaceStat = typeof RACE_STATS[number]
export type RaceStats = Record<RaceStat, number>
/** the launched species (kept as plain strings here: this file stays free of client modules) */
export const DASH_SPECIES = ['fox', 'axolotl', 'water-bear', 'turtle', 'owl', 'frog', 'firefly', 'rabbit', 'hummingbird', 'bat'] as const
export const DASH_ELEMENTS = ['base', 'mana', 'storm', 'earth', 'water'] as const

/** a finish time the server may record: a whole number of ms, MIN_MS..MAX_MS */
export function cleanTime(v: unknown): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n >= MIN_MS && n <= MAX_MS ? n : null
}
export const cleanName = (v: unknown) => String(v ?? '').replace(/[^\p{L} '\-]/gu, '').trim().slice(0, 24) || 'a spirit'
export const cleanSpecies = (v: unknown): string | null => (DASH_SPECIES as readonly string[]).includes(String(v)) ? String(v) : null
export const cleanElement = (v: unknown): string => (DASH_ELEMENTS as readonly string[]).includes(String(v)) ? String(v) : 'base'
/** her stats as entered: each a real number 1..100000 (a ghost re-runs on these), else refused */
export function cleanStats(v: unknown): RaceStats | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>, out = {} as RaceStats
  for (const k of RACE_STATS) { const n = Number(o[k]); if (!Number.isFinite(n) || n < 1 || n > 100_000) return null; out[k] = Math.round(n * 10) / 10 }
  return out
}

/** a racer from the pool (another keeper's spirit as entered) */
export interface DashGhost { who: string; spirit: string; species: string; element: string; stats: RaceStats }
export interface DashRow { who: string; ms: number; spirit: string; mine: boolean }
export interface DashBoard { season: number; top: DashRow[]; signedIn: boolean; best: number | null; triesLeft: number; ghosts: DashGhost[] }

/** 12345 ms -> '12.3 s' */
export const fmtTime = (ms: number) => `${(ms / 1000).toFixed(1)} s`

/** plain UI labels (@lark may reword; no canon words) */
export const DASH_UI = {
  title: 'Dash',
  cheer: 'Cheer',
  start: 'Ready',
  go: 'Go!',
  finish: 'Finish',
  place: (n: number) => ['1st', '2nd', '3rd', '4th', '5th'][n - 1] ?? `${n}th`,
  yourTime: (ms: number) => `Your time: ${fmtTime(ms)}`,
  best: (ms: number | null) => (ms == null ? 'Your best: none yet' : `Your best: ${fmtTime(ms)}`),
  tries: (n: number) => `Races left today: ${n}`,
  noTries: 'No races left today. Come back tomorrow.',
  board: 'Season board',
  empty: 'No times on the board yet.',
  signIn: 'Sign in to put a time on the board.',
  entrant: 'Fair entrant',
  close: 'Close',
  again: 'Back to sign-up',
  sections: { run: 'Run', swim: 'Swim', climb: 'Climb', glide: 'Gap', blocks: 'Blocks' },
  doing: { run: 'running', swim: 'swimming', climb: 'climbing', glide: 'gliding', drop: 'down the gap', blocks: 'breaking blocks', sniff: 'sniffing a flower', trip: 'tripped', done: 'finished' },
} as const
