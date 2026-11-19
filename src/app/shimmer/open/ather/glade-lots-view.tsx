'use client'
// ── MOONWELL GLADE, SEEN (BETA M40 part 2, layout B): the green, the path to the waymark, each lot's pad + station blockout,
// and Greg's jetty. Shapes from glade-lots.ts (the walker bumps the same parts). Flat colours, Lambert, like the rooms.
import { useMemo } from 'react'
import { GLADE_GREEN } from './moonwell'
import { GLADE_LOTS, lotAt, gladeJetty } from './moonwell-glade'
import { STATIONS, partAt } from './glade-lots'
import { GLADE as GROUND, WATER_DROP } from './relief'
import { GREG_WAYMARK } from './waymarks'

const GREEN = '#a9cf7d', PATH = '#d9c9a2', PAD = '#cdb88e', DECK = '#a77b4f'

export function GladeLots() {
  const y = GROUND.y
  const lots = useMemo(() => GLADE_LOTS.map(l => lotAt(l.id)!), [])
  const jetty = useMemo(() => { const j = gladeJetty(); return { ...j, len: Math.hypot(j.x1 - j.x0, j.z1 - j.z0), yaw: Math.atan2(j.x1 - j.x0, j.z1 - j.z0) } }, [])
  const path = useMemo(() => { const z0 = GLADE_GREEN.z + GLADE_GREEN.r - 0.5, z1 = GREG_WAYMARK.z - 1; return { z: (z0 + z1) / 2, len: z1 - z0 } }, [])
  return (
    <group>
      {/* the green */}
      <mesh position={[GLADE_GREEN.x, y + 0.03, GLADE_GREEN.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[GLADE_GREEN.r, 48]} /><meshLambertMaterial color={GREEN} />
      </mesh>
      {/* the path from the green's open end to the waymark */}
      <mesh position={[GLADE_GREEN.x, y + 0.025, path.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[3, path.len]} /><meshLambertMaterial color={PATH} />
      </mesh>
      {/* the five lots: a pad, and the trade's station on it */}
      {lots.map(l => (
        <group key={l.id}>
          <mesh position={[l.x, y + 0.035, l.z]} rotation-y={l.yaw} receiveShadow>
            <boxGeometry args={[l.w, 0.07, l.d]} /><meshLambertMaterial color={PAD} />
          </mesh>
          {(STATIONS[l.id] ?? []).map((p, k) => { const c = partAt(l.id, p); return (
            <mesh key={k} position={[c.x, y + (p.y0 ?? 0) + p.h / 2, c.z]} rotation-y={c.yaw} castShadow receiveShadow>
              <boxGeometry args={[p.w, p.h, p.d]} /><meshLambertMaterial color={p.color} />
            </mesh>
          ) })}
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
