'use client'
// ── BETA M237 s1: the World Builder's SETTLEMENTS tool (the Wilds). Every settlement of the season's network is a marker on the
// open tile (the baked network with the DRAFT's edits on top, open/ather/settlement-edits.ts); click empty ground = ADD one, drag
// a marker = MOVE it, click one = SELECT it: the panel's dropdowns set its trade focus, home count and event tent; Remove takes
// it out. The edits ride the draft as the layer's `settlements` (Save / autosave / Publish), never the baked network file.
// Labels are plain functional placeholders (@lark may reword). s1: paths do not re-route to a moved / added settlement (s3).
import { useRef, useState } from 'react'
import { SETTLEMENT_R, type Network, type SettlementBiome, type Contest, type ClashLevel } from '../../open/ather/network'
import { FOCUS_BIOMES, TENT_CONTESTS, CLASH_LEVELS, HOMES_MAX, isAddedId, type EditedSettlement, type TentPick } from '../../open/ather/settlement-edits'

export const FOCUS_LABEL: Record<SettlementBiome, string> = { shore: 'Shore', meadow: 'Meadow', woods: 'Woods', rock: 'Rock' }
const CONTEST_OPT: Record<Contest, string> = { clash: 'Clash', dash: 'Dash', smash: 'Smash' }
const LEVEL_OPT: Record<ClashLevel, string> = { easy: 'Easy', average: 'Average', difficult: 'Difficult' }
const MARK = { baked: '#facc15', edited: '#fb923c', added: '#34d399', sel: '#ffffff' }

/** the markers over the top-down canvas, in WORLD coords (viewBox = the tile's square). Active = it takes the pointer. */
export function SettlementMarkers({ box, list, sel, active, onAdd, onMove, onSelect }: {
  box: { x0: number; z0: number; sx: number; sz: number }; list: EditedSettlement[]; sel: string | null; active: boolean
  onAdd: (x: number, z: number) => void; onMove: (id: string, x: number, z: number) => void; onSelect: (id: string | null) => void
}) {
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ id: string; moved: boolean; sx: number; sy: number } | null>(null)
  const [ghost, setGhost] = useState<{ id: string; x: number; z: number } | null>(null)
  const world = (e: { clientX: number; clientY: number }) => {
    const rc = svg.current!.getBoundingClientRect()
    return { x: box.x0 + ((e.clientX - rc.left) / rc.width) * box.sx, z: box.z0 + ((e.clientY - rc.top) / rc.height) * box.sz }
  }
  const m = box.sx / 760   // one screen-ish pixel in metres at the editor's usual size
  const inside = (s: EditedSettlement) => s.x >= box.x0 - 60 && s.x <= box.x0 + box.sx + 60 && s.z >= box.z0 - 60 && s.z <= box.z0 + box.sz + 60
  return (
    <svg ref={svg} className={`absolute inset-0 w-full h-full ${active ? '' : 'pointer-events-none'}`} viewBox={`${box.x0} ${box.z0} ${box.sx} ${box.sz}`} preserveAspectRatio="none"
      style={{ cursor: active ? 'crosshair' : undefined }} data-testid="settle-layer"
      onPointerDown={e => {
        if (!active || e.button !== 0) return
        const t = (e.target as Element).closest('[data-settle]'); const p = world(e)
        if (t) { const id = t.getAttribute('data-settle')!; drag.current = { id, moved: false, sx: e.clientX, sy: e.clientY }; svg.current!.setPointerCapture(e.pointerId); onSelect(id); return }
        onAdd(p.x, p.z)
      }}
      onPointerMove={e => {
        const d = drag.current; if (!d) return
        if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return
        d.moved = true; const p = world(e); setGhost({ id: d.id, x: p.x, z: p.z })
      }}
      onPointerUp={e => {
        const d = drag.current; drag.current = null; if (!d) return
        if (d.moved) { const p = world(e); onMove(d.id, p.x, p.z) }
        setGhost(null)
      }}>
      {list.filter(inside).map(s => {
        const g = ghost?.id === s.id ? ghost : null, x = g ? g.x : s.x, z = g ? g.z : s.z, on = s.id === sel
        const col = s.added ? MARK.added : s.moved || s.homes !== undefined || s.tent || s.bakedBiome ? MARK.edited : MARK.baked
        return (
          <g key={s.id} data-settle={s.id} data-x={s.x} data-z={s.z} style={{ cursor: active ? 'grab' : undefined }}>
            <circle cx={x} cy={z} r={SETTLEMENT_R} fill={col} fillOpacity={on ? 0.35 : 0.18} stroke={on ? MARK.sel : col} strokeWidth={on ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" />
            <circle cx={x} cy={z} r={6 * m} fill={col} stroke="black" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
            {s.tent && <rect x={x + 7 * m} y={z - 14 * m} width={8 * m} height={8 * m} fill="#c084fc" stroke="black" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
            <text x={x + 10 * m} y={z + 4 * m} fontSize={13 * m} fill="white" stroke="black" strokeWidth={3 * m} paintOrder="stroke" fontFamily="ui-monospace, monospace" pointerEvents="none">{s.name}</text>
          </g>)
      })}
    </svg>
  )
}

/** the side panel: every settlement (go to it), and the selected one's dropdowns */
export function SettlementsPanel({ list, base, sel, removed, onSelect, onGo, onPatch, onRemove, onRestore, btn, on, off }: {
  list: EditedSettlement[]; base: Network | null; sel: string | null; removed: string[]
  onSelect: (id: string | null) => void; onGo: (s: EditedSettlement) => void
  onPatch: (id: string, p: { focus?: SettlementBiome; homes?: number; tent?: TentPick }, clear?: ('focus' | 'homes' | 'tent')[]) => void
  onRemove: (id: string) => void; onRestore: (id: string) => void; btn: string; on: string; off: string
}) {
  const s = list.find(q => q.id === sel) ?? null
  const baked = s && base ? base.settlements.find(q => q.id === s.id) ?? null : null
  const sel_ = 'bg-black/40 border border-white/15 rounded px-2 py-1 font-mono text-xs flex-1'
  return (
    <div className="flex flex-col gap-1.5 mt-2" data-testid="settle-panel">
      <div className="text-[11px] text-white/45">click empty ground to add a settlement · drag one to move it · click one to set it. Players see it after Publish. Paths do not re-route to a moved one yet.</div>
      <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5 pr-1" data-testid="settle-list">
        {list.map(q => (
          <div key={q.id} className={`flex items-center gap-1 text-[11px] font-mono ${q.id === sel ? 'text-amber-200' : 'text-white/70'}`}>
            <button className="flex-1 text-left truncate hover:text-white" onClick={() => { onSelect(q.id); onGo(q) }} data-testid={`settle-go-${q.id}`}>{q.name}</button>
            <span className="text-white/40">{FOCUS_LABEL[q.biome ?? 'meadow']}{q.added ? ' · new' : q.moved ? ' · moved' : ''}</span>
          </div>))}
      </div>
      {s && <div className="flex flex-col gap-1.5 rounded border border-white/10 p-2" data-testid="settle-sel" data-id={s.id}>
        <div className="text-xs font-mono text-white/85">{s.name} <span className="text-white/40">({Math.round(s.x)}, {Math.round(s.z)})</span></div>
        <label className="flex items-center gap-2 text-[11px] text-white/55">Trade focus
          <select className={sel_} value={s.biome ?? 'meadow'} data-testid="settle-focus"
            onChange={e => { const v = e.target.value as SettlementBiome; if (baked && v === (baked.biome ?? 'meadow')) onPatch(s.id, {}, ['focus']); else onPatch(s.id, { focus: v }) }}>
            {FOCUS_BIOMES.map(b => <option key={b} value={b}>{FOCUS_LABEL[b]}{baked && b === (baked.biome ?? 'meadow') ? ' (default)' : ''}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[11px] text-white/55">Homes
          <select className={sel_} value={s.homes === undefined ? 'auto' : String(s.homes)} data-testid="settle-homes"
            onChange={e => { if (e.target.value === 'auto') onPatch(s.id, {}, ['homes']); else onPatch(s.id, { homes: +e.target.value }) }}>
            <option value="auto">Auto (one per trade)</option>
            {Array.from({ length: HOMES_MAX + 1 }, (_, k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[11px] text-white/55">Event tent
          <select className={sel_} value={s.tent ? s.tent.contest : 'none'} data-testid="settle-tent"
            onChange={e => { const v = e.target.value; if (v === 'none') onPatch(s.id, {}, ['tent']); else onPatch(s.id, { tent: v === 'clash' ? { contest: 'clash', level: s.tent?.level ?? 'easy' } : { contest: v as Contest } }) }}>
            <option value="none">None</option>
            {TENT_CONTESTS.map(c => <option key={c} value={c}>{CONTEST_OPT[c]}</option>)}
          </select>
        </label>
        {s.tent?.contest === 'clash' && <label className="flex items-center gap-2 text-[11px] text-white/55">Clash level
          <select className={sel_} value={s.tent.level ?? 'easy'} data-testid="settle-level" onChange={e => onPatch(s.id, { tent: { contest: 'clash', level: e.target.value as ClashLevel } })}>
            {CLASH_LEVELS.map(l => <option key={l} value={l}>{LEVEL_OPT[l]}</option>)}
          </select>
        </label>}
        {s.tent && <div className="text-[11px] text-white/40">stored: the Fair pitches beside it this season (the tent stands in a later slice)</div>}
        <div className="flex gap-1">
          <button className={`${btn} ${off}`} onClick={() => onRemove(s.id)} data-testid="settle-remove">Remove</button>
          <button className={`${btn} ${off}`} onClick={() => onSelect(null)}>Close</button>
        </div>
        {!isAddedId(s.id) && s.moved && <div className="text-[11px] text-white/40">moved: its baked lot pads stay behind; the ground under it is levelled</div>}
      </div>}
      {removed.length > 0 && <div className="flex flex-wrap gap-1 items-center text-[11px] text-white/45" data-testid="settle-removed">removed:
        {removed.map(id => <button key={id} className={`${btn} ${on}`} onClick={() => onRestore(id)} title="put it back">{base?.settlements.find(q => q.id === id)?.name ?? id} ↺</button>)}
      </div>}
    </div>
  )
}
