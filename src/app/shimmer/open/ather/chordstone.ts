// ── THE CHORDSTONE (BETA M188 s2, RULED athernyx glossary › Chordstone, CANON_GAPS › The Green's podium) ─────────────────
// A Blankstone pedestal grown into the Green's gate, one piece with it. It HEARS THE CHORD: each keeper rung in shows as
// their own colour of light on its top (the same colour the Chord tab and the chordmates' bars use, chord.ts). E at it
// opens three cards (chordstone-panel.tsx): centre = friends online + chord invites (the Chord tab's plumbing), left = the
// garden cluster card, right = the brewings posted to it (both drawn as their layout, 'coming' until M188 s3 / s4).
// Never 'podium' in-world. ★ PURE (no React, no three): placement + which lights burn. Node test: chordstone.test.ts.
import type { LobbyMember } from '@/lib/party-lobby'
import { CHORDSTONE, CHORDSTONE_OFF } from './plot'
import { chordColour } from '../shared/chord'
import type { ClusterView } from '@/lib/accounts/clusters'

/** Where it stands: beside the Green's gate, off its side (Alex 11-26: 'a podium off to the side of the gate'). The gate's
 *  plinth is r 1.8 and the stone's foot r 0.75, so 3.4 m leaves a hand between them for the grown root that joins them.
 *  Defined in plot.ts (the walker's box needs it there). */
export { CHORDSTONE, CHORDSTONE_OFF }
/** Pedestal height (its top, where the lights sit) and foot radius: the walker's box + the E capsule use these. */
export const CHORDSTONE_H = 1.3
export const CHORDSTONE_R = 0.75
/** Lights on its top: a small chord fits; past this the stone shows the first ones heard (lights never overlap). */
export const MAX_LIGHTS = 6

export interface ChordLight { id: string; name: string; colour: string; me: boolean }
/** One light per keeper rung into my chord, me first, then in ring-in order; nobody in a chord = no lights (dark stone).
 *  `me` = my socket id (`look`); a row without an id or a doubled row is one light / none. */
export function chordLights(members: readonly LobbyMember[], me: string, inChord: boolean): ChordLight[] {
  if (!inChord) return []
  const seen = new Set<string>(), out: ChordLight[] = []
  const add = (m: LobbyMember) => {
    if (!m.look || seen.has(m.look)) return
    seen.add(m.look); out.push({ id: m.look, name: m.name || 'keeper', colour: chordColour(m.look), me: m.look === me })
  }
  for (const m of members) if (m.look === me) add(m)
  for (const m of members) add(m)
  return out.slice(0, MAX_LIGHTS)
}

/** Where light k of n sits on the stone's top (a ring round the centre; one light = the centre). */
export function lightSpot(k: number, n: number): { x: number; z: number } {
  if (n <= 1) return { x: 0, z: 0 }
  const a = (k / n) * Math.PI * 2, r = 0.3
  return { x: Math.cos(a) * r, z: Math.sin(a) * r }
}

// ── BETA M188 s3: THE CLUSTER CARD'S FOUR SEATS ─────────────────────────────────────────────────────────────────────────
// Alex 11-26: "only four can join and here the names can be displayed". One seat per quarter of the server record
// (src/lib/accounts/clusters.ts): a member (name, me?), a friend ASKED into it (name, how many yes still to come, did I say
// yes), or open. Me first, then the order the others came in, then the asked, then the open ones. No title (canon guard 3).
export type ClusterSeat =
  | { kind: 'member'; user_id: string; name: string; me: boolean }
  | { kind: 'asked'; quarter: string; name: string; waiting: number; youSaidYes: boolean }
  | { kind: 'open' }
export const CLUSTER_SEATS = 4
export function clusterSeats(view: ClusterView | null, me: string | null): ClusterSeat[] {
  const seats: ClusterSeat[] = []
  if (view) {
    const ms = [...view.members].sort((a, b) => Number(b.user_id === me) - Number(a.user_id === me))
    for (const m of ms) seats.push({ kind: 'member', user_id: m.user_id, name: m.username ?? 'a keeper', me: m.user_id === me })
    for (const o of view.offers) seats.push({
      kind: 'asked', quarter: o.quarter, name: o.invitee ?? 'a keeper',
      waiting: view.members.filter(m => !o.consented.includes(m.user_id)).length, youSaidYes: !!me && o.consented.includes(me),
    })
  }
  while (seats.length < CLUSTER_SEATS) seats.push({ kind: 'open' })
  return seats.slice(0, CLUSTER_SEATS)
}
