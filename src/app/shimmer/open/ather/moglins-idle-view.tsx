'use client'
// The idle village, drawn (moglins-idle.ts has the rules). Mounted in the plot zone on the keeper's OWN plot (page.tsx);
// re-reads the village every few seconds like MoglinsAtWork, so a recruit appears, and leaves the arc once given a room.
import { useEffect, useState } from 'react'
import { MoglinModel, furOf } from '../shared/moglin-model'
import { loadVillage, type Village } from './moglins'
import { floorAt } from './plot-found'
import { GROUND_Y } from './plot'
import type { Works } from './rooms'
import { idleOf, idleSpot } from './moglins-idle'

export function IdleMoglins({ w }: { w: Works }) {
  const [v, setV] = useState<Village | null>(() => (typeof window === 'undefined' ? null : loadVillage()))
  useEffect(() => { const t = setInterval(() => setV(loadVillage()), 3000); return () => clearInterval(t) }, [])
  const idle = v ? idleOf(v.moglins, w) : []
  useEffect(() => {   // probe (checks): the ids standing idle
    (window as unknown as { __moglinsIdle?: string[] }).__moglinsIdle = idle.map(m => m.id)
  })
  return (
    <>
      {idle.map((m, k) => {
        const s = idleSpot(k, idle.length)
        return (
          <group key={m.id} position={[s.x, floorAt(w, GROUND_Y, s.x, s.z), s.z]} rotation-y={s.yaw} userData={{ moglinIdle: m.id }}>
            <MoglinModel action="idle" tone={furOf(m.id)} seed={m.id.length} />
          </group>
        )
      })}
    </>
  )
}
