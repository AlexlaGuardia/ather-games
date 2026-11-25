'use client'
// ── MOONWELL GLADE, SEEN (BETA M40 part 2, layout B): the green, the path to the waymark, each lot's pad + station blockout,
// and Greg's jetty. Shapes from glade-lots.ts (the walker bumps the same parts). Flat colours, Lambert, like the rooms.
import { useEffect, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { gladePeopleVersion } from './glade-people'
import type { Ground } from './glade-pads'
import { GLADE_GREEN, GLADE_ANCHOR } from './moonwell'
import { GLADE_LOTS, lotAt, gladeJetty } from './moonwell-glade'
import { STATIONS, partAt, gladeBlueprintVersion, lotLevel, crateY, standOn, yarrowCrate, setGladeBlueprint, gladeBlueprint, lotPad } from './glade-lots'
import { parseHouse, placeBlueprint } from './plot-blueprint'
import { BlueprintStack } from './blueprint-stack'
import { GLADE as GROUND, WATER_DROP } from './relief'
import { groundMat, groundOrder } from '../shared/ground-layers'
import { ribbonXZ, drape, atherRibbonsOn } from '../shared/road-ribbon'
import * as THREE from 'three'

// M58 (2): ribbons (DEFAULT since 11-23; ?roads=legacy = old) root the path UNDER the green (from its centre) and gives it a round end at the waymark, both on the
// layer table (path under green), so the green's edge paints over the path by order instead of 5 mm of depth (+3.0 vs +2.5 cm)
const RIBBONS = atherRibbonsOn()
const LAYERS = RIBBONS || undefined

const GREEN = '#a9cf7d', PATH = '#d9c9a2', PAD = '#cdb88e', DECK = '#a77b4f'

/** every lot's blueprint, fetched and stood (M153 s1c-1: the builder's publish asks too, so houses are solid in its check) */
export const loadGladeBlueprints = (live: () => boolean = () => true, done: () => void = () => {}) => Promise.all(GLADE_LOTS.map(l => fetch(`/shimmer/open/house-blueprints?id=glade-${l.id}`, { cache: 'no-store' })
  .then(r => (r.ok ? r.json() : null)).then(j => { const bp = j ? parseHouse(j) : null; if (bp && live()) { setGladeBlueprint(l.id, bp); done() } }).catch(() => {})))
/** re-renders when a blueprint lands or somebody / some house moves; returns that version (a memo's key) */
export function useGladeStanding(): string {
  const now = () => `${gladePeopleVersion()}.${gladeBlueprintVersion()}`, [v, setV] = useState(now)
  useFrame(() => { const n = now(); if (n !== v) setV(n) })
  return v
}
/** `ground` = the land (M153 s1c-2: a lot moved in Place mode stands on it); a lot nobody moved stands on the Glade's floor */
export function GladeLots({ ground }: { ground: Ground }) {
  const y = GROUND.y, standing = useGladeStanding()
  // M39: each lot fetches its blueprint (glade-<lot>) once; one that exists and fits stands instead of the blockout
  const [, setBpRev] = useState(0), { scene } = useThree()
  useEffect(() => {
    let alive = true
    void loadGladeBlueprints(() => alive, () => setBpRev(n => n + 1))
    // M67 s1b-2: the closed Glade's own probe (glade-cluster-view.tsx) shares this name now: MERGE, never replace
    const gw = window as unknown as { __glade?: object }
    gw.__glade = { ...(gw.__glade ?? {}), /* dev/check hook: stand a blueprint on a lot (visual + solids only, nothing saved) */ setBlueprint: (lot: string, j: unknown) => { const bp = j ? parseHouse(j) : null; setGladeBlueprint(lot, bp); setBpRev(n => n + 1); return !!bp }, blueprints: () => GLADE_LOTS.filter(l => !!gladeBlueprint(l.id)).map(l => l.id),
      /* M153 s1c-2: where the houses are DRAWN (scripts/glade-places-check.mts) */ houses: () => { const out: { id: string; x: number; y: number; z: number; yaw: number }[] = []; scene.traverse(o => { const id = o.userData?.gladeHouse as string | undefined; if (id) { const p = new THREE.Vector3(), q = o.getWorldQuaternion(new THREE.Quaternion()); o.getWorldPosition(p); const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q); out.push({ id, x: p.x, y: p.y, z: p.z, yaw: Math.atan2(f.x, f.z) }) } }); return out } }
    return () => { alive = false }
  }, [])
  const lots = useMemo(() => GLADE_LOTS.map(l => ({ ...lotAt(l.id)!, ...lotLevel(l.id, ground, y) })), [standing, ground, y])   // eslint-disable-line react-hooks/exhaustive-deps
  const crate = useMemo(() => { const t = yarrowCrate(); return t && { ...t, y: crateY(standOn(ground), y) } }, [standing, ground, y])   // eslint-disable-line react-hooks/exhaustive-deps
  const jetty = useMemo(() => { const j = gladeJetty(); return { ...j, len: Math.hypot(j.x1 - j.x0, j.z1 - j.z0), yaw: Math.atan2(j.x1 - j.x0, j.z1 - j.z0) } }, [])
  const path = useMemo(() => { const z0 = GLADE_GREEN.z + GLADE_GREEN.r - 0.5, z1 = GLADE_ANCHOR.z - 1; return { z: (z0 + z1) / 2, len: z1 - z0 } }, [])
  const pathRibbon = useMemo(() => {
    if (!RIBBONS) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(drape(ribbonXZ([[GLADE_GREEN.x, GLADE_GREEN.z], [GLADE_GREEN.x, GLADE_ANCHOR.z - 1]], 1.5), () => y + 0.025), 3))
    g.computeVertexNormals(); return g
  }, [y])
  return (
    <group>
      {/* the green */}
      <mesh position={[GLADE_GREEN.x, y + 0.03, GLADE_GREEN.z]} rotation-x={-Math.PI / 2} receiveShadow renderOrder={groundOrder('green', LAYERS)}>
        <circleGeometry args={[GLADE_GREEN.r, 48]} /><meshLambertMaterial color={GREEN} {...groundMat('green', undefined, LAYERS)} />
      </mesh>
      {/* the path from the green's open end to the waymark */}
      {pathRibbon ? (
        <mesh geometry={pathRibbon} receiveShadow renderOrder={groundOrder('path', true)}><meshLambertMaterial color={PATH} side={THREE.DoubleSide} {...groundMat('path', undefined, true)} /></mesh>
      ) : (
        <mesh position={[GLADE_GREEN.x, y + 0.025, path.z]} rotation-x={-Math.PI / 2} receiveShadow renderOrder={groundOrder('path')}>
          <planeGeometry args={[3, path.len]} /><meshLambertMaterial color={PATH} {...groundMat('path')} />
        </mesh>
      )}
      {/* the five lots: a pad, and the trade's station on it */}
      {lots.map(l => (
        <group key={l.id}>
          <mesh position={[l.x, (l.top + 0.07 + l.low) / 2, l.z]} rotation-y={l.yaw} receiveShadow userData={{ gladeHouse: l.id }}>
            <boxGeometry args={[l.w, l.top - l.low + 0.07, l.d]} /><meshLambertMaterial color={PAD} />
          </mesh>
          {gladeBlueprint(l.id) ? (() => { const bp = gladeBlueprint(l.id)!, g = placeBlueprint(bp, lotPad(l.id, l.top)).group; return <BlueprintStack bp={bp} x={g.x} z={g.z} y={l.top} rotY={g.rotY} /> })() : (STATIONS[l.id] ?? []).map((p, k) => { const c = partAt(l.id, p); return (
            <mesh key={k} position={[c.x, l.top + (p.y0 ?? 0) + p.h / 2, c.z]} rotation-y={c.yaw} castShadow receiveShadow>
              <boxGeometry args={[p.w, p.h, p.d]} /><meshLambertMaterial color={p.color} />
            </mesh>
          ) })}
        </group>
      ))}
      {/* Yarrow's teach-beat jars ride beside Yarrow's door when the blueprint replaced the blockout counter (yarrow-teach.ts) */}
      {crate && <group data-yarrow-jars>
        <mesh position={[crate.crate.x, crate.y + crate.crate.h / 2, crate.crate.z]} rotation-y={crate.crate.yaw} castShadow receiveShadow userData={{ gladeHouse: 'jars' }}><boxGeometry args={[crate.crate.w, crate.crate.h, crate.crate.d]} /><meshLambertMaterial color="#6d5038" /></mesh>
        {crate.jars.map((j, k) => <mesh key={k} position={[j.x, crate.y + crate.crate.h + j.h / 2, j.z]} rotation-y={crate.crate.yaw} castShadow><boxGeometry args={[j.w, j.h, j.w]} /><meshLambertMaterial color="#b7d8e6" /></mesh>)}
      </group>}
      {/* Greg's jetty: a plank deck from the bank out over the water, on posts */}
      <group position={[(jetty.x0 + jetty.x1) / 2, y - 0.08, (jetty.z0 + jetty.z1) / 2]} rotation-y={jetty.yaw}>
        <mesh castShadow receiveShadow><boxGeometry args={[jetty.w, 0.16, jetty.len]} /><meshLambertMaterial color={DECK} /></mesh>
        {[-1, 1].flatMap(s => [-0.35, 0.05, 0.45].map(t => (
          <mesh key={`${s}${t}`} position={[s * (jetty.w / 2 - 0.12), -(WATER_DROP + 0.9) / 2, t * jetty.len]}><boxGeometry args={[0.18, WATER_DROP + 0.9, 0.18]} /><meshLambertMaterial color={DECK} /></mesh>
        )))}
      </group>
    </group>
  )
}
