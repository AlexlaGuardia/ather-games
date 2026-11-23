// STATION WORKING SOUNDS (BETA M99; Alex 11-23: "when its running the player knows and quickly learns if you dont have a moglin
// for that station the player has to stand there"). While a carpentry / stonemason bench is CRAFTING (a run in progress and
// someone working it: its Moglin, or the keeper at the open bench), its working PHRASE repeats every PHRASE_MS, positional at the
// room. When a run lands, a small finish sting. Silent when idle, blocked (no inputs / caps full) or unstaffed.
// Candidates: each bench lists its phrases in vote order; the game plays the FIRST one Alex voted yay (sfx.ts plays only yay, so
// with none voted the bench asks for its first candidate and stays silent). Wired by yay id: a vote needs no code change.
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

export interface BenchSnap { id: string; kind: RoomKind; /** a run in progress AND someone working it (speed > 0) */ working: boolean; /** a run landed this tick */ made: boolean; at: V3 }
export interface SoundOut { id: string; at: V3 }

/** One tick. `due` = room id -> when its next phrase is due (mutated: the driver's only state). A bench that stops working loses
 *  its slot, so the next time it starts the phrase plays at once. `ear` = the keeper (null = unknown: hear everything). */
export function stationSounds(due: Map<string, number>, benches: readonly BenchSnap[], now: number, ear: { x: number; z: number } | null, isYay: (id: string) => boolean): SoundOut[] {
  const out: SoundOut[] = [], seen = new Set<string>()
  for (const b of benches) {
    const v = STATION_VOICE[b.kind]; if (!v) continue
    seen.add(b.id)
    const near = !ear || Math.hypot(b.at.x - ear.x, b.at.z - ear.z) <= HEAR_M
    if (b.made && near) { const d = pickVoice(v.done, isYay); if (d) out.push({ id: d, at: b.at }) }
    if (!b.working) { due.delete(b.id); continue }
    const t = due.get(b.id) ?? now
    if (now < t) continue
    due.set(b.id, now - t > PHRASE_MS ? now + PHRASE_MS : t + PHRASE_MS)   // a long stall (tab hidden) resets the beat, never a burst
    if (near) { const w = pickVoice(v.work, isYay); if (w) out.push({ id: w, at: b.at }) }
  }
  for (const k of [...due.keys()]) if (!seen.has(k)) due.delete(k)   // a room taken down
  return out
}
