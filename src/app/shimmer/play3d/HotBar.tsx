'use client'
// ── The walker HUD: hotbar + bag + tool-gauges + mana vial ────────────────────────
// Alex's whiteboard: a bottom bar = [Bag] [6 quick-slots] [tool gauges], plus a mana
// glass-vial top-right. Palia-inspired (clean, cozy, rounded), the Bag EXTENDS the
// hotbar (its 6 slots are the bottom row of one continuous satchel grid).
//
// PASS 1 = the visual shell: layout + look + the gauges/vial animating on placeholder
// logic, mobile-fit around the joystick/A-B pad. PASS 2 wires real inventory data,
// item use, tool→node gathering, mana spend. Data uses the real ItemStack shape so the
// wiring is a drop-in later. Placeholder icons = colored tiles + labels (art comes later).

import { useEffect, useRef, useState } from 'react'
import type { ItemStack } from '../engine/inventory'

const SLOTS = 6
const BAG_ROWS = 3 // extra rows the satchel adds beneath the hotbar row (Palia-style)

// A tool occupies a gauge-slot. Starter tier = infinite (no wear). Upgraded tiers carry
// durability that depletes with use and must be repaired before it hits 0 (or it breaks).
interface ToolGauge {
  id: string
  label: string
  glyph: string
  tint: string
  infinite: boolean          // starter set never wears
  dur: number                // 0..1 durability (ignored when infinite)
}

// ── placeholder content (Pass 2 replaces with the real inventory + equipped tools) ──
const PH_ITEMS: (ItemStack | null)[] = [
  { itemId: 'seed', count: 12 }, { itemId: 'berry', count: 3 }, { itemId: 'potion', count: 1 },
  null, null, null,
  // satchel extension rows (BAG_ROWS x SLOTS)
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

function ItemTile({ item, size }: { item: ItemStack | null; size: number }) {
  if (!item) return null
  const look = ITEM_LOOK[item.itemId] ?? { c: '#7a8a86', s: item.itemId.slice(0, 2).toUpperCase() }
  return (
    <>
      <div style={{ position: 'absolute', inset: size * 0.14, borderRadius: size * 0.16,
        background: `linear-gradient(160deg, ${look.c}, ${look.c}bb)`, boxShadow: `inset 0 -2px 4px #0004, 0 1px 2px #0006`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 ${size * 0.26}px ui-monospace, monospace`, color: '#0d1a17' }}>
        {look.s}
      </div>
      {item.count > 1 && (
        <div style={{ position: 'absolute', right: 3, bottom: 2, font: `800 ${Math.max(9, size * 0.2)}px ui-monospace, monospace`,
          color: '#fff', textShadow: '0 1px 2px #000, 0 0 3px #000' }}>{item.count}</div>
      )}
    </>
  )
}

export default function HotBar() {
  const [sel, setSel] = useState(0)
  const [bagOpen, setBagOpen] = useState(false)
  const [mana, setMana] = useState(0.62)          // 0..1 — drains on use (Pass 2), regens over time
  const [tools] = useState<ToolGauge[]>(PH_TOOLS)
  const coarse = useRef(false)
  useEffect(() => { coarse.current = typeof window !== 'undefined' && window.matchMedia('(pointer:coarse)').matches }, [])

  // Mana regen tick — the vial fills back over time (station tops it faster; Pass 2).
  useEffect(() => {
    const id = setInterval(() => setMana(m => Math.min(1, m + 0.02)), 700)
    return () => clearInterval(id)
  }, [])

  // desktop: number keys 1-6 select a slot
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= SLOTS) setSel(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const isTouch = coarse.current
  const slot = isTouch ? 46 : 52
  const bottom = isTouch ? 150 : 20   // lift above the joystick / A-B pad on phones

  const SlotBtn = ({ i, item }: { i: number; item: ItemStack | null }) => {
    const on = sel === i
    return (
      <button onClick={() => setSel(i)} style={{
        position: 'relative', width: slot, height: slot, flexShrink: 0, borderRadius: slot * 0.2,
        border: `2px solid ${on ? '#7fe3c8' : '#ffffff22'}`, background: on ? '#1a2b28' : '#111c1a',
        boxShadow: on ? '0 0 12px #7fe3c866, inset 0 1px 0 #ffffff10' : 'inset 0 1px 0 #ffffff08',
        transform: on ? 'translateY(-3px)' : 'none', transition: 'transform 0.1s, box-shadow 0.1s, border-color 0.1s',
        cursor: 'pointer', touchAction: 'none', padding: 0,
      }}>
        <ItemTile item={item} size={slot} />
        <span style={{ position: 'absolute', left: 3, top: 1, font: '700 9px ui-monospace, monospace', color: on ? '#7fe3c8' : '#ffffff40' }}>{i + 1}</span>
      </button>
    )
  }

  return (
    <>
      {/* MANA VIAL — top-right. Glass flask whose liquid drains on use, regens over time. */}
      <div style={{ position: 'fixed', top: 12, right: 14, zIndex: 34, display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
        <svg width={34} height={54} viewBox="0 0 34 54">
          <defs>
            <clipPath id="vialclip"><path d="M11 3 h12 v14 l7 24 a9 9 0 0 1-8 13 h-10 a9 9 0 0 1-8-13 l7-24 z" /></clipPath>
          </defs>
          <rect x="0" y={54 - 54 * mana} width="34" height={54 * mana} fill="url(#manaGrad)" clipPath="url(#vialclip)" />
          <linearGradient id="manaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6fd0e6" /><stop offset="1" stopColor="#3a7bd5" /></linearGradient>
          <path d="M11 3 h12 v14 l7 24 a9 9 0 0 1-8 13 h-10 a9 9 0 0 1-8-13 l7-24 z" fill="none" stroke="#cfe9f2" strokeWidth="2" opacity="0.85" />
          <rect x="9" y="1" width="16" height="4" rx="2" fill="#cfe9f2" opacity="0.85" />
        </svg>
        <span style={{ font: '700 8px ui-monospace, monospace', color: '#9fd6e6', letterSpacing: '0.1em', marginTop: 1 }}>MANA</span>
      </div>

      {/* SATCHEL panel — the bag EXTENDS the hotbar: its 6 slots are the bottom row of this grid. */}
      {bagOpen && (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: bottom + slot + 20, zIndex: 36,
          background: '#0e1a17f2', border: '2px solid #2f5c4f', borderRadius: 14, padding: 12, boxShadow: '0 12px 40px #000a' }}>
          <div style={{ font: '800 11px ui-monospace, monospace', color: '#8fd9c4', letterSpacing: '0.14em', marginBottom: 9, textAlign: 'center' }}>SATCHEL</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SLOTS}, ${slot}px)`, gap: 6 }}>
            {/* extension rows first (top), hotbar row last (bottom) — one continuous grid */}
            {PH_ITEMS.slice(SLOTS).map((it, i) => (
              <div key={'x' + i} style={{ position: 'relative', width: slot, height: slot, borderRadius: slot * 0.2, border: '2px solid #ffffff14', background: '#111c1a' }}>
                <ItemTile item={it} size={slot} />
              </div>
            ))}
            {PH_ITEMS.slice(0, SLOTS).map((it, i) => <SlotBtn key={'h' + i} i={i} item={it} />)}
          </div>
        </div>
      )}

      {/* BOTTOM BAR — [Bag] [6 slots] [tool gauges] */}
      <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom, zIndex: 35,
        display: 'flex', alignItems: 'flex-end', gap: isTouch ? 6 : 9, pointerEvents: 'auto', maxWidth: '98vw' }}>
        {/* Bag */}
        <button onClick={() => setBagOpen(o => !o)} title="Satchel" style={{
          width: slot, height: slot, flexShrink: 0, borderRadius: slot * 0.22, cursor: 'pointer', touchAction: 'none',
          border: `2px solid ${bagOpen ? '#d4a843' : '#ffffff2a'}`, background: bagOpen ? '#241d10' : '#1a140c',
          font: `${slot * 0.5}px serif`, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: bagOpen ? '0 0 12px #d4a84355' : 'inset 0 1px 0 #ffffff10',
        }}>🎒</button>

        {/* 6 quick-slots */}
        <div style={{ display: 'flex', gap: isTouch ? 4 : 6 }}>
          {PH_ITEMS.slice(0, SLOTS).map((it, i) => <SlotBtn key={i} i={i} item={it} />)}
        </div>

        {/* tool gauges — starter = ∞, upgraded = depleting durability ring */}
        <div style={{ display: 'flex', gap: isTouch ? 5 : 7 }}>
          {tools.map(t => {
            const r = slot / 2, c = slot / 2, rad = r - 3, circ = 2 * Math.PI * rad
            const low = !t.infinite && t.dur < 0.25
            const ring = t.infinite ? '#5a6b66' : low ? '#ff5a4d' : t.tint
            return (
              <button key={t.id} title={`${t.label}${t.infinite ? ' (starter · ∞)' : ` · ${Math.round(t.dur * 100)}%`}`} style={{
                position: 'relative', width: slot, height: slot, flexShrink: 0, borderRadius: '50%', cursor: 'pointer', touchAction: 'none',
                border: 'none', background: '#141d1a', boxShadow: 'inset 0 1px 0 #ffffff10, 0 1px 3px #0007', padding: 0,
              }}>
                <svg width={slot} height={slot} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                  <circle cx={c} cy={r} r={rad} fill="none" stroke="#ffffff14" strokeWidth="3" />
                  <circle cx={c} cy={r} r={rad} fill="none" stroke={ring} strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={t.infinite ? 0 : circ * (1 - t.dur)} />
                </svg>
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `${slot * 0.42}px serif` }}>{t.glyph}</span>
                <span style={{ position: 'absolute', bottom: -1, left: 0, right: 0, textAlign: 'center', font: '800 8px ui-monospace, monospace', color: t.infinite ? '#7f938e' : low ? '#ff8a7a' : '#cfe9df' }}>
                  {t.infinite ? '∞' : `${Math.round(t.dur * 100)}%`}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
