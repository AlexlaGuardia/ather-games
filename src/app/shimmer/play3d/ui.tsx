// Shared presentational primitives for the walker's HUD + station menus.
//
// These lived in Shimmer3D.tsx. They moved here when the station menus were extracted into
// StationMenus.tsx: both files need them, and importing them back out of Shimmer3D would make the
// import graph circular. Nothing here holds game state — pure style consts + dumb components.

import type { ItemStack } from '../engine/inventory'
import { ink, gold, mint, accent as hue, hair, radius, type as t, tracking, textShadow, tone, type ToneName } from './tokens'

/** `raw_mana_shard` → `Raw Mana Shard`. Used everywhere an item id is shown to the player. */
export const prettyItem = (id: string) =>
  id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

/** The walker's standard small button (menu chrome, ✕ closers). */
export const menuBtn: React.CSSProperties = {
  padding: '6px 11px', borderRadius: radius.sm, border: `1px solid ${hair.medium}`, background: ink.panel,
  color: gold.parchment, font: t.hud, cursor: 'pointer', whiteSpace: 'nowrap',
}

/** Per-skill tool chrome — the glyph + tint used by the HUD and the crafting table's ⚒ TOOLS list. */
export const TOOL_HUD: Record<string, { glyph: string; tint: string; label: string }> = {
  forestry:    { glyph: '🪓', tint: mint.soft,  label: 'Forestry' },
  prospecting: { glyph: '⛏️', tint: gold.dim,   label: 'Prospecting' },
  rinning:     { glyph: '🎣', tint: hue.water,  label: 'Rinning' },
}

/**
 * The early-game staple shortlist the Exchange Booth offers for sale.
 *
 * The four element-herb seeds are stocked even though they are farming level 6, because the booth
 * is the only shop in the build: a crop with no seed source is a crop nobody can plant, and the
 * infusion economy already spent months in exactly that state. Growing them still needs the level;
 * buying the seed early just means the shelf is not the thing standing in the way.
 */
export const GE_BUY_CURATED = [
  'mana_draught', 'shard_tonic', 'goldwood_plank', 'goldwood_bark', 'raw_mana_shard',
  'shimmeroak_plank', 'seed_shimmerwheat', 'seed_glowroot', 'seed_sunpetal',
  'seed_violetbloom', 'seed_stormgrass', 'seed_rootvine', 'seed_tidepetal',
]

/** A tappable inventory/chest grid. Empty slots are disabled, not hidden. */
export function SlotGrid({ slots, onTap, cols = 5, accent }: {
  slots: (ItemStack | null)[]; onTap: (idx: number) => void; cols?: number; accent: string
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4 }}>
      {slots.map((s, i) => (
        <button key={i} onClick={() => s && onTap(i)} disabled={!s} style={{
          position: 'relative', aspectRatio: '1', minHeight: 40, borderRadius: radius.sm,
          border: `1px solid ${s ? accent + '66' : hair.faint}`, background: s ? ink.raised : ink.wash,
          cursor: s ? 'pointer' : 'default', touchAction: 'none', padding: 0,
        }}>
          {s && (
            <>
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 8px ui-monospace, monospace', color: mint.text, textAlign: 'center', overflow: 'hidden', padding: 2, lineHeight: 1.1 }}>
                {prettyItem(s.itemId).split(' ').map(w => w.slice(0, 3)).join(' ')}
              </span>
              {s.count > 1 && <span style={{ position: 'absolute', right: 2, bottom: 1, ...t.value, color: mint.text, textShadow }}>{s.count}</span>}
            </>
          )}
        </button>
      ))}
    </div>
  )
}

/**
 * The full-screen scrim + panel every station menu shares.
 *
 * ⚠ TAKES A TONE NAME, NOT COLOURS. The previous signature accepted `accent`/`border`/`bg`, which is
 * how six call sites came to hold six different triplets while this file's own header claimed they
 * could not drift. A caller that needs a colour this shell does not offer should add a tone to
 * `tokens.ts`, so the next reader finds one list of every surface the walker can wear.
 */
export function StationShell({ tone: toneName, title, subtitle, onClose, children }: {
  tone: ToneName; title: string; subtitle?: React.ReactNode
  onClose: () => void; children: React.ReactNode
}) {
  const { accent, border, bg } = tone[toneName]
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 47, background: ink.scrim, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, touchAction: 'none' }}>
      <div style={{ width: 'min(440px, 95vw)', maxHeight: '86vh', overflowY: 'auto', background: bg, border: `2px solid ${border}`, borderRadius: radius.lg, padding: '18px 18px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ font: t.title, color: accent, letterSpacing: tracking }}>{title}</span>
          <button onClick={onClose} style={{ ...menuBtn, padding: '4px 10px' }}>✕</button>
        </div>
        {subtitle}
        {children}
      </div>
    </div>
  )
}
