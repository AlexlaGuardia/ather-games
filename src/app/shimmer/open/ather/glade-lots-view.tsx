'use client'
// ── MOONWELL GLADE, SEEN (BETA M40 part 2, layout B): the green, the path to the waymark, each lot's pad + station blockout,
// and Greg's jetty. Shapes from glade-lots.ts (the walker bumps the same parts). Flat colours, Lambert, like the rooms.
import { useEffect, useMemo, useState } from 'react'
import { GLADE_GREEN, GLADE_ANCHOR } from './moonwell'
import { GLADE_LOTS, lotAt, gladeJetty, gladeSpots } from './moonwell-glade'
import { teachJars } from './yarrow-teach'
import { STATIONS, partAt, setGladeBlueprint, gladeBlueprint, lotPad } from './glade-lots'
import { parseHouse, placeBlueprint } from './plot-blueprint'
import { BlueprintStack } from './blueprint-stack'
import { GLADE as GROUND, WATER_DROP } from './relief'
import { groundMat, groundOrder } from '../shared/ground-layers'
import { ribbonXZ, drape, ribbonsOn } from '../shared/road-ribbon'
import * as THREE from 'three'

// M58 (2): ?roads=ribbon roots the path UNDER the green (from its centre) and gives it a round end at the waymark, both on the
// layer table (path under green), so the green's edge paints over the path by order instead of 5 mm of depth (+3.0 vs +2.5 cm)
const RIBBONS = ribbonsOn()
const LAYERS = RIBBONS || undefined

const GREEN = '#a9cf7d', PATH = '#d9c9a2', PAD = '#cdb88e', DECK = '#a77b4f'

export function GladeLots() {
  const y = GROUND.y
  // M39: each lot fetches its blueprint (glade-<lot>) once; one that exists and fits stands instead of the blockout
  const [, setBpRev] = useState(0)
  useEffect(() => {
    let alive = true
    for (const l of GLADE_LOTS) fetch(`/shimmer/open/house-blueprints?id=glade-${l.id}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null)).then(j => { const bp = j ? parseHouse(j) : null; if (alive && bp) { setGladeBlueprint(l.id, bp); setBpRev(n => n + 1) } }).catch(() => {})
    // M67 s1b-2: the closed Glade's own probe (glade-cluster-view.tsx) shares this name now: MERGE, never replace
    const gw = window as unknown as { __glade?: object }
    gw.__glade = { ...(gw.__glade ?? {}), /* dev/check hook: stand a blueprint on a lot (visual + solids only, nothing saved) */ setBlueprint: (lot: string, j: unknown) => { const bp = j ? parseHouse(j) : null; setGladeBlueprint(lot, bp); setBpRev(n => n + 1); return !!bp }, blueprints: () => GLADE_LOTS.filter(l => !!gladeBlueprint(l.id)).map(l => l.id) }
    return () => { alive = false }
  }, [])
  const lots = useMemo(() => GLADE_LOTS.map(l => lotAt(l.id)!), [])
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
          <mesh position={[l.x, y + 0.035, l.z]} rotation-y={l.yaw} receiveShadow>
            <boxGeometry args={[l.w, 0.07, l.d]} /><meshLambertMaterial color={PAD} />
          </mesh>
          {gladeBlueprint(l.id) ? (() => { const bp = gladeBlueprint(l.id)!, g = placeBlueprint(bp, lotPad(l.id, y)).group; return <BlueprintStack bp={bp} x={g.x} z={g.z} y={y} rotY={g.rotY} /> })() : (STATIONS[l.id] ?? []).map((p, k) => { const c = partAt(l.id, p); return (
            <mesh key={k} position={[c.x, y + (p.y0 ?? 0) + p.h / 2, c.z]} rotation-y={c.yaw} castShadow receiveShadow>
              <boxGeometry args={[p.w, p.h, p.d]} /><meshLambertMaterial color={p.color} />
            </mesh>
          ) })}
          {/* Yarrow's teach-beat jars ride beside Yarrow when the blueprint replaced the blockout counter (yarrow-teach.ts) */}
          {l.id === 'yarrow' && gladeBlueprint(l.id) && (() => { const t = teachJars(gladeSpots(['moonwell:yarrow'])[0]); return (
            <group data-yarrow-jars>
              <mesh position={[t.crate.x, y + t.crate.h / 2, t.crate.z]} rotation-y={t.crate.yaw} castShadow receiveShadow><boxGeometry args={[t.crate.w, t.crate.h, t.crate.d]} /><meshLambertMaterial color="#6d5038" /></mesh>
              {t.jars.map((j, k) => <mesh key={k} position={[j.x, y + t.crate.h + j.h / 2, j.z]} rotation-y={t.crate.yaw} castShadow><boxGeometry args={[j.w, j.h, j.w]} /><meshLambertMaterial color="#b7d8e6" /></mesh>)}
            </group>
          ) })()}
        </group>
      ))}
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
