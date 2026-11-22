// THE BENCH PANEL'S TABS (Alex 11-20, at the carpentry room: "clean up the clutter and do tabs for each one and use icons for
// each one so the player can swap between what they need ... and not a huge list"). Pure: which tabs a room's bench shows,
// in order. The crafting tabs come first, the Moglin who keeps the room is always last. Drawn by workshop.tsx (BenchPanel),
// glyphs in bench-glyphs.tsx. Run: npx tsx src/app/shimmer/open/ather/bench-tabs.test.ts
import type { RoomKind } from './rooms'
import { BENCH, type FocusSkill } from './focuses'

export type BenchTab = 'refine' | 'furniture' | 'blades' | 'spikes' | 'hearth' | 'cauldron' | 'bait' | 'rinsticks' | 'keeper'

export const TAB_LABEL: Record<BenchTab, string> = {
  refine: 'Refine', furniture: 'Furniture', blades: 'Pruners', spikes: 'Spikes', hearth: 'Hearth', cauldron: 'Cauldron',
  bait: 'Bait', rinsticks: 'Rinsticks', keeper: 'Moglin',   // the keeper is the PLAYER; this tab is the room's Moglin (Alex 11-22)
}

const FOCUS_TAB: Record<FocusSkill, BenchTab> = { forestry: 'blades', prospecting: 'spikes' }
const CRAFT_TABS: Partial<Record<RoomKind, BenchTab[]>> = {
  carpentry: ['refine', 'furniture'],
  stonemason: ['refine'],
  cooking: ['hearth'],
  alchemy: ['cauldron'],
  rinnshop: ['bait', 'rinsticks'],
}

/** The tabs a room's bench shows: its crafts, then any tool focus made there (focuses.ts BENCH), then the keeper. */
export function benchTabs(kind: RoomKind): BenchTab[] {
  const focus = (Object.keys(BENCH) as FocusSkill[]).filter(s => BENCH[s] === kind).map(s => FOCUS_TAB[s])
  return [...(CRAFT_TABS[kind] ?? []), ...focus, 'keeper']
}

/** Where a job lives: the tab to open so a pick (or a check) can reach it. */
export const tabOfFocus = (s: FocusSkill): BenchTab => FOCUS_TAB[s]
