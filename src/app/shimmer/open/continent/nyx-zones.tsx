'use client'
// ── BETA M84 s3b + M114 s3: THE NYX CONTINENT READS PUBLISHED ZONE BUILDS AND TAGS, the way the Glade and the Wilds do ──
// The same pure readers (ather/zone-parts.ts: parts on the ground + the walker's boxes; ather/zone-tags.ts: one E point per tagged
// zone at its picked front edge), with the continent's own E idiom (business/market-view.tsx MarketView: the crosshair's capsule,
// the message line on reach, E on the window's keydown). The walker's boxes go into on-foot.ts footWorld (the page hands them to
// the Driver); this component draws the parts and runs the E points.
//   · SHOP     -> onShop(id): the page opens that storefront's own ShopPanel (deed `zone:<id>`, not `front:<id>`: MarketView closes
//                a `front:` panel when you are far from THAT shop's town door, and a zone's shop stands somewhere else).
//   · OTHER / HOME / SUPPLIER -> the message line only (no continent resident list exists; zone-choices.ts).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ZonePartsView } from '../ather/zone-parts-view'
import { zoneDoor, zoneUse, zonePrompt, zoneSay, type ZoneUse } from '../ather/zone-tags'
import type { ZonePart } from '../ather/zone-parts'
import type { Zone } from '../../world/builder-zones'
import { aimPick } from '../shared/aim-pick'
import { hudSay } from '../shared/game-hud'

const dirV = new THREE.Vector3()
/** the open shop panel closes when you walk this far from the zone's E point (MarketView's WALK_OFF) */
const WALK_OFF = 8

export interface NyxZoneDoor { id: string; x: number; z: number; u: ZoneUse }
export const nyxZoneDoors = (zones: readonly Zone[]): NyxZoneDoor[] => zones.flatMap(z => { const u = zoneUse(z); return u ? [{ id: z.id, ...zoneDoor(z), u }] : [] })

export function NyxZones({ zones, parts, ground, enabled, open, onShop, onReach, onWalkOff }: {
  zones: readonly Zone[]; parts: readonly ZonePart[]; ground: (x: number, z: number) => number
  /** on foot and no menu over the world (MarketView's own gate) */
  enabled: boolean
  /** the page's open deed: a `zone:<shop>` panel closes when you walk off its E point */
  open: string | null
  onShop: (shopId: string, doorId: string) => void
  onReach?: (u: ZoneUse | null) => void
  onWalkOff?: () => void
}) {
  const { camera } = useThree()
  const doors = useMemo(() => nyxZoneDoors(zones), [zones])
  const reach = useRef<NyxZoneDoor | null>(null)
  const opened = useRef<NyxZoneDoor | null>(null)
  const enabledRef = useRef(enabled); enabledRef.current = enabled
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const d = reach.current
      if (e.code !== 'KeyE' || e.repeat || !enabledRef.current || !d) return
      const line = zoneSay(d.u); if (line) hudSay(line, 'info', 4)
      if (d.u.kind === 'shop') { opened.current = d; onShop(d.u.id, d.id) }
    }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [onShop])
  // probe for scripted checks (scripts/zone-wilds-nyx-check.mts): the E points and the one in reach
  useEffect(() => {
    const w = window as unknown as { __nyxZones?: unknown }
    w.__nyxZones = { doors: () => doors, reach: () => reach.current?.u ?? null }
    return () => { delete w.__nyxZones }
  }, [doors])
  useFrame(() => {
    const p = camera.position
    if (open?.startsWith('zone:') && opened.current && Math.hypot(p.x - opened.current.x, p.z - opened.current.z) > WALK_OFF) { opened.current = null; onWalkOff?.() }
    let hit: NyxZoneDoor | null = null
    if (enabledRef.current && doors.length) {
      const cands = doors.flatMap(d => { const y = ground(d.x, d.z); return Number.isFinite(y) && Math.abs(p.y - 1.6 - y) < 2 ? [{ x: d.x, z: d.z, y0: y - 0.2, y1: y + 2.4, r: 0.6, item: d }] : [] })
      const v = camera.getWorldDirection(dirV)
      hit = aimPick(cands, p, { x: v.x, y: v.y, z: v.z })
    }
    if (hit !== reach.current) {
      reach.current = hit
      onReach?.(hit?.u ?? null)
      if (hit) hudSay(zonePrompt(hit.u), 'item')
    }
  })
  return <ZonePartsView parts={parts} />
}
