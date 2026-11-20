'use client'
// ── GENERATED SETTLEMENTS, BUILT, SEEN (BETA M39 slice 3): each lot's pad + its trade's plank house (blueprint `trade-<profession>`
// fetched like the Glade's, else the blockout), drawn with the plot's own wall renderer, turned to face the settlement's centre.
// Only settlements within the folk's mount radius (FOLK_DRAW_R) stand buildings (the heap/draw budget); the walker's boxes are
// registered here and withdrawn when the settlement is out of range. Shapes + rules: settlement-lots.ts.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Network, Settlement } from './network'
import { SEASON } from './network'
import { settlementLots, tradeBuilding, setTradeBlueprint, setSettlementBoxes, lotBoxes, lotPadOf, tradeBlueprintId, TRADES, type SettlementLot } from './settlement-lots'
import { parseHouse, placeBlueprint } from './plot-blueprint'
import { BlueprintBuilding } from './workshop'

const PAD = '#cdb88e'
export const BUILD_R = 110   // = network-scene FOLK_DRAW_R (kept literal: network-scene imports this file)

function Lot({ l, y }: { l: SettlementLot; y: number }) {
  const bp = tradeBuilding(l.profession), g = placeBlueprint(bp, lotPadOf(l, y)).group
  return (
    <group>
      <mesh position={[l.x, y + 0.035, l.z]} rotation-y={l.yaw} receiveShadow><boxGeometry args={[l.w, 0.07, l.d]} /><meshLambertMaterial color={PAD} /></mesh>
      <BlueprintBuilding walls={bp.walls} roof={bp.roof} floors={bp.floors} x={g.x} z={g.z} y={y} rotY={g.rotY} />
    </group>
  )
}

export function SettlementBuildings({ net, loaded }: { net: Network; loaded: (x: number, z: number) => number | null }) {
  const [near, setNear] = useState<string[]>([]), [rev, setRev] = useState(0)
  const acc = useRef(0), fetched = useRef(false)
  useEffect(() => {
    if (fetched.current) return; fetched.current = true
    let alive = true
    for (const p of TRADES) fetch(`/shimmer/open/house-blueprints?id=${tradeBlueprintId(p)}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null)).then(j => { const bp = j ? parseHouse(j) : null; if (alive && bp) { setTradeBlueprint(p, bp); setRev(n => n + 1) } }).catch(() => {})
    const on = () => setRev(n => n + 1); window.addEventListener('settlement-blueprints', on)
    return () => { alive = false; window.removeEventListener('settlement-blueprints', on) }
  }, [])
  useFrame(({ camera }, dt) => {
    acc.current += dt; if (acc.current < 1) return; acc.current = 0
    const ids = net.settlements.filter(s => Math.hypot(s.x - camera.position.x, s.z - camera.position.z) < BUILD_R && loaded(s.x, s.z) !== null).map(s => s.id)
    setNear(cur => (cur.join() === ids.join() ? cur : ids))
  })
  const built = useMemo(() => {
    const out: { s: Settlement; y: number; lots: SettlementLot[] }[] = []
    for (const id of near) { const s = net.settlements.find(x => x.id === id); if (!s) continue; const lots = settlementLots(s, SEASON); if (lots.length) out.push({ s, y: loaded(s.x, s.z) ?? 0, lots }) }
    return out
  }, [near, net, rev])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    for (const b of built) setSettlementBoxes(b.s.id, b.lots.flatMap(l => lotBoxes(l, loaded(l.x, l.z) ?? b.y)))
    return () => { for (const b of built) setSettlementBoxes(b.s.id, null) }
  }, [built])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { (window as unknown as { __settlements?: object }).__settlements = { built: () => built.map(b => ({ id: b.s.id, lots: b.lots.map(l => ({ id: l.id, profession: l.profession, folkId: l.folkId, x: l.x, z: l.z, yaw: l.yaw })) })) } }, [built])
  return <>{built.flatMap(b => b.lots.map(l => <Lot key={l.id + rev} l={l} y={loaded(l.x, l.z) ?? b.y} />))}</>
}
