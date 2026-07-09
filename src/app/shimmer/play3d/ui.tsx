// Shared presentational primitives for the walker's HUD + station menus.
//
// These lived in Shimmer3D.tsx. They moved here when the station menus were extracted into
// StationMenus.tsx: both files need them, and importing them back out of Shimmer3D would make the
// import graph circular. Nothing here holds game state — pure style consts + dumb components.

import type { ItemStack } from '../engine/inventory'

/** `raw_mana_shard` → `Raw Mana Shard`. Used everywhere an item id is shown to the player. */
export const prettyItem = (id: string) =>
  id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

/** The walker's standard small button (menu chrome, ✕ closers). */
export const menuBtn: React.CSSProperties = {
  padding: '6px 11px', borderRadius: 7, border: '1px solid #ffffff2a', background: '#16142a',
  color: '#e9dfc8', font: '700 11px ui-monospace, monospace', cursor: 'pointer', whiteSpace: 'nowrap',
}

/** Per-skill tool chrome — the glyph + tint used by the HUD and the crafting table's ⚒ TOOLS list. */
export const TOOL_HUD: Record<string, { glyph: string; tint: string; label: string }> = {
  forestry:    { glyph: '🪓', tint: '#8fd97f', label: 'Forestry' },
  prospecting: { glyph: '⛏️', tint: '#d9b56a', label: 'Prospecting' },
  rinning:     { glyph: '🎣', tint: '#6fb8d9', label: 'Rinning' },
}

/** The early-game staple shortlist the Exchange Booth offers for sale. */
export const GE_BUY_CURATED = [
  'mana_draught', 'shard_tonic', 'goldwood_plank', 'goldwood_bark', 'raw_mana_shard',
  'shimmeroak_plank', 'seed_shimmerwheat', 'seed_glowroot', 'seed_sunpetal',
]

/** A tappable inventory/chest grid. Empty slots are disabled, not hidden. */
export function SlotGrid({ slots, onTap, cols = 5, accent }: {
  slots: (ItemStack | null)[]; onTap: (idx: number) => void; cols?: number; accent: string
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4 }}>
      {slots.map((s, i) => (
        <button key={i} onClick={() => s && onTap(i)} disabled={!s} style={{
          position: 'relative', aspectRatio: '1', minHeight: 40, borderRadius: 7,
          border: `1px solid ${s ? accent + '66' : '#ffffff14'}`, background: s ? '#1c1730' : '#00000022',
          cursor: s ? 'pointer' : 'default', touchAction: 'none', padding: 0,
        }}>
          {s && (
            <>
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 8px ui-monospace, monospace', color: '#eadcff', textAlign: 'center', overflow: 'hidden', padding: 2, lineHeight: 1.1 }}>
                {prettyItem(s.itemId).split(' ').map(w => w.slice(0, 3)).join(' ')}
              </span>
              {s.count > 1 && <span style={{ position: 'absolute', right: 2, bottom: 1, font: '800 9px ui-monospace, monospace', color: '#fff', textShadow: '0 1px 2px #000' }}>{s.count}</span>}
            </>
          )}
        </button>
      ))}
    </div>
  )
}

/** The full-screen scrim + panel every station menu shares. Kept here so the five menus can't drift. */
export function StationShell({ accent, border, bg, title, subtitle, onClose, children }: {
  accent: string; border: string; bg: string; title: string; subtitle?: React.ReactNode
  onClose: () => void; children: React.ReactNode
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 47, background: '#05070ae8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, touchAction: 'none' }}>
      <div style={{ width: 'min(440px, 95vw)', maxHeight: '86vh', overflowY: 'auto', background: bg, border: `2px solid ${border}`, borderRadius: 16, padding: '18px 18px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ font: '900 16px ui-monospace, monospace', color: accent, letterSpacing: '0.1em' }}>{title}</span>
          <button onClick={onClose} style={{ ...menuBtn, padding: '4px 10px' }}>✕</button>
        </div>
        {subtitle}
        {children}
      </div>
    </div>
  )
}
