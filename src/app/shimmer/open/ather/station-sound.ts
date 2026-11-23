// STATION WORKING SOUNDS (BETA M99; Alex 11-23: "when its running the player knows and quickly learns if you dont have a moglin
// for that station the player has to stand there"). While a carpentry / stonemason bench is CRAFTING (a run in progress and
// someone working it: its Moglin, or the keeper at the open bench), its working PHRASE repeats every PHRASE_MS, positional at the
// room. When a run lands, a small finish sting. Silent when idle, blocked (no inputs / caps full) or unstaffed.
// Candidates: each bench lists its phrases; the game picks at random among ALL the ones Alex voted yay, never one 3 times running
// (hub 11-23, he yay'd both). With none voted the bench asks for its first candidate and stays silent (sfx.ts plays only yay).
// Wired by yay id: a vote needs no code change.
// ★ PURE: no React, no audio. workshop.tsx stationTick feeds it once a second and plays what it returns.
import type { RoomKind } from './rooms'

export interface V3 { x: number; y: number; z: number }
export interface BenchVoice { work: readonly string[]; done: readonly string[] }
export const STATION_VOICE: Partial<Record<RoomKind, BenchVoice>> = {
  carpentry: { work: ['work-carp-saw', 'work-carp-plane'], done: ['work-done-wood'] },
  stonemason: { work: ['work-mason-chisel', 'work-mason-rasp'], done: ['work-done-stone'] },
}
/** one phrase every this many ms (the recipes run ~2.1 s, so a beat of quiet between; a whole number of stationTick's 1 s ticks,
 *  so the beat stays even) */
export const PHRASE_MS = 3000
/** beyond this many metres from the keeper a bench is not heard at all (the panner has faded it to almost nothing by then) */
export const HEAR_M = 28

/** the id to play out of a candidate list: the first yay, else the first (asked, silent) */
export function pickVoice(ids: readonly string[], isYay: (id: string) => boolean): string | null {
  return ids.find(isYay) ?? ids[0] ?? null
}
/** how many times running one phrase may play before the pool must pick another (hub 11-23: 'not the same one 3 times running') */
export const MAX_RUN = 2
/** Alex yay'd BOTH loops per bench (11-23): pick at random among ALL the yay'd ids, never the same one MAX_RUN + 1 times running.
 *  `hist` = this bench's recent picks (mutated, newest last). None yay'd = the first candidate (asked, silent). */
export function pickFromPool(ids: readonly string[], isYay: (id: string) => boolean, hist: string[], rnd: () => number = Math.random): string | null {
  const yay = ids.filter(isYay)
  if (yay.length <= 1) return pickVoice(ids, isYay)
  const tail = hist.slice(-MAX_RUN), stuck = tail.length === MAX_RUN && tail.every(h => h === tail[0]) ? tail[0] : null
  const pool = stuck ? yay.filter(i => i !== stuck) : yay
  const id = pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))]
  hist.push(id); if (hist.length > MAX_RUN) hist.shift()
  return id
}

export interface BenchSnap { id: string; kind: RoomKind; /** a run in progress AND someone working it (speed > 0) */ working: boolean; /** a run landed this tick */ made: boolean; at: V3 }
export interface SoundOut { id: string; at: V3 }

/** One tick. `due` = room id -> when its next phrase is due (mutated: the driver's only state). A bench that stops working loses
 *  its slot, so the next time it starts the phrase plays at once. `ear` = the keeper (null = unknown: hear everything). */
export function stationSounds(due: Map<string, number>, benches: readonly BenchSnap[], now: number, ear: { x: number; z: number } | null, isYay: (id: string) => boolean,
  hist: Map<string, string[]> = new Map(), rnd: () => number = Math.random): SoundOut[] {
  const pick = (key: string, ids: readonly string[]) => { let h = hist.get(key); if (!h) hist.set(key, h = []); return pickFromPool(ids, isYay, h, rnd) }
  const out: SoundOut[] = [], seen = new Set<string>()
  for (const b of benches) {
    const v = STATION_VOICE[b.kind]; if (!v) continue
    seen.add(b.id)
    const near = !ear || Math.hypot(b.at.x - ear.x, b.at.z - ear.z) <= HEAR_M
    if (b.made && near) { const d = pick(b.id + '#done', v.done); if (d) out.push({ id: d, at: b.at }) }
    if (!b.working) { due.delete(b.id); continue }
    const t = due.get(b.id) ?? now
    if (now < t) continue
    due.set(b.id, now - t > PHRASE_MS ? now + PHRASE_MS : t + PHRASE_MS)   // a long stall (tab hidden) resets the beat, never a burst
    if (near) { const w = pick(b.id, v.work); if (w) out.push({ id: w, at: b.at }) }
  }
  for (const k of [...due.keys()]) if (!seen.has(k)) due.delete(k)   // a room taken down
  for (const k of [...hist.keys()]) if (!seen.has(k.split('#')[0])) hist.delete(k)
  return out
}
