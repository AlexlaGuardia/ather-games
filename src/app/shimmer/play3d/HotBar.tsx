'use client'
// ── The walker HUD: hotbar + bag + tool-gauges + mana vial ────────────────────────
// Alex's whiteboard: a bottom bar = [Bag] [6 quick-slots] [tool gauges], plus a mana
// glass-vial top-right. Palia-inspired (clean, cozy, rounded). The Bag EXTENDS the
// hotbar (its 6 slots are the bottom row of one continuous satchel grid). Slots are
// drag-and-droppable to rearrange (works into the satchel too).
//
// MOBILE: the bar is a full-width strip pinned to the very bottom edge; the walker's
// joystick + A-B pad lift ABOVE it (done in Shimmer3D), so the hotbar sits "under the
// controls". DESKTOP: a compact centered bar.
//
// PASS 1 = visual shell on placeholder data (real ItemStack shape, so Pass 2's wiring —
// real inventory, item use, tool→node gathering, mana spend — is a drop-in).

import { useEffect, useRef, useState } from 'react'
import type { ItemStack } from '../engine/inventory'

const SLOTS = 6 // quick-slots; the satchel adds the rest of the inventory beneath (Palia-style)

interface ToolGauge { id: string; label: string; glyph: string; tint: string; infinite: boolean; dur: number }

// ── placeholder content (Pass 2 replaces with real inventory + equipped tools) ──
const PH_ITEMS: (ItemStack | null)[] = [
  { itemId: 'seed', count: 12 }, { itemId: 'berry', count: 3 }, { itemId: 'potion', count: 1 }, null, null, null,
  { itemId: 'wood', count: 47 }, { itemId: 'stone', count: 21 }, { itemId: 'fiber', count: 8 }, { itemId: 'petal', count: 5 }, null, null,
  { itemId: 'ore', count: 4 }, null, null, null, null, null,
  null, null, null, null, null, null,
]
const ITEM_LOOK: Record<string, { c: string; s: string }> = {
  seed: { c: '#8fd97f', s: 'SD' }, berry: { c: '#e0607a', s: 'BR' }, potion: { c: '#6fa8e6', s: 'PO' },
  wood: { c: '#b08355', s: 'WD' }, stone: { c: '#9aa0a8', s: 'ST' }, fiber: { c: '#c8b86a', s: 'FB' },
  petal: { c: '#e69ac8', s: 'PT' }, ore: { c: '#7fd0e6', s: 'OR' },
}
const PH_TOOLS: ToolGauge[] = [
  { id: 'forestry', label: 'Forestry', glyph: '🪓', tint: '#8fd97f', infinite: true, dur: 1 },
  { id: 'prospecting', label: 'Prospecting', glyph: '⛏️', tint: '#d9b56a', infinite: false, dur: 0.58 },
]

// item art placeholder — % insets so it scales to any slot size
function ItemTile({ item }: { item: ItemStack | null }) {
  if (!item) return null
  const look = ITEM_LOOK[item.itemId] ?? { c: '#7a8a86', s: item.itemId.slice(0, 2).toUpperCase() }
  return (
    <>
      <div style={{ position: 'absolute', inset: '15%', borderRadius: '18%', background: `linear-gradient(160deg, ${look.c}, ${look.c}bb)`,
        boxShadow: 'inset 0 -2px 4px #0004, 0 1px 2px #0006', display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: '800 13px ui-monospace, monospace', color: '#0d1a17' }}>{look.s}</div>
      {item.count > 1 && (
        <div style={{ position: 'absolute', right: 3, bottom: 1, font: '800 11px ui-monospace, monospace', color: '#fff', textShadow: '0 1px 2px #000, 0 0 3px #000' }}>{item.count}</div>
      )}
    </>
  )
}

export default function HotBar({ items: propItems }: { items?: (ItemStack | null)[] } = {}) {
  const [items, setItems] = useState<(ItemStack | null)[]>(propItems ?? PH_ITEMS)
  const [sel, setSel] = useState(0)
  const [bagOpen, setBagOpen] = useState(false)
  const [tools] = useState<ToolGauge[]>(PH_TOOLS)
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => { setIsTouch(window.matchMedia('(pointer:coarse)').matches) }, [])
  // keep the display synced to the walker's real inventory (drag-drop reorders this local mirror)
  useEffect(() => { if (propItems) setItems(propItems) }, [propItems])
  // desktop number keys 1-6
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= SLOTS) setSel(n - 1) }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── drag & drop (pointer-based → works on touch). Tap w/o moving = select. ──
  const press = useRef<{ idx: number; x: number; y: number; moved: boolean } | null>(null)
  const [drag, setDrag] = useState<{ idx: number; x: number; y: number } | null>(null)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const p = press.current; if (!p) return
      if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) {
        p.moved = true
        document.body.style.userSelect = 'none'; (document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none'
      }
      if (p.moved) { e.preventDefault(); setDrag({ idx: p.idx, x: e.clientX, y: e.clientY }) }
    }
    const onUp = (e: PointerEvent) => {
      const p = press.current; press.current = null
      document.body.style.userSelect = ''; (document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = ''
      if (!p) return
      if (p.moved) {
        const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('[data-slotidx]') as HTMLElement | null
        const to = el ? parseInt(el.dataset.slotidx || '-1', 10) : -1
        if (to >= 0 && to !== p.idx) setItems(prev => { const n = [...prev]; const t = n[to]; n[to] = n[p.idx]; n[p.idx] = t; return n })
      } else if (p.idx < SLOTS) {
        setSel(p.idx)   // a tap on a hotbar slot selects it
      }
      setDrag(null)
    }
    window.addEventListener('pointermove', onMove, { passive: false }); window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [])

  const startPress = (idx: number) => (e: React.PointerEvent) => { e.stopPropagation(); press.current = { idx, x: e.clientX, y: e.clientY, moved: false } }

  // a single item slot (hotbar or satchel). idx = absolute index into `items`.
  const Slot = ({ idx, flex }: { idx: number; flex?: boolean }) => {
    const on = sel === idx && idx < SLOTS
    const dragging = drag?.idx === idx
    return (
      <div data-slotidx={idx} onPointerDown={startPress(idx)} style={{
        position: 'relative', flex: flex ? '1 1 0' : undefined, aspectRatio: '1',
        width: flex ? undefined : 52, maxWidth: flex ? 66 : undefined, borderRadius: 11,
        border: `2px solid ${on ? '#7fe3c8' : '#ffffff20'}`, background: on ? '#1a2b28' : '#111c1a',
        boxShadow: on ? '0 0 12px #7fe3c866, inset 0 1px 0 #ffffff10' : 'inset 0 1px 0 #ffffff08',
        opacity: dragging ? 0.35 : 1, transform: on ? 'translateY(-3px)' : 'none',
        transition: 'transform 0.1s, box-shadow 0.1s, border-color 0.1s', cursor: 'grab', touchAction: 'none',
        userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
      }}>
        <ItemTile item={items[idx]} />
        {idx < SLOTS && <span style={{ position: 'absolute', left: 3, top: 1, font: '700 9px ui-monospace, monospace', color: on ? '#7fe3c8' : '#ffffff40' }}>{idx + 1}</span>}
      </div>
    )
  }

  const ToolBtn = ({ t, size }: { t: ToolGauge; size: number }) => {
    const r = size / 2, rad = r - 3, circ = 2 * Math.PI * rad
    const low = !t.infinite && t.dur < 0.25
    const ring = t.infinite ? '#5a6b66' : low ? '#ff5a4d' : t.tint
    return (
      <button title={`${t.label}${t.infinite ? ' (starter · ∞)' : ` · ${Math.round(t.dur * 100)}%`}`} style={{
        position: 'relative', width: size, height: size, flexShrink: 0, borderRadius: '50%', cursor: 'pointer', touchAction: 'none',
        border: 'none', background: '#141d1a', boxShadow: 'inset 0 1px 0 #ffffff10, 0 1px 3px #0007', padding: 0,
      }}>
        <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx={r} cy={r} r={rad} fill="none" stroke="#ffffff14" strokeWidth="3" />
          <circle cx={r} cy={r} r={rad} fill="none" stroke={ring} strokeWidth="3" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={t.infinite ? 0 : circ * (1 - t.dur)} />
        </svg>
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `${size * 0.42}px serif` }}>{t.glyph}</span>
        <span style={{ position: 'absolute', bottom: -1, left: 0, right: 0, textAlign: 'center', font: '800 8px ui-monospace, monospace', color: t.infinite ? '#7f938e' : low ? '#ff8a7a' : '#cfe9df' }}>
          {t.infinite ? '∞' : `${Math.round(t.dur * 100)}%`}
        </span>
      </button>
    )
  }

  const BagBtn = ({ size }: { size: number }) => (
    <button onClick={() => setBagOpen(o => !o)} title="Satchel" style={{
      width: size, height: size, flexShrink: 0, borderRadius: 12, cursor: 'pointer', touchAction: 'none',
      border: `2px solid ${bagOpen ? '#d4a843' : '#ffffff2a'}`, background: bagOpen ? '#241d10' : '#1a140c',
      font: `${size * 0.5}px serif`, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: bagOpen ? '0 0 12px #d4a84355' : 'inset 0 1px 0 #ffffff10',
    }}>🎒</button>
  )

  const toolSize = isTouch ? 46 : 48

  return (
    <>
      {/* (mana gauge now lives in the top-right HUD in Shimmer3D) */}

      {/* SATCHEL — the bag extends the hotbar: its 6 slots are the bottom row of this grid */}
      {bagOpen && (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: isTouch ? 84 : 84, zIndex: 37,
          background: '#0e1a17f4', border: '2px solid #2f5c4f', borderRadius: 14, padding: 12, boxShadow: '0 12px 40px #000a' }}>
          <div style={{ font: '800 11px ui-monospace, monospace', color: '#8fd9c4', letterSpacing: '0.14em', marginBottom: 9, textAlign: 'center' }}>SATCHEL</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SLOTS}, 52px)`, gap: 6 }}>
            {Array.from({ length: Math.max(0, items.length - SLOTS) }, (_, i) => <Slot key={'x' + i} idx={SLOTS + i} />)}
            {Array.from({ length: SLOTS }, (_, i) => <Slot key={'h' + i} idx={i} />)}
          </div>
        </div>
      )}

      {/* BOTTOM BAR — full-width strip on mobile (under the lifted controls), compact centered on desktop */}
      <div style={isTouch
        ? { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 35, display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 8px calc(7px + env(safe-area-inset-bottom))', background: '#0b1513f2', borderTop: '1px solid #2f5c4f' }
        : { position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 20, zIndex: 35, display: 'flex', alignItems: 'center', gap: 9 }}>
        <BagBtn size={isTouch ? 46 : 52} />
        <div style={{ display: 'flex', gap: isTouch ? 5 : 6, flex: isTouch ? '1 1 0' : undefined }}>
          {Array.from({ length: SLOTS }, (_, i) => <Slot key={i} idx={i} flex={isTouch} />)}
        </div>
        <div style={{ display: 'flex', gap: isTouch ? 5 : 7, flexShrink: 0 }}>
          {tools.map(t => <ToolBtn key={t.id} t={t} size={toolSize} />)}
        </div>
      </div>

      {/* drag ghost — follows the pointer */}
      {drag && items[drag.idx] && (
        <div style={{ position: 'fixed', left: drag.x, top: drag.y, transform: 'translate(-50%,-50%)', width: 52, height: 52, borderRadius: 11,
          border: '2px solid #7fe3c8', background: '#1a2b28', boxShadow: '0 6px 18px #000a', pointerEvents: 'none', zIndex: 60 }}>
          <ItemTile item={items[drag.idx]} />
        </div>
      )}
    </>
  )
}
