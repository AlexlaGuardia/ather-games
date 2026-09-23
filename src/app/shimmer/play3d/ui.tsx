// Shared presentational primitives for the walker's HUD + station menus.
//
// These lived in Shimmer3D.tsx. They moved here when the station menus were extracted into
// StationMenus.tsx: both files need them, and importing them back out of Shimmer3D would make the
// import graph circular. Nothing here holds game state — pure style consts + dumb components.

import type { ItemStack } from '../engine/inventory'
import { ink, gold, mint, accent as hue, hair, radius, type as t } from './tokens'

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

// `SlotGrid` and `StationShell` left this file on 2026-09-23 (Carved Hearth): the five station menus
// wear the hearth kit now, and their shell + satchel wells live in `StationMenus.tsx` — which can import
// the kit, unlike this file (`farming.test.ts` imports it, and the kit pulls `next/font`).
