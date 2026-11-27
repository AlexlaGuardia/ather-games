'use client'
// THE BOOP's page side (BETA M232, rules in shared/boop.ts). Hands out (nothing drawn, nothing held):
//   · the punch comes from the 'Melee' key (the pad's fire button via pad-bridge, the phone's hit button) or the mouse's
//     right button under pointer lock: the hands swing (melee-view swing(): on the plot it also lands on furniture, as ever);
//   · a Hollow in reach takes the fist (combat-layer takes the punch on its next frame: combat.ts punchHollow);
//   · another keeper in reach is TOLD (relay BOOP_KIND, addressed to them); their own walker moves them or only tilts.
//   · a boop addressed to this keeper goes to our walker (walker.tsx takeBoop).
import { useEffect, useRef } from 'react'
import { swing } from './melee-view'
import { isBuilding } from './build-mode'
import { openNet, openPeers } from '../shared/open-mp'
import { throwPunch, pickPunchTarget, pushDir, decodeBoop, receiveBoop, noteBoop, boopLog, BOOP_KIND } from '../shared/boop'
import { setPadHands } from '../shared/pad-bridge'

const STALE_MS = 8_000   // open-mp's: a peer not heard from in this long is not there

export function BoopLayer({ stowed, holding, pose }: {
  stowed: () => boolean
  holding: () => boolean
  pose: () => { x: number; y?: number; z: number; yaw: number } | null
}) {
  const st = useRef(stowed); st.current = stowed
  const ho = useRef(holding); ho.current = holding
  const po = useRef(pose); po.current = pose
  // the pad's fire / aim buttons read what the hands hold (pad.ts PadCtx), every 100 ms is plenty
  useEffect(() => {
    const t = setInterval(() => setPadHands(st.current(), ho.current()), 100)
    return () => { clearInterval(t); setPadHands(false, false) }
  }, [])
  useEffect(() => {
    const punch = () => {
      if (!st.current() || isBuilding() || document.querySelector('[data-panel]')) return
      if (!throwPunch()) return
      swing()   // the hands play a punch (and on the plot it lands on the furniture in front, melee-view's own rule)
      const me = po.current(), net = openNet(); if (!me || !net) return
      const now = performance.now()
      const peers = [...(openPeers().current?.values() ?? [])].filter(p => now - p.lastSeen <= STALE_MS && p.id !== net.self)
      const t = pickPunchTarget(me, peers.map(p => ({ id: p.id, x: p.x, y: p.y, z: p.z })))
      if (!t) return
      const d = pushDir(me, t)
      net.relay(BOOP_KIND, { x: d.x, z: d.z }, t.id)
      noteBoop('peer', undefined, t.id)
    }
    const key = (e: KeyboardEvent) => { if (e.code === 'Melee') punch() }
    const down = (e: MouseEvent) => { if (e.button === 2 && document.pointerLockElement) punch() }
    addEventListener('keydown', key); addEventListener('mousedown', down)
    ;(window as unknown as { __boop?: unknown }).__boop = { log: boopLog, punch, receive: (x: number, z: number) => receiveBoop({ x, z }) }   // probes (m232-check)
    return () => { removeEventListener('keydown', key); removeEventListener('mousedown', down) }
  }, [])
  // a boop addressed to this keeper (open-mp hands every relay to every listener; the server routes `to`)
  const net = openNet(), onRelay = net?.onRelay
  useEffect(() => {
    if (!onRelay) return
    return onRelay(m => {
      if (m.kind !== BOOP_KIND) return
      const d = decodeBoop(m.data); if (!d) return
      receiveBoop(d); noteBoop('got', undefined, m.from)
    })
  }, [onRelay])
  return null
}
