// ── BETA M233 s4: THE FAIR'S EVENT LOBBY (Alex 11-27). Every contest is entered at its tent's sign-up panel; keepers of ONE CHORD
// standing in the same Wilds (the chord's host's: M156) see each other listed there, each READIES UP with a spirit, and then they
// face each other: Clash = a tournament of the chord's spirits (empty seats = the tent's line-up), Smash = each swings once and
// the highest hit wins. Nothing new on the wire: the open-world socket's existing RELAY (open-mp.tsx; a chord is a private
// instance per zone, so a relay reaches exactly the chord's keepers in this Wilds), the same road as the held gun and chord.hp.
//   'here'  every keeper with the panel open says it (on a change + a keepalive): tent, name, spirit, ready
//   'gone'  the panel closed
//   'start' the LOBBY HOST (pickHost over the panel's keepers: the chord's starter first, M156) starts the run: who sits where,
//           every seat's spirit, and one fight seed. Every keeper's ring plays the same fights from it (the engine is seeded
//           and fixed-step, clash-fight.ts; a field has no cheer), so every keeper sees the same tree and the same champion.
//   'hit'   Smash: a keeper's one swing (each keeper swings their own: the hit goes to the season board under s1's rules)
// Prizes stay the server's (s1-s3): the Clash purse once per tent per season (api/fair/clash), Smash's tries a day.
// ★ PURE (no React, no socket). Node test: fair-lobby.test.ts.
import type { Species, Element } from '../../spirits/spirit'
import type { Bonded } from './clash-fight'
import { pickHost } from '../shared/party-host'

export const LOBBY_KIND = 'fair.lobby'
/** the keepalive while a panel is open (ms) and how long an unheard keeper stays listed */
export const HERE_MS = 1500
export const LOBBY_STALE_MS = 5000
/** a Clash field holds four (the chord holds four, M217; empty seats = the tent's line-up) */
export const FIELD_SIZE = 4
/** Smash: how long the contest waits for a keeper's swing after the start before it reads the hits it has */
export const SMASH_WAIT_MS = 12_000

export interface LobbySpirit { name: string; species: Species; element: Element; bonded?: Bonded | null; known?: string[]; lessons?: string[] }
export interface LobbyHere { t: 'here'; tent: string; who: string; spirit: LobbySpirit | null; ready: boolean }
export interface LobbyGone { t: 'gone'; tent: string }
export interface LobbyStart { t: 'start'; tent: string; run: string; seed: number; seats: (string | null)[]; spirits: (LobbySpirit | null)[]; names: (string | null)[] }
export interface LobbyHit { t: 'hit'; tent: string; run: string; hit: number; spirit: string; who: string }
export type LobbyMsg = LobbyHere | LobbyGone | LobbyStart | LobbyHit

const str = (v: unknown, max = 64): string | null => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null)
const strs = (v: unknown, max = 32): string[] | undefined => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length <= 48).slice(0, max) : undefined)

function decodeSpirit(v: unknown): LobbySpirit | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const name = str(o.name, 40), species = str(o.species, 24), element = str(o.element, 24)
  if (!name || !species || !element) return null
  const b = o.bonded as Record<string, unknown> | null | undefined
  const bonded = b && typeof b === 'object' && str(b.id, 48) && typeof b.twist === 'number' && Number.isFinite(b.twist) ? { id: b.id as string, twist: b.twist } : null
  return { name, species: species as Species, element: element as Element, bonded, known: strs(o.known), lessons: strs(o.lessons) }
}

/** read a relayed lobby message (anything malformed = null: a peer can send any shape) */
export function decodeLobby(d: unknown): LobbyMsg | null {
  if (!d || typeof d !== 'object') return null
  const o = d as Record<string, unknown>, tent = str(o.tent, 32)
  if (!tent) return null
  if (o.t === 'here') { const who = str(o.who, 40); return who ? { t: 'here', tent, who, spirit: o.spirit == null ? null : decodeSpirit(o.spirit), ready: o.ready === true } : null }
  if (o.t === 'gone') return { t: 'gone', tent }
  if (o.t === 'start') {
    const run = str(o.run, 48), seed = o.seed
    if (!run || typeof seed !== 'number' || !Number.isInteger(seed) || seed <= 0) return null
    if (!Array.isArray(o.seats) || !Array.isArray(o.spirits) || o.seats.length !== o.spirits.length || o.seats.length < 2 || o.seats.length > 8) return null
    const seats = o.seats.map(x => (typeof x === 'string' ? x : null)), spirits = o.spirits.map(x => (x == null ? null : decodeSpirit(x)))
    const names = Array.isArray(o.names) ? seats.map((_, i) => str((o.names as unknown[])[i], 40)) : seats.map(() => null)
    return { t: 'start', tent, run, seed, seats, spirits, names }
  }
  if (o.t === 'hit') {
    const run = str(o.run, 48), spirit = str(o.spirit, 40), who = str(o.who, 40), hit = o.hit
    return run && spirit && who && typeof hit === 'number' && Number.isInteger(hit) && hit >= 0 && hit <= 1_000_000 ? { t: 'hit', tent, run, hit, spirit, who } : null
  }
  return null
}

export interface Present { id: string; who: string; spirit: LobbySpirit | null; ready: boolean; you: boolean }
type Heard = ReadonlyMap<string, { m: LobbyHere; at: number }>

/** the keepers at THIS tent's panel now: me, plus every chordmate heard inside LOBBY_STALE_MS. Only chord members count
 *  (`chord` = the chord's socket ids); listed in the chord's order (its starter first), so every keeper's list agrees. */
export function present(tent: string, me: { id: string; who: string; spirit: LobbySpirit | null; ready: boolean }, heard: Heard, chord: readonly string[], now: number): Present[] {
  const out: Present[] = [{ ...me, you: true }]
  for (const [id, h] of heard) if (id !== me.id && h.m.tent === tent && now - h.at <= LOBBY_STALE_MS && chord.includes(id)) out.push({ id, who: h.m.who, spirit: h.m.spirit, ready: h.m.ready, you: false })
  const rank = (id: string) => { const i = chord.indexOf(id); return i < 0 ? chord.length : i }
  return out.sort((a, b) => rank(a.id) - rank(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** who starts the run: the chord's starter if they are at the panel, else the next longest-standing (M156 pickHost) */
export const lobbyHost = (list: readonly Present[], chord: readonly string[]): string | null => {
  const me = list.find(p => p.you), ids = list.map(p => p.id)
  return me ? pickHost(me.id, ids.filter(i => i !== me.id), chord.filter(i => ids.includes(i)), null) : null
}
/** a lobby is a lobby with two keepers or more; one keeper alone plays solo, as before */
export const isLobby = (list: readonly Present[]) => list.length >= 2
/** every listed keeper has a spirit and is ready (the host's run then starts by itself) */
export const allReady = (list: readonly Present[]) => isLobby(list) && list.every(p => p.ready && !!p.spirit)
/** who a run takes: every ready keeper with a spirit (the host starting early leaves the unready out) */
export const takers = (list: readonly Present[]) => list.filter(p => p.ready && !!p.spirit)

/** CLASH: the field. The takers' spirits in the chord's order (at most FIELD_SIZE), then the tent's line-up in its order fills
 *  the empty seats. Seats paired in order (clash-bracket newField: 0 v 1, 2 v 3): chordmates face each other first. */
export function clashField(list: readonly Present[], lineup: readonly LobbySpirit[], size = FIELD_SIZE): Pick<LobbyStart, 'seats' | 'spirits' | 'names'> {
  const t = takers(list).slice(0, size)
  const seats: (string | null)[] = t.map(p => p.id), spirits: (LobbySpirit | null)[] = t.map(p => p.spirit), names: (string | null)[] = t.map(p => p.who)
  for (let i = 0; seats.length < size && i < lineup.length; i++) { seats.push(null); spirits.push(lineup[i]); names.push(null) }
  return { seats, spirits, names }
}

/** SMASH: the contest's seats = the takers (no fillers: the troupe shows no spirits at the bell, RULED Magii b4f51aa) */
export function smashField(list: readonly Present[]): Pick<LobbyStart, 'seats' | 'spirits' | 'names'> {
  const t = takers(list)
  return { seats: t.map(p => p.id), spirits: t.map(p => p.spirit), names: t.map(p => p.who) }
}
/** SMASH: the contest's winner among the hits heard (highest hit; a tie goes to the seat listed first) */
export function smashWinner(hits: readonly { id: string; hit: number }[], seats: readonly (string | null)[]): string | null {
  let best: { id: string; hit: number; at: number } | null = null
  for (const h of hits) {
    const at = seats.indexOf(h.id); if (at < 0) continue
    if (!best || h.hit > best.hit || (h.hit === best.hit && at < best.at)) best = { ...h, at }
  }
  return best?.id ?? null
}
/** Smash's contest is decided: every seat has swung, or the wait is over */
export const smashDone = (hits: readonly { id: string }[], seats: readonly (string | null)[], startedAt: number, now: number) =>
  seats.every(s => s === null || hits.some(h => h.id === s)) || now - startedAt >= SMASH_WAIT_MS

/** a fresh run id + fight seed (the host's) */
export function newRun(now: number, rand: () => number): { run: string; seed: number } {
  const seed = 1 + Math.floor(rand() * 0x7ffffe)
  return { run: `${now.toString(36)}-${seed.toString(36)}`, seed }
}

/** plain UI labels for @lark (no canon words) */
export const LOBBY_UI = {
  ready: 'Ready',
  notReady: 'Not ready',
  readyUp: 'Ready up',
  unready: 'Wait',
  start: 'Start',
  waiting: 'Waiting for everyone to ready up...',
  hostStarts: (who: string) => `${who} starts when everyone is ready.`,
  chord: 'Your chord at this tent',
  contest: 'The contest',
  winner: (who: string, spirit: string, hit: number) => `${who}'s ${spirit} wins with ${hit}!`,
  swingWait: 'Waiting for every swing...',
} as const
