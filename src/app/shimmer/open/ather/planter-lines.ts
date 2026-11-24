/** ★ SIGNED (Alex, athernyx b3dc505): CANON/game/shimmer-lines-batch-2026-11-23c.md › B, MAIN, word for word
 *  (lines-batch-23c.test.ts reads the canon file). The bloomed planter's lift refusal and the Planter Box's hint. */
export const BLOOMED_SPIRIT_LINE = 'A spirit bloomed here. The whole garden is its home now.'
/** B › `planter_box` hint, renamed by batch 11-24c B (the item's own name): "This box is for saplings. A Mana Seed wants a Spirit Bed: <recipe>". */
export const planterBoxHint = (planter: string, recipe: string) => `This box is for saplings. A Mana Seed wants a ${planter}: ${recipe}`
/** ★ SIGNED (Alex 11-24): CANON/game/shimmer-lines-batch-2026-11-24c.md › A, MAIN, word for word (lines-batch-24c.test.ts reads
 *  the canon file). capped: Magii #17237, the number stays in the line (8 is canon, furniture.ts BEDS_MAX). */
export const BED_UI = {
  title: 'Spirit Bed',
  full: "This bed's record is full.",
  featured: 'Chose to stay near this bed.',
  roaming: 'Roaming the garden.',
  ask: 'Ask to stay',
  record: 'Bloomed here',
  group: (n: number) => `Bed ${n}`,
  capped: '8 spirit beds already stand in this garden.',
} as const
