'use client'
// THE BACKPACK in the Wilds (BETA M20): the store, the drop, the look and the touch. Rules in backpack.ts (pure, tested).
//   the page's 'down' handler calls  fallAndDrop(x, y, z)  where the keeper fell (before it sends them home)
//   the page mounts                  <DeathPack active={zone is the Wilds} />  (draws it, reclaims it on a walk-over)
// Saved per keeper (PACK_KEY in KEEPER_KEY_SPECS) so a reload mid-run keeps it, and so does its hidden clock.

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import { keeperKey } from '@/lib/keeper-local'
import { getInv, setInv } from '../shared/bag'
import { hudSay } from '../shared/hud-say'
import { dropPack, reclaim, parsePack, near, PACK_KEY, type Pack } from './backpack'

// ── the store ────────────────────────────────────────────────────────────────────────────────────────────────
// ⚠ PLAYER COPY: @lark's pass 11-18 (only 'left' changed), AWAITING ALEX SIGN-OFF (BETA › Alex's queue). Keep the hidden clock
// hidden (no time in any line); 'bag' = what you carry, 'pack' = what you left behind: keep that split (lark)
export const PACK_LINES = {   // @lark, SIGNED by Alex 11-19
  left: 'Your pack lies where you fell. Go back for it soon.',
  back: 'You shoulder your pack. Everything is still there.',
  some: 'You take what fits. The rest waits in the pack.',
  full: 'Your bag is full. The pack waits.',
}

let pack: Pack | null | undefined
const subs = new Set<() => void>()
function read(): Pack | null {
  if (pack === undefined) {
    try { pack = parsePack(JSON.parse(localStorage.getItem(keeperKey(PACK_KEY)) ?? 'null'), Date.now()) } catch { pack = null }
  }
  return pack
}
function write(p: Pack | null) {
  pack = p
  try { if (p) localStorage.setItem(keeperKey(PACK_KEY), JSON.stringify(p)); else localStorage.removeItem(keeperKey(PACK_KEY)) } catch { /* private window */ }
  subs.forEach(f => f())
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
const usePack = () => useSyncExternalStore(subscribe, () => (typeof window === 'undefined' ? null : read()), () => null)

/** The fall: the bag goes into a pack at (x, y, z); a pack already lying somewhere is replaced (one at a time). */
export function fallAndDrop(x: number, y: number, z: number) {
  const r = dropPack(getInv(), x, y, z, Date.now())
  if (!r.pack) return
  setInv(r.inv); write(r.pack)
  hudSay(PACK_LINES.left, 'info')
}

// ── the look + the touch ─────────────────────────────────────────────────────────────────────────────────────
const LEATHER = '#6b4a2f', FLAP = '#5a3c25', STRAP = '#3d2a1b', BUCKLE = '#c9a24a'

export function DeathPack({ active }: { active: boolean }) {
  const p = usePack()
  const camera = useThree(s => s.camera)
  const t = useRef(0)
  const touched = useRef(false)
  const packAt = useRef(0)
  const mote = useRef<THREE.Mesh>(null)
  // probes for death-check
  useEffect(() => {
    const g = window as unknown as { __ather?: Record<string, unknown> }
    g.__ather = { ...(g.__ather ?? {}), pack: () => read(), packReread: () => { pack = undefined; subs.forEach(f => f()); return read() } }
  }, [])
  useFrame((_, dt) => {
    if (mote.current) mote.current.position.y = 1.15 + Math.sin(performance.now() / 600) * 0.08
    if (!active || !p) return
    t.current -= dt; if (t.current > 0) return
    t.current = 0.2
    const now = Date.now()
    // a NEW pack starts touched: the keeper is standing on it for the frames between the fall and the fold taking them home,
    // and a walk-over check would hand the bag straight back (seen in death-check: flaky pack-less falls). Step off first.
    if (p.at !== packAt.current) { packAt.current = p.at; touched.current = true }
    const cur = parsePack(p, now)
    if (!cur) { write(null); return }                      // ran out while it lay there: gone, quietly
    // ONE take per walk-up: standing on it with a full bag must not retry (and re-say) five times a second; step off and back
    if (!near(cur, camera.position.x, camera.position.z)) { touched.current = false; return }
    if (touched.current) return
    touched.current = true
    const r = reclaim(getInv(), cur, now)
    if (r.got > 0) setInv(r.inv)
    write(r.pack)
    hudSay(!r.pack ? PACK_LINES.back : r.got > 0 ? PACK_LINES.some : PACK_LINES.full, 'info')
  })
  if (!active || !p) return null
  return (
    <group position={[p.x, p.y, p.z]} rotation={[0, (p.at % 628) / 100, 0]}>
      <mesh position={[0, 0.28, 0]} castShadow><boxGeometry args={[0.5, 0.56, 0.3]} /><meshStandardMaterial color={LEATHER} roughness={0.85} /></mesh>
      <mesh position={[0, 0.5, 0.06]} rotation={[0.25, 0, 0]} castShadow><boxGeometry args={[0.52, 0.12, 0.36]} /><meshStandardMaterial color={FLAP} roughness={0.9} /></mesh>
      <mesh position={[0, 0.22, 0.17]}><boxGeometry args={[0.34, 0.24, 0.06]} /><meshStandardMaterial color={FLAP} roughness={0.9} /></mesh>
      {[-0.14, 0.14].map(x => <mesh key={x} position={[x, 0.3, -0.17]}><boxGeometry args={[0.06, 0.5, 0.03]} /><meshStandardMaterial color={STRAP} /></mesh>)}
      <mesh position={[0, 0.4, 0.21]}><boxGeometry args={[0.07, 0.07, 0.02]} /><meshStandardMaterial color={BUCKLE} metalness={0.6} roughness={0.4} /></mesh>
      {/* a faint warm mote over it, so it can be found in the grass (steady: it says nothing about the clock) */}
      <mesh ref={mote} position={[0, 1.15, 0]}><sphereGeometry args={[0.06, 8, 6]} /><meshBasicMaterial color="#ffd89a" transparent opacity={0.85} /></mesh>
      <pointLight position={[0, 0.9, 0]} color="#ffcf8a" intensity={0.6} distance={5} />
    </group>
  )
}
