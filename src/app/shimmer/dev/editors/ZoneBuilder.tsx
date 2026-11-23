'use client'
// ── BETA M84 s2: BUILD on a building zone, inside Creative mode (top-down plan of the zone) ──
// Pick a part (walls = M98b panels, floors = M98b slabs, furniture), it follows the pointer snapped by the player's own build
// settings (M98 snap 1 / 0.5 / 0.25 m / free, turn steps 90/45/30/15, the same saved prefs); click sets it. Click a standing part
// to select it: Turn, Move (it follows the pointer until the next click), Delete. R turns, Del deletes, Esc drops the part /
// selection, then closes. Free: no bag, no costs. Rules: zone-build.ts (the player's canPlacePiece, the zone as the site).
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { FURNITURE } from '../../open/ather/furniture'
import { getPrefs, setPrefs, subscribePrefs, nextSnap, nextStep, snapLabel, snapTo, turnQ, quad, DEFAULT_PREFS } from '../../open/ather/build-prefs'
import { zoneLabel, type Zone, type ZonePiece } from '../../world/builder-zones'
import { ZONE_PARTS, partGroup, canSet, setPart, movePart, deletePart, partAt, type PartGroup } from './zone-build'

const GROUPS: PartGroup[] = ['walls', 'floors', 'furniture']
const GROUP_LABEL: Record<PartGroup, string> = { walls: 'Walls', floors: 'Floors', furniture: 'Furniture' }
const FILL: Record<PartGroup, string> = { walls: '#a8794e', floors: '#d8c39a', furniture: '#7fa6c4' }
const qOf = (p: Pick<ZonePiece, 'item' | 'x' | 'z' | 'q'>) => quad(p.x, p.z, FURNITURE[p.item].w, FURNITURE[p.item].d, p.q) as [number, number][]
const pts = (q: [number, number][]) => q.map(([x, z]) => `${x},${z}`).join(' ')

export function ZoneBuilder({ zone, onChange, onClose }: { zone: Zone; onChange: (z: Zone) => void; onClose: () => void }) {
  const prefs = useSyncExternalStore(subscribePrefs, getPrefs, () => DEFAULT_PREFS)
  const [item, setItem] = useState<string | null>(null)        // the part in hand (new)
  const [moving, setMoving] = useState<string | null>(null)    // a standing part being moved
  const [sel, setSel] = useState<string | null>(null)
  const [q, setQ] = useState(0)
  const [at, setAt] = useState<{ x: number; z: number } | null>(null)
  const [why, setWhy] = useState('')
  const svg = useRef<SVGSVGElement>(null)
  const w = zone.x1 - zone.x0, d = zone.z1 - zone.z0
  const build = zone.build ?? []
  const held = moving ? build.find(p => p.id === moving)?.item ?? null : item
  const local = (cx: number, cy: number) => {
    const m = svg.current?.getScreenCTM(); if (!m) return null
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse())
    return { x: snapTo(p.x, prefs.snap), z: snapTo(p.y, prefs.snap), rx: p.x, rz: p.y }
  }
  const verdict = useMemo(() => held && at ? canSet(zone, held, at.x, at.z, q, moving ?? undefined) : null, [zone, held, at, q, moving])
  const drop = () => { setItem(null); setMoving(null); setWhy('') }
  const turn = () => {
    if (held) { setQ(v => turnQ(v, prefs.step)); return }
    const p = build.find(o => o.id === sel); if (!p) return
    const r = movePart(zone, p.id, p.x, p.z, turnQ(p.q, prefs.step)); if (r.ok) { onChange(r.zone); setWhy('') } else setWhy(r.why)
  }
  const del = () => { if (sel && build.some(p => p.id === sel)) { onChange(deletePart(zone, sel)); setSel(null) } }
  const click = (cx: number, cy: number) => {
    const p = local(cx, cy); if (!p) return
    if (held) {
      const r = moving ? movePart(zone, moving, p.x, p.z, q) : setPart(zone, held, p.x, p.z, q)
      if (!r.ok) { setWhy(r.why); return }
      onChange(r.zone); setWhy('')
      if (moving) { setSel(moving); setMoving(null) }
      return
    }
    const hit = partAt(zone, p.rx, p.rz, qOf); setSel(hit ? hit.id : null); setWhy('')
  }
  const startMove = () => { const p = build.find(o => o.id === sel); if (!p) return; setItem(null); setMoving(p.id); setQ(p.q); setAt({ x: p.x, z: p.z }) }
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'SELECT') return
      e.stopPropagation()   // the builder's tool keys (1-9, brushes) stay off while the zone build is open
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); e.stopPropagation(); turn() }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); del() }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (held) drop(); else if (sel) setSel(null); else onClose() }
    }
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true)
  })
  const btn = 'px-2 py-1 rounded text-[11px] font-mono border transition-colors'
  const on = 'bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-100', off = 'bg-white/5 border-white/15 text-white/70 hover:text-white'
  const pad = 1, scale = Math.min(620 / (w + 2 * pad), 560 / (d + 2 * pad))
  const selP = build.find(p => p.id === sel)
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60" data-testid="zone-build" data-zone={zone.id} data-parts={build.length}>
      <div className="rounded-lg bg-zinc-900 border border-fuchsia-400/40 p-3 flex gap-3 text-white/85 shadow-xl max-h-[96vh]">
        <div className="w-[200px] flex flex-col gap-2 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Build · {zoneLabel(zone)}</div>
          {GROUPS.map(g => (
            <div key={g} className="flex flex-col gap-1">
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">{GROUP_LABEL[g]}</div>
              {ZONE_PARTS.filter(id => partGroup(id) === g).map(id => (
                <button key={id} className={`${btn} text-left ${item === id ? on : off}`} data-testid={`zb-part-${id}`}
                  onClick={() => { setMoving(null); setSel(null); setItem(item === id ? null : id); setWhy('') }}>{FURNITURE[id].name}</button>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-1.5 items-center flex-wrap">
            <button className={`${btn} ${off}`} onClick={() => setPrefs({ ...prefs, snap: nextSnap(prefs.snap) })} data-testid="zb-snap">Snap {snapLabel(prefs.snap)}</button>
            <button className={`${btn} ${off}`} onClick={() => setPrefs({ ...prefs, step: nextStep(prefs.step) })} data-testid="zb-step">Turn {prefs.step}°</button>
            <button className={`${btn} ${off}`} onClick={turn} disabled={!held && !selP} data-testid="zb-turn">Turn (R)</button>
            <button className={`${btn} ${off}`} onClick={startMove} disabled={!selP || !!held} data-testid="zb-move">Move</button>
            <button className={`${btn} bg-red-500/15 border-red-400/60 text-red-200`} onClick={del} disabled={!selP} data-testid="zb-delete">Delete (Del)</button>
            <span className="text-[11px] font-mono text-white/45" data-testid="zb-count">{build.length} part{build.length === 1 ? '' : 's'}</span>
            <button className={`${btn} ${off} ml-auto`} onClick={onClose} data-testid="zb-done">Done</button>
          </div>
          <svg ref={svg} width={(w + 2 * pad) * scale} height={(d + 2 * pad) * scale} viewBox={`${-pad} ${-pad} ${w + 2 * pad} ${d + 2 * pad}`} data-testid="zb-plan"
            className="bg-[#2a3a2a] rounded cursor-crosshair select-none"
            onPointerMove={e => { const p = local(e.clientX, e.clientY); if (p) setAt({ x: p.x, z: p.z }) }}
            onPointerLeave={() => setAt(null)}
            onClick={e => click(e.clientX, e.clientY)}>
            <rect x={0} y={0} width={w} height={d} fill="#3f5a3a" stroke="#e879f9" strokeWidth={0.06} />
            {Array.from({ length: Math.floor(w) + 1 }, (_, i) => <line key={`x${i}`} x1={i} y1={0} x2={i} y2={d} stroke="white" strokeOpacity={0.07} strokeWidth={0.03} />)}
            {Array.from({ length: Math.floor(d) + 1 }, (_, j) => <line key={`z${j}`} x1={0} y1={j} x2={w} y2={j} stroke="white" strokeOpacity={0.07} strokeWidth={0.03} />)}
            {[...build].sort((a, b) => (FURNITURE[a.item].slab ? 0 : 1) - (FURNITURE[b.item].slab ? 0 : 1)).map(p => p.id === moving ? null : (
              <polygon key={p.id} points={pts(qOf(p))} fill={FILL[partGroup(p.item)]} fillOpacity={0.9} stroke={p.id === sel ? '#fde047' : '#1c1917'} strokeWidth={p.id === sel ? 0.12 : 0.04} data-part={p.id} data-item={p.item} />
            ))}
            {held && at && <polygon points={pts(qOf({ item: held, x: at.x, z: at.z, q }))} fill={verdict?.ok ? '#86efac' : '#f87171'} fillOpacity={0.55} stroke="white" strokeWidth={0.04} pointerEvents="none" data-testid="zb-ghost" />}
          </svg>
          <div className="text-[11px] text-white/50 min-h-[1.2em]" data-testid="zb-why">{why || (held ? (verdict && !verdict.ok ? verdict.why : 'click to set it · R turns · Esc drops it') : selP ? `${FURNITURE[selP.item].name} selected` : 'pick a part, or click one to select it')}</div>
          <div className="text-[10px] text-white/35">Free building: nothing is taken from a bag. The build is saved with the zone; deleting the zone removes it.</div>
        </div>
      </div>
    </div>
  )
}
