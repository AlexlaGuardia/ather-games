// THE SPREAD — how the grey creeps back between infected nodes (Alex 11-14, numbers his; 11-15: "lets feel it out
// first and then we can tweak it so its balanced", so NO BRAKES yet: no cap, no grace after a clear, no waymark
// immunity. Those are proposed in GBOARD › THE ATHER SIDE and land only if Alex wants them after feeling this).
//
//   every SPREAD.everyDays game days: each infected node, at SPREAD.chance, infects ONE clean neighbour in its biome
//   every SPREAD.wellEveryDays game days: each clean node, at SPREAD.wellChance, wells up again on its own
//
// The world starts fully infested (the Wilds are "infested with hollows", Alex 11-14). The clock is wall time (a game
// day = 64 real minutes) and runs while the keeper is away: `advance` replays every tick between the last look and now.
// Every roll is a hash of (tick kind, tick index, node id), so a replay is exact and a test can pin it.
//
// ★ PURE. The page keeps the state in localStorage via load/save below.

import { GAME_DAY_MS, nodeAdjacency, type WildsNode } from './nodes'

/** The dials. Alex tunes these; nothing else in the file should need to change. */
export const SPREAD = { everyDays: 3, chance: 0.15, wellEveryDays: 5, wellChance: 0.03 }

export interface SpreadState { v: 2; epoch: number; at: number; clean: string[] }
export type SpreadEvent = { t: number; id: string; kind: 'spread' | 'well'; from?: string }

export const freshSpread = (now: number): SpreadState => ({ v: 2, epoch: now, at: now, clean: [] })

const roll = (kind: number, k: number, id: string) => {
  let h = (kind * 374761393 + k * 668265263) ^ 0x5bd1e995
  for (let c = 0; c < id.length; c++) h = Math.imul(h ^ id.charCodeAt(c), 2654435761)
  h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Replay every tick in (s.at, to]. Returns the new state and what happened, oldest first. */
export function advance(s: SpreadState, nodes: WildsNode[], to: number): { s: SpreadState; events: SpreadEvent[] } {
  if (to <= s.at) return { s, events: [] }
  const adj = nodeAdjacency(nodes), ids = nodes.map(n => n.id).sort()
  const clean = new Set(s.clean.filter(id => adj.has(id)))
  const events: SpreadEvent[] = []
  const P3 = SPREAD.everyDays * GAME_DAY_MS, P5 = SPREAD.wellEveryDays * GAME_DAY_MS
  let k3 = Math.floor((s.at - s.epoch) / P3) + 1, k5 = Math.floor((s.at - s.epoch) / P5) + 1
  for (let guard = 0; guard < 100000; guard++) {
    const t3 = s.epoch + k3 * P3, t5 = s.epoch + k5 * P5, t = Math.min(t3, t5)
    if (t > to) break
    if (t3 <= t5) {
      // spread: from the infected set as it stood at the tick (a node infected this tick does not spread this tick)
      const infected = ids.filter(id => !clean.has(id))
      for (const id of infected) {
        if (roll(3, k3, id) >= SPREAD.chance) continue
        const open = (adj.get(id) ?? []).filter(m => clean.has(m)).sort()
        if (!open.length) continue
        const to2 = open[Math.floor(roll(4, k3, id) * open.length)]
        clean.delete(to2); events.push({ t: t3, id: to2, kind: 'spread', from: id })
      }
      k3++
    } else {
      for (const id of ids) if (clean.has(id) && roll(5, k5, id) < SPREAD.wellChance) { clean.delete(id); events.push({ t: t5, id, kind: 'well' }) }
      k5++
    }
  }
  return { s: { ...s, at: to, clean: [...clean].sort() }, events }
}

/** The keeper killed a node's champion at time t: catch the world up to t, then that node is clean. */
export function clearAt(s: SpreadState, nodes: WildsNode[], id: string, t: number): { s: SpreadState; events: SpreadEvent[] } {
  const r = advance(s, nodes, t)
  return { s: { ...r.s, clean: [...new Set([...r.s.clean, id])].sort() }, events: r.events }
}

export const infectedIds = (s: SpreadState, nodes: WildsNode[]) => nodes.filter(n => !s.clean.includes(n.id)).map(n => n.id)

const KEY = 'ather.nodes.v2', SKEW = 'ather.nodes.skew'
export function loadSpread(now: number): SpreadState {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (v?.v === 2 && Array.isArray(v.clean)) return v } catch { /* private window */ }
  return freshSpread(now)
}
export function saveSpread(s: SpreadState) { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private window */ } }
/** Tuning only (`?tune=1`): extra ms added to the clock, so ] can skip game days. 0 in normal play. */
export function loadSkew(): number { try { return Number(localStorage.getItem(SKEW)) || 0 } catch { return 0 } }
export function saveSkew(ms: number) { try { localStorage.setItem(SKEW, String(ms)) } catch { /* private window */ } }
