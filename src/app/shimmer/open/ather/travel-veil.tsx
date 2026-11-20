'use client'
// BETA M44 (1)+(2): the travel veil holds until the new zone is READY, not for a fixed 380 ms.
// ZoneReady sits inside the Canvas. While `hold` is true it warms the shaders once (renderer.compile), then counts steady
// frames (STEADY_N in a row under STEADY_MS); a hard cap (MAX_HOLD_MS) lets a slow box through. Tiles under spawn are
// already loaded by the caller (stream() resolves before arrive). window.__veil is a read-only probe for the check; inert in play.
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

// STEADY_MS 50 (hub 11-20): a 30 fps phone (33 ms frames) must qualify; only a real hitch (> 50 ms) resets the count.
export const STEADY_N = 8, STEADY_MS = 50, MAX_HOLD_MS = 6000, NAME_AFTER_MS = 800
type Probe = { up: boolean; upAt: number; swapAt: number; readyAt: number; frames: number }
export const veilProbe: Probe = { up: false, upAt: 0, swapAt: 0, readyAt: 0, frames: 0 }
export function markVeil(k: 'up' | 'swap' | 'ready') {
  const now = performance.now()
  if (k === 'up') { veilProbe.up = true; veilProbe.upAt = now; veilProbe.readyAt = 0; veilProbe.frames = 0 }
  else if (k === 'swap') veilProbe.swapAt = now
  else { veilProbe.up = false; veilProbe.readyAt = now }
  if (typeof window !== 'undefined') (window as unknown as { __veil?: Probe }).__veil = veilProbe
}

export function ZoneReady({ hold, onReady }: { hold: boolean; onReady: () => void }) {
  const { gl, scene, camera } = useThree()
  const st = useRef({ n: 0, last: 0, warmed: false, t0: 0 })
  useEffect(() => { st.current = { n: 0, last: 0, warmed: false, t0: performance.now() } }, [hold])
  useFrame(() => {
    if (!hold) return
    const s = st.current, now = performance.now()
    if (!s.warmed) { s.warmed = true; try { gl.compile(scene, camera) } catch { /* warm-up is best effort */ } s.last = performance.now(); return }
    const dt = now - s.last; s.last = now
    s.n = dt < STEADY_MS ? s.n + 1 : 0
    veilProbe.frames = s.n
    if (s.n >= STEADY_N || now - s.t0 > MAX_HOLD_MS) onReady()
  })
  return null
}
