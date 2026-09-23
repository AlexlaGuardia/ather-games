// The keeper panel's screens, as DATA — split from keeper-panel.tsx (2026-09-22) so a node-run guard
// can read the list without loading the panel's UI (fonts and CSS do not load under tsx).
export type KeeperTab = 'satchel' | 'gear' | 'grimoire'

/**
 * Tab order is the keeper's own chain: what you CARRY → what you WEAR → what you KNOW.
 *
 * ★ THREE TABS, NOT FIVE (Alex, 2026-09-03 eve, the pinned inventory-menu conversation).
 *   · RUNES is gone — *"not convinced we need that runes tab."* Its move list was the same data the
 *     bind picker on Gear draws from, and the runes you hold are one chip row. The letters that
 *     briefly lived on it are carried things, so they moved to the Satchel with the bag.
 *   · TOOLS folded INTO Gear — canon's word for a Blade, Spike or Rinstick is *gathering focus*
 *     (`CANON/glossary.md` § Focus: *"two shapes, one class"*), the same class as the casting glove
 *     the Gear tab already equips. Two tabs for one class of object was the build asserting a
 *     distinction canon does not draw.
 *   · LOADOUT is renamed GEAR — Alex's word in both windows (*"from the gear tab they can add them
 *     in"*, *"the seats should show up in gear"*). The vessels are gear you own singly since
 *     `57a2ef9`; the label follows the model.
 *
 * ⚠ THE OLD `runes` / `tools` / `loadout` IDS ARE GONE FROM THE TYPE ON PURPOSE. A stale
 * `setTab('loadout')` anywhere is a compile error, not a tab that silently never opens.
 */
export const KEEPER_TABS: { id: KeeperTab; label: string }[] = [
  { id: 'satchel', label: 'Satchel' },
  { id: 'gear', label: 'Gear' },
  { id: 'grimoire', label: 'Grimoire' },
]
