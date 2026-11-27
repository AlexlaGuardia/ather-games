'use client'
// BETA M241: the wild forage spots, drawn + picked. Rules + save in forage.ts. A wild moonberry bush is the moonberry-bush
// model (scenery.ts BUSHES, drawn by SceneryView: page.tsx adds the woodland ones as scenery pieces); this file draws what
// changes when it is picked: the blue berries on it. A Firewort spot is a small code-drawn clump of red-orange herb that shows
// a cut stub once picked. Blockout looks (Alex judges later).
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { loadPicks, savePicks, pickSpot, isPicked, prunePicks, type ForageSpot, type Picks } from './forage'
import { getInv, setInv } from '../shared/bag'
import { give, itemDef } from '../shared/inventory'
import { hudSay } from '../shared/hud-say'
import type { Prop } from '../../world/builder-props'

// ── the store (one per keeper) ────────────────────────────────────────────────────────────────────────────────────────
let picks: Picks | null = null
const subs = new Set<() => void>()
const EMPTY: Picks = {}
function current(): Picks { if (!picks) picks = typeof window === 'undefined' ? EMPTY : prunePicks(loadPicks(), Date.now()); return picks }
export const getPicks = () => current()
export function setPicks(p: Picks) { if (p === current()) return; picks = p; savePicks(p); subs.forEach(f => f()) }
export const usePicks = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, current, () => EMPTY)

/** E on a spot: pick it into the bag. Returns what went in (null = still growing back, or the bag is full). */
export function pickForage(s: ForageSpot, now = Date.now()): { id: string; n: number }[] | null {
  const r = pickSpot(current(), s, now)
  if (!r) return null
  let inv = getInv(); const got: { id: string; n: number }[] = []
  for (const g of r.give) { const x = give(inv, g.id, g.n); inv = x.inv; if (g.n - x.left > 0) got.push({ id: g.id, n: g.n - x.left }) }
  if (!got.length) { hudSay('Your bag is full.', 'info', 3); return null }   // TODO @lark
  setInv(inv); setPicks(r.picks)
  hudSay(got.map(g => `+${g.n} ${itemDef(g.id).name}`).join(' · '), 'item', 3)
  return got
}
/** the prompt over an unpicked spot (TODO @lark: plain functional label) */
export const foragePrompt = (s: ForageSpot) => `E · pick ${s.kind === 'moonberry' ? 'Moonberry' : 'Firewort'}`
/** the woodland bushes as scenery pieces (the model draws them; never solid) */
export const bushProps = (spots: readonly ForageSpot[]): Prop[] =>
  spots.filter(s => s.kind === 'moonberry' && s.id.startsWith('fm:')).map(s => ({ id: s.id, k: 'bush:moonberry-bush', x: s.x, z: s.z, q: (s.x * 7.3 + s.z * 3.1) % 4, s: 1 }) as Prop)

function useNow(ms: number) { const [n, setN] = useState(() => Date.now()); useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t) }, [ms]); return n }
const BERRY: readonly (readonly [number, number, number])[] = [[0.32, 0.42, 0.22], [-0.28, 0.48, 0.25], [0.1, 0.58, -0.3], [-0.2, 0.35, -0.38], [0.4, 0.3, -0.12], [-0.42, 0.3, 0.02], [0.05, 0.62, 0.1]]

/** Berries on the unpicked bushes, Firewort clumps (or stubs) — only the spots within `r` m of the keeper. */
export function ForageView({ spots, ground, focus, r = 70 }: { spots: readonly ForageSpot[]; ground: (x: number, z: number) => number; focus: React.MutableRefObject<{ x: number; z: number }>; r?: number }) {
  const p = usePicks(), now = useNow(5000), [tick, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick(k => k + 1), 2000); return () => clearInterval(t) }, [])
  const near = useMemo(() => { const f = focus.current; return spots.filter(s => Math.abs(s.x - f.x) < r && Math.abs(s.z - f.z) < r) }, [spots, focus, r, tick])   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group name="forage">
      {near.map(s => {
        const y = ground(s.x, s.z); if (!Number.isFinite(y)) return null
        const picked = isPicked(p, s.id, now)
        if (s.kind === 'moonberry') return picked ? null : (
          <group key={s.id} position={[s.x, y, s.z]} userData={{ forage: s.id }}>
            {BERRY.map(([x, yy, z], i) => <mesh key={i} position={[x, yy, z]}><sphereGeometry args={[0.055, 6, 5]} /><meshLambertMaterial color="#4f7fe0" emissive="#1d3a8a" /></mesh>)}
          </group>)
        return (
          <group key={s.id} position={[s.x, y, s.z]} userData={{ forage: s.id, picked }}>
            {picked
              ? <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.1, 0.12, 0.08, 6]} /><meshLambertMaterial color="#6b7a3a" /></mesh>
              : [0, 1, 2, 3, 4].map(i => { const a = i * 1.257, d = i ? 0.12 : 0, h = 0.35 + (i % 2) * 0.12
                return <mesh key={i} position={[Math.cos(a) * d, h / 2, Math.sin(a) * d]}><coneGeometry args={[0.06, h, 5]} /><meshLambertMaterial color={i % 2 ? '#e8552e' : '#c9401f'} emissive="#5a1a08" /></mesh> })}
          </group>)
      })}
    </group>
  )
}
