'use client'
// Shimmer 3D — boot gate. Before the game mounts, fetch the LIVE on-disk world data
// (/shimmer/world-data parses tilemap.ts / heightmaps.json / node-placements.ts at request
// time) and overlay it on the compiled sources. This is what makes edit → Save → refresh
// live with no rebuild. Fetch failure falls back to compiled data — the game always mounts.
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { applyLiveWorldData, registerGardenWorld } from '../world/garden-world'
import { invalidateWorldCaches } from './world-adapter'

// R3F Canvas is client/WebGL-only — never SSR it. The import is also deferred until `ready`
// so Shimmer3D's module init (world registration, NPC remaps) sees the live data.
const Shimmer3D = dynamic(() => import('./Shimmer3D'), { ssr: false })

export default function Play3DPage() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const report = (m: string) => { try { navigator.sendBeacon('/shimmer/client-log', m) } catch { /* noop */ } }
    const onErr = (e: ErrorEvent) => report(`${e.message}\n${e.error?.stack ?? ''}`)
    const onRej = (e: PromiseRejectionEvent) => report(`unhandledrejection: ${e.reason?.message ?? e.reason}\n${e.reason?.stack ?? ''}`)
    window.addEventListener('error', onErr)
    window.addEventListener('unhandledrejection', onRej)
    let alive = true
    fetch('/shimmer/world-data', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (!d.error) { applyLiveWorldData(d); invalidateWorldCaches() } })
      .catch(() => { /* compiled fallback */ })
      .finally(() => { if (alive) { registerGardenWorld(); setReady(true) } })
    return () => { alive = false; window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onRej) }
  }, [])
  if (!ready) return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#0e0c1c', color: '#e9dfc8', font: '700 15px ui-monospace, monospace' }}>
      ✦ composing the garden…
    </div>
  )
  return <Shimmer3D />
}
