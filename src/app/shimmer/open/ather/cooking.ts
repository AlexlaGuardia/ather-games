// THE COOKING ROOM'S HEARTH + THE SMOKEHOUSE (2026-11-17, play / Jin 30bbef32). Pure data, like furniture.ts:
// inventory.ts reads it to make the bag rows, so this file imports types only.
//
// Canon:
//  · THE HEARTH ROASTS (world/cuisine.md › THE ATHER HEARTH, ruled 09-15): open coals, no vessel. Its first dish is a rinn,
//    1 rinn → 1 roast rinn, and the tier-1 rinn is Shimmerscale ("basic food"). Glowfin + Moonkoi are SPIRIT food and stay
//    raw: never a roast row. The dish is the keeper's, not a spirit's.
//  · THE SMOKEHOUSE (world/cuisine.md › THE SMOKEHOUSE, RULED 11-17): the Nyx-side shop selling farmed meat BY THE BUNDLE,
//    one name across the continent's towns. Farmed kinds only: Drifthorn, Tuskroot, Hearthwing eggs; never a follower
//    species. Meat crosses the gate as honest trade and roasts at an Ather hearth. The Ather grows no meat of its own.
//  · Jin's: stock, prices, bundle sizes, which towns, heal values, run times. Lark's: the lines (blurbs here await lark).
//
// ★ WHAT FOOD IS FOR: hold a dish and click in the Wilds, it heals the keeper (ather/page.tsx). A keeper regenerates out
//   of a fight anyway (combat.ts REGEN_DELAY/RATE), so a meal is the MID-FIGHT heal: it is what lets a keeper stay in a
//   fight that is going badly instead of running. That is a choice, not more damage (feedback: power is choice).
import type { Cost, Job } from './furniture'

export interface FoodDef { name: string; blurb: string }
/** Raw meat off the Smokehouse counter. Never eaten raw: it roasts first. */
export const MEATS: Readonly<Record<string, FoodDef>> = {
  drifthorn_cut: { name: 'Drifthorn Cut', blurb: 'Lean farmed meat from the continent, wrapped in waxed paper. It wants the hearth.' },
  tuskroot_cut: { name: 'Tuskroot Cut', blurb: 'A rich, fatty cut from a farmed Tuskroot. It roasts in its own fat.' },
  hearthwing_eggs: { name: 'Hearthwing Eggs', blurb: 'Speckled eggs, packed snug for the road. Set them in the coals.' },
}
/** What the hearth makes, and what each heals when eaten in the Wilds. */
export const DISHES: Readonly<Record<string, FoodDef & { heal: number }>> = {
  roast_rinn: { name: 'Roast Rinn', blurb: 'A Shimmerscale roasted over the coals. Hold it and click to eat. Heals 40.', heal: 40 },
  roast_eggs: { name: 'Roast Eggs', blurb: 'Hearthwing eggs done in the coals. Hold them and click to eat. Heals 25.', heal: 25 },
  roast_drifthorn: { name: 'Roast Drifthorn', blurb: 'Drifthorn roasted on the hearth. Hold it and click to eat. Heals 55.', heal: 55 },
  roast_tuskroot: { name: 'Roast Tuskroot', blurb: 'Tuskroot roasted in its own fat. Hold it and click to eat. Heals 75.', heal: 75 },
}
export const isDish = (id: string | null | undefined): id is string => !!id && id in DISHES
export const healOf = (id: string) => DISHES[id]?.heal ?? 0

/** The hearth's jobs: one in, one out, roasted. Shimmerscale is the only rinn that roasts (canon: the tier-1 food rinn). */
const roast = (id: string, from: string): Job => ({ id: `roast-${id}`, label: 'Roast', in: [{ id: from, n: 1 }], out: { id, n: 1 } })
export const ROAST: readonly Job[] = [
  roast('roast_rinn', 'shimmerscale'),
  roast('roast_eggs', 'hearthwing_eggs'),
  roast('roast_drifthorn', 'drifthorn_cut'),
  roast('roast_tuskroot', 'tuskroot_cut'),
]

/** The Smokehouse's counter: bundles, priced on the ladder's scale (economy/prices.ts: a contract run pays ~2-8k), so a
 *  run buys a few bundles. A Shimmerscale from the water stays the free meal; meat is the bought, bigger one. */
export interface Bundle { id: string; n: number; price: number }
export const SMOKEHOUSE_STOCK: readonly Bundle[] = [
  { id: 'hearthwing_eggs', n: 6, price: 300 },
  { id: 'drifthorn_cut', n: 5, price: 500 },
  { id: 'tuskroot_cut', n: 5, price: 800 },
]
export type { Cost }
