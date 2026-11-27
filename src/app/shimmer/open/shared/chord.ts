// ── THE CHORD, ON SCREEN (BETA M188 s1, RULED athernyx 62a71de) ──────────────────────────────────────────────────────────
// A chord is a company of keepers (canon). Underneath it is lib/party's code + lib/party-lobby's cross-zone roster, nothing
// new on the wire: the Options CHORD tab lists who is in it, and the HUD stacks each chordmate's health bar + nametag above
// your own. Health rides the open-world socket's existing 'relay' (the same road as the held gun, held-gun.ts): each keeper
// says their health fraction on a CHANGE, when a NEW peer appears, and a keepalive; a mate the socket cannot hear (another
// zone, a dropped line) shows a dim bar, never a made-up number.
// The members box is filled by <OpenSocial/> (play-together.tsx), read by the tab and by <ChordBars/> (chord-bars.tsx).
// ★ PURE below the store (no React, no socket). Node test: chord.test.ts.
import { useSyncExternalStore } from 'react'
import type { LobbyMember } from '@/lib/party-lobby'

export const HP_KIND = 'chord.hp'
/** a mate not heard from in this long shows a dim bar (the keepalive is 10 s: two missed in a row) */
export const HP_STALE_S = 25
/** at most this many mates' bars over your own (a chord is small; the cluster card caps clusters at 4 keepers) */
export const MAX_BARS = 4

// ── who is in the chord (with me), published by OpenSocial ──
let box: { members: LobbyMember[]; me: string; code: string | null } = { members: [], me: '', code: null }
const subs = new Set<() => void>()
export function setChordBox(members: LobbyMember[], me: string, code: string | null) {
  const same = box.me === me && box.code === code && box.members.length === members.length &&
    box.members.every((m, i) => m.id === members[i].id && m.look === members[i].look && m.name === members[i].name && m.zone === members[i].zone)
  if (same) return
  box = { members, me, code }; subs.forEach(f => f())
}
export const chordBox = () => box
export const useChordBox = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => box, () => box)

/** A keeper's own colour in the chord: stable for the keeper (from their id), never two neighbours alike in a small chord. */
// ── BETA M217: A CHORD HOLDS FOUR (canon amended 11-26, athernyx 9a3694b: four to a door) ──────────────────────────
// shimmer-server lobby.py SEATS = 4: a fifth keeper with the chord's code is told the lobby is full (lib/party-lobby `full`).
// That keeper has no roster, so a visit it asks for can never be answered; it hears WHY instead of "They may have left it."
export const CHORD_SEATS = 4
/** placeholder for @lark (M217): what a keeper the chord has no seat for hears */
export const CHORD_FULL_LINE = 'The chord is full.'
let full = false
export function setChordFull(f: boolean) { full = f }
export const chordFull = () => full
/** a visit that will not go: the log entry + the one line the keeper hears */
export function visitRefusal(name: string, isFull: boolean): { log: string; line: string } {
  return isFull ? { log: 'refused:chord-full', line: CHORD_FULL_LINE }
    : { log: 'refused:not-home', line: `Could not reach ${name || 'a friend'}'s plot. They may have left it.` }
}

export const CHORD_COLOURS = ['#e0a33a', '#5fa8c9', '#c9627a', '#7bb35a', '#9a7bd1', '#d9774a'] as const
export function chordColour(id: string): string {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) }
  return CHORD_COLOURS[(h >>> 0) % CHORD_COLOURS.length]
}

/** The others in my chord, in the order they rang in (the lobby's order), at most MAX_BARS. Me = my socket id (`look`). */
export function chordMates(members: readonly LobbyMember[], me: string): LobbyMember[] {
  const seen = new Set<string>(), out: LobbyMember[] = []
  for (const m of members) {
    if (!m.look || m.look === me || seen.has(m.look)) continue
    seen.add(m.look); out.push(m)
  }
  return out.slice(0, MAX_BARS)
}

export interface MateBar { id: string; name: string; colour: string; hp: number | null }
/** One bar per mate. hp = the fraction they last said, or null when nothing fresh was heard (dim bar). */
export function mateBars(members: readonly LobbyMember[], me: string, heard: ReadonlyMap<string, { hp: number; at: number }>, now: number): MateBar[] {
  return chordMates(members, me).map(m => {
    const h = heard.get(m.look)
    return { id: m.look, name: m.name || 'keeper', colour: chordColour(m.look), hp: h && now - h.at <= HP_STALE_S ? h.hp : null }
  })
}

/** My health as a fraction, in 5% steps (a sliver of regen must not cost a message). */
export function hpFrac(hp: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(hp)) return 0
  return Math.round(Math.min(1, Math.max(0, hp / max)) * 20) / 20
}

/** What a mate said: a fraction in [0, 1], or undefined (junk: ignore it, never zero a bar on junk). */
export function decodeHp(d: unknown): number | undefined {
  const h = (d as { h?: unknown })?.h
  return typeof h === 'number' && Number.isFinite(h) && h >= 0 && h <= 1 ? h : undefined
}
