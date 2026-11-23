'use client'
// The idle village, drawn (moglins-idle.ts has the rules). Mounted in the plot zone on the keeper's OWN plot (page.tsx);
// re-reads the village every few seconds like MoglinsAtWork, so a recruit appears, and leaves the arc once given a room.
import { useEffect, useMemo, useState } from 'react'
import { MoglinModel, furOf } from '../shared/moglin-model'
import { loadVillage, saveVillage, partWith, type Village } from './moglins'
import type { TalkNode } from '../shared/npc-talk'
import { hudSay } from '../shared/hud-say'
import { MOGLIN_HEIGHT } from '../shared/moglin-model'
import { floorAt } from './plot-found'
import { GROUND_Y } from './plot'
import { tableAt, TABLE, type Works } from './rooms'
import { idleOf, idleSpot, idleTalk, IDLE_LINES, type IdleScreen } from './moglins-idle'

/** where each idle Moglin stands right now (page.tsx aims E at these), with its name and ground height */
/** fired after a parting so the arc redraws at once (not on the next 3 s re-read) */
const VILLAGE_EVENT = 'open:village'
export let idleDrawn: { id: string; name: string; x: number; z: number; y: number }[] = []

export function IdleMoglins({ w }: { w: Works }) {
  const [v, setV] = useState<Village | null>(() => (typeof window === 'undefined' ? null : loadVillage()))
  useEffect(() => { const re = () => setV(loadVillage()), t = setInterval(re, 3000); window.addEventListener(VILLAGE_EVENT, re); return () => { clearInterval(t); window.removeEventListener(VILLAGE_EVENT, re) } }, [])
  const idle = v ? idleOf(v.moglins, w) : []
  idleDrawn = idle.map((m, k) => { const p = idleSpot(k, idle.length, tableAt(w) ?? TABLE); return { id: m.id, name: m.name, x: p.x, z: p.z, y: floorAt(w, GROUND_Y, p.x, p.z) } })
  useEffect(() => () => { idleDrawn = [] }, [])
  useEffect(() => {   // probe (checks): the ids standing idle
    (window as unknown as { __moglinsIdle?: string[] }).__moglinsIdle = idle.map(m => m.id)
  })
  return (
    <>
      {idle.map((m, k) => {
        const s = idleSpot(k, idle.length, tableAt(w) ?? TABLE)
        return (
          <group key={m.id} position={[s.x, floorAt(w, GROUND_Y, s.x, s.z), s.z]} rotation-y={s.yaw} userData={{ moglinIdle: m.id }}>
            <MoglinModel action="idle" tone={furOf(m.id)} seed={m.id.length} />
          </group>
        )
      })}
    </>
  )
}

/** The talk with an idle Moglin (page.tsx holds { id, screen } in its Panel). `close` ends it. */
export function useIdleTalk(c: { id: string; screen: IdleScreen } | null, set: (c: { id: string; screen: IdleScreen } | null) => void) {
  const at = c ? idleDrawn.find(d => d.id === c.id) ?? null : null
  const node: TalkNode | null = useMemo(() => {
    if (!c) return null
    const m = loadVillage().moglins.find(x => x.id === c.id); if (!m) return null
    return idleTalk(m, c.screen, {
      go: s => set(s ? { id: c.id, screen: s } : null),
      part: () => { const nv = partWith(loadVillage(), c.id); if (nv) { saveVillage(nv); window.dispatchEvent(new Event(VILLAGE_EVENT)); hudSay(IDLE_LINES.gone(m.name), 'info', 5) } },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id, c?.screen])
  return { node, name: at?.name ?? '', head: at ? { x: at.x, y: at.y + MOGLIN_HEIGHT.chibi, z: at.z } : null }
}
