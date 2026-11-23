'use client'
// THE MARKET, in the world and at the counter (play lane, 2026-11-16).
//
// <MarketView> dresses every offered lot in the towns near you (business/market.ts picks them): a For Sale board on the
// ones you can buy, the trade's dressing + name board + the goods gate on the ones you own. On foot within reach of a
// lot's door the message line offers it, and E opens <DeedCard>. The canon storefronts (business/shop-panel.tsx
// FRONT_SHOPS) share the same doors: Jin 2's door kit (towns/shop-door.tsx) on each, reach at its step stone, E → panel.
// <DeedCard> is the buy / sell counter: what the place does, its price, and what your Marks a minute become.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Region } from '../region'
import { BusinessDress } from './business-dress'
import { marketFor, offerById, type Offer } from './market'
import { doorsCached, doorByKey, type Door } from './doors'
import { ShopDoor } from '../towns/shop-door'
import { BIZ, MAX_OWNED, RESALE, rateOf, canBuy, type Owned, type Tycoon } from '../economy/tycoon'
import { hudSay } from '../shared/game-hud'
import { HearthFrame, H, hearthDisplay, HearthButton } from '../../ui/hearth'
import { aimPick } from '../shared/aim-pick'
const doorDirV = new THREE.Vector3()   // M60

/** dress a town's doors while you are within this of its centre (the town kit's DETAIL is 450 from the edge) */
const DRESS_REACH = 700
const WALK_OFF = 8

export function MarketView({ R, focus, owned, enabled, onOpen, onReach, open, onWalkOff, hide }: {
  R: Region; focus: React.MutableRefObject<THREE.Vector3>; owned: Owned[]
  /** on foot and no menu over the world */
  enabled: boolean
  /** a lot id (the deed card) or `front:<id>` (that shop's panel) */
  onOpen: (key: string) => void
  /** the door in reach changed (the page's touch pill) */
  onReach?: (key: string | null) => void
  /** the card/panel open right now: it closes when you walk off (> WALK_OFF from its door) */
  open?: string | null
  onWalkOff?: () => void
  /** M108: doors not drawn or reachable right now (an owner-only door while its flag is off) */
  hide?: (key: string) => boolean
}) {
  const { camera } = useThree()
  const [near, setNear] = useState<string[]>([])
  const towns = useMemo(() => R.meta.places.filter(p => doorsCached(R, p.id).length), [R])
  const reach = useRef<Door | null>(null)
  const acc = useRef(0)
  const enabledRef = useRef(enabled); enabledRef.current = enabled
  const ownedIds = useMemo(() => new Set(owned.map(o => o.lotId)), [owned])
  const doors = useMemo(() => near.flatMap(id => doorsCached(R, id)).filter(d => !hide?.(d.key)), [R, near, hide])

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'KeyE' && !e.repeat && enabledRef.current && reach.current) onOpen(reach.current.key) }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [onOpen])
  // probe for scripted checks: the doors dressed right now, and the one in reach
  useEffect(() => { (window as unknown as { __market?: unknown }).__market = {
    offers: () => doors.filter(d => d.offer).map(d => ({ id: d.key, kind: d.offer!.kind, name: d.name, price: d.offer!.price, door: d.at })),
    doors: () => doors.map(d => ({ key: d.key, name: d.name, at: d.at, yaw: d.b.yaw })),
    reach: () => reach.current?.key ?? null,
  } }, [doors])

  useFrame((_, dt) => {
    acc.current += dt
    if (acc.current > 0.5) {
      acc.current = 0
      const f = focus.current
      const ids = towns.filter(p => Math.hypot(p.x - f.x, p.z - f.z) < DRESS_REACH).map(p => p.id)
      if (ids.join() !== near.join()) setNear(ids)
    }
    const p = camera.position
    // an open card closes when you walk off (the camera is the keeper on foot; hud.x is the parked courser)
    if (open) { const d = doorByKey(R, open); if (d && Math.hypot(p.x - d.at.x, p.z - d.at.z) > WALK_OFF) onWalkOff?.() }
    // in reach: the camera stands at eye height over the step stone
    let hit: Door | null = null
    // BETA M60 (Alex 11-21): only the door the CROSSHAIR is on, within 3 m (shared/aim-pick.ts). The capsule stands just inside the
    // step stone, toward the building (where the door leaf is)
    if (enabledRef.current) {
      const cands = doors.filter(d => Math.abs(p.y - 1.6 - d.at.y) < 2).map(d => { const L = Math.hypot(d.b.x - d.at.x, d.b.z - d.at.z) || 1, k = Math.min(0.6, L) / L
        return { x: d.at.x + (d.b.x - d.at.x) * k, z: d.at.z + (d.b.z - d.at.z) * k, y0: d.at.y - 0.2, y1: d.at.y + 2.4, r: 0.8, item: d } })
      const v = camera.getWorldDirection(doorDirV)
      hit = aimPick(cands, p, { x: v.x, y: v.y, z: v.z })
    }
    if (hit !== reach.current) {
      reach.current = hit
      onReach?.(hit?.key ?? null)
      if (hit) hudSay(hit.offer ? (ownedIds.has(hit.key) ? `${hit.name} · yours · E for the deed` : `${hit.name} · for sale · E to look`) : `${hit.name} · E to go in`, 'item')
    }
  })

  return (
    <group>
      {doors.map(d => <ShopDoor key={`door-${d.key}`} b={d.b} lit />)}
      {doors.filter(d => d.offer).map(({ offer: o }) => (
        <BusinessDress key={o!.lot.id} b={o!.b} kind={o!.kind} name={o!.name} owned={ownedIds.has(o!.lot.id)} forSale={!ownedIds.has(o!.lot.id)} price={o!.price} />
      ))}
    </group>
  )
}

const SIZE = ['Small', 'Middling', 'Large'] as const
const fmt = (n: number) => Math.round(n).toLocaleString()
const WARE: Record<string, string> = { ore: 'Ore', fittings: 'Fittings', produce: 'Produce', meals: 'Meals' }

export function DeedCard({ R, lotId, t, marks, onBuy, onSell, onClose }: {
  R: Region; lotId: string; t: Tycoon; marks: number
  onBuy: (o: Offer) => { ok: boolean; why?: string }
  onSell: (o: Offer) => { ok: boolean; why?: string; refund?: number }
  onClose: () => void
}) {
  const o = offerById(R, lotId)
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmSell, setConfirmSell] = useState(false)
  if (!o) return null
  const mine = t.owned.find(x => x.lotId === lotId)
  const def = BIZ[o.kind]
  const now = rateOf(t.owned)
  const withIt = rateOf(mine ? t.owned.filter(x => x !== mine) : [...t.owned, { lotId, kind: o.kind, tier: o.lot.tier, paid: o.price }])
  const verdict = mine ? null : canBuy(t, lotId, o.kind, o.lot.tier, marks)
  const delta = withIt - now
  const rate = (n: number) => <b className="tabular-nums" style={{ color: n < 0 ? '#a8321f' : H.ink }}>{n < 0 ? '−' : ''}{fmt(Math.abs(n))}</b>
  return (
    <HearthFrame title={o.name} maxWidth={430} onClose={onClose} fixed dataPanel="deed-card"
      head={
        <div className="flex items-center justify-between pb-2 text-[13px]">
          <span style={{ ...hearthDisplay, color: H.inkSoft }}>{SIZE[o.lot.tier]} {def.name.toLowerCase()} · {t.owned.length}/{MAX_OWNED} owned</span>
          <span className="tabular-nums font-bold" data-marks style={{ color: H.ink }}>{fmt(marks)} Marks</span>
        </div>
      }
      footer={<span className="text-[12px]" style={hearthDisplay}>Goods move between your places through their gates, so a chain can span towns.</span>}>
      <div className="px-4 pt-3 pb-4 text-[14px] leading-snug" style={{ color: H.ink }}>
        <p style={{ ...hearthDisplay, color: H.inkSoft }}>{def.blurb}</p>
        <div className="mt-3 grid gap-1 text-[13px]">
          <div>All your places now: {rate(now)} Marks a minute</div>
          <div>{mine ? 'Without this one' : 'With this one'}: {rate(withIt)} Marks a minute <span style={{ color: H.inkSoft }}>({delta >= 0 ? '+' : '−'}{fmt(Math.abs(delta))})</span></div>
          <div style={{ color: H.inkSoft }}>Upkeep {def.upkeep} Marks a minute, whether it works or not.</div>
          {t.owned.length > 0 && (
            <div className="mt-1" style={{ color: H.inkSoft }} data-store>
              In the gates: {(['ore', 'fittings', 'produce', 'meals'] as const).map(w => `${WARE[w]} ${Math.floor(t.store[w])}`).join(' · ')}
            </div>
          )}
        </div>
        {msg && <div className="mt-3 text-[13px] font-semibold" style={{ color: '#a8321f' }} data-deed-msg>{msg}</div>}
        <div className="flex justify-end gap-2 mt-4">
          {mine ? (
            confirmSell ? (
              <>
                <HearthButton small onClick={() => setConfirmSell(false)}>Keep it</HearthButton>
                <HearthButton small primary onClick={() => { const r = onSell(o); if (!r.ok) setMsg(r.why ?? 'Not now') }}>Sell for {fmt(mine.paid * RESALE)} M</HearthButton>
              </>
            ) : <HearthButton small onClick={() => setConfirmSell(true)}>Sell ({Math.round(RESALE * 100)}% back)</HearthButton>
          ) : (
            <HearthButton small primary disabled={!verdict?.ok} onClick={() => { const r = onBuy(o); if (!r.ok) setMsg(r.why ?? 'Not now') }}>
              Buy for {fmt(o.price)} M
            </HearthButton>
          )}
        </div>
        {!mine && verdict && !verdict.ok && <div className="mt-2 text-right text-[12px]" style={{ color: H.inkSoft }} data-deed-why>{verdict.why}</div>}
      </div>
    </HearthFrame>
  )
}
