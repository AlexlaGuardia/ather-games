// ── THE ALCHEMIST AT THE SET (M57 slice 2, Alex 11-21 via hub 9bf57e68 #15616) ─────────────────────────────────────────────
// Alchemist Moglins do NOT run the stations. A recruited alchemist set to stand at an Alchemy Desk gives a PASSIVE boon: when a
// brew FINISHES (the last step's collect) within BOON_RANGE of where it stands, each participant rolls once for ONE extra bottle
// (solo keeper now; every hand in a party brewing is slice 3, so the roll already takes a participant count). The chance scales
// with the Moglin's potions skill (moglin-skills.ts, the same grade the old alchemy room read). The best alchemist in range
// counts, never a sum (no stacking). No alchemist in range = no boon, nothing else changes.
// Build calls (Jin, tell hub): the alchemist's "place" is the Desk: its `room` is `set:<desk piece id>` (one alchemist per Desk),
// set from the Desk's panel; it is drawn standing in front of that Desk. A Desk picked up leaves it resting (its room points at a
// piece that is gone, so nothing counts and nothing draws). Pure. Run: npx tsx src/app/shimmer/open/ather/alchemist-boon.test.ts
import { FURNITURE } from './furniture'
import { skillsOf } from './moglin-skills'
import type { Grade, MoglinRecord, Village } from './moglins'
import type { Piece, Works } from './rooms'

/** chance of one extra bottle per participant, by the alchemist's potions grade (hub's curve: fair 5% .. rare 25%) */
export const BOON_CHANCE: Readonly<Record<Grade, number>> = { 1: 0.05, 2: 0.1, 3: 0.15, 4: 0.2, 5: 0.25 }
/** "near": metres from where the alchemist stands to the piece the brew finishes at */
export const BOON_RANGE = 6
/** how far in front of its Desk the alchemist stands */
export const STAND_OFF = 1.1

export const setRoom = (deskId: string) => `set:${deskId}`
export const deskOfRoom = (room: string | undefined) => (room?.startsWith('set:') ? room.slice(4) : null)
export const isDesk = (p: Piece | undefined) => !!p && FURNITURE[p.item]?.alc === 'desk'
export const potionsGrade = (m: MoglinRecord): Grade => skillsOf(m).potions as Grade

/** Where an alchemist stands at its Desk: STAND_OFF out from the Desk's front, facing it. Null if the Desk is not on the plot. */
export function standAt(w: Works, m: MoglinRecord): { x: number; z: number; yaw: number } | null {
  const d = w.pieces.find(p => p.id === deskOfRoom(m.room))
  if (!isDesk(d)) return null
  const yaw = -d!.q * Math.PI / 2, fx = Math.sin(yaw), fz = Math.cos(yaw)   // the piece's front = local +z turned by q
  return { x: d!.x + fx * STAND_OFF, z: d!.z + fz * STAND_OFF, yaw: yaw + Math.PI }
}

/** The best alchemist standing within BOON_RANGE of piece `at`: its chance, or 0. Only alchemists count (the trade, not the skill). */
export function boonAt(v: Village, w: Works, at: string): { chance: number; who: MoglinRecord | null } {
  const p = w.pieces.find(x => x.id === at)
  if (!p) return { chance: 0, who: null }
  let best: { chance: number; who: MoglinRecord | null } = { chance: 0, who: null }
  for (const m of v.moglins) {
    if (m.profession !== 'alchemist') continue
    const s = standAt(w, m)
    if (!s || Math.hypot(s.x - p.x, s.z - p.z) > BOON_RANGE) continue
    const c = BOON_CHANCE[potionsGrade(m)]
    if (c > best.chance) best = { chance: c, who: m }
  }
  return best
}

/** One roll per participant: how many extra bottles. `rnd` in [0,1). */
export function extraBottles(chance: number, participants: number, rnd: () => number): number {
  let n = 0
  for (let k = 0; k < participants; k++) if (rnd() < chance) n++
  return n
}

/** Set alchemist `mid` to stand at Desk `deskId` (null = rest). Only an alchemist, only a Desk on the plot, one per Desk. */
export function assignSet(v: Village, w: Works, mid: string, deskId: string | null): Village | null {
  const m = v.moglins.find(x => x.id === mid)
  if (!m || m.profession !== 'alchemist') return null
  if (deskId === null) return { ...v, moglins: v.moglins.map(x => (x.id === mid ? { ...x, room: undefined, acc: 0 } : x)) }
  if (!isDesk(w.pieces.find(p => p.id === deskId))) return null
  if (v.moglins.some(x => x.id !== mid && x.room === setRoom(deskId))) return null
  return { ...v, moglins: v.moglins.map(x => (x.id === mid ? { ...x, room: setRoom(deskId), acc: 0 } : x)) }
}

/** What the alchemist does, in the panel and on its row (hub: the card says what it does). */
export const boonLine = (m: MoglinRecord) => `+${Math.round(BOON_CHANCE[potionsGrade(m)] * 100)}% chance of an extra bottle at your alchemy set.`
