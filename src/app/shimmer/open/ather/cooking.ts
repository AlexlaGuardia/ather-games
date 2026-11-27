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
// ★ WHAT FOOD IS FOR (M234 s2, THE RECIPES SIT-DOWN 11-27, supersedes the 11-17 mid-fight heal): FOOD FEEDS SPIRITS,
//   POTIONS HEAL KEEPERS. Every hearth dish is fed to a garden spirit (spirit-dishes.ts); the keeper heals with potions only.
import type { Cost, Job } from './furniture'

export interface FoodDef { name: string; blurb: string }
/** Raw meat off the Smokehouse counter. Never eaten raw: it roasts first. */
export const MEATS: Readonly<Record<string, FoodDef>> = {
  drifthorn_cut: { name: 'Drifthorn Cut', blurb: 'Lean farmed meat from the continent, wrapped in waxed paper. It wants the hearth.' },
  tuskroot_cut: { name: 'Tuskroot Cut', blurb: 'A rich, fatty cut from a farmed Tuskroot. It roasts in its own fat.' },
  hearthwing_eggs: { name: 'Hearthwing Eggs', blurb: 'Speckled eggs, packed snug for the road. Set them in the coals.' },
}
/** M205: the staples the Trading Co. supplier sells (canon world/cuisine.md › Grains & Starches: Capgrain line 19, Rootbulb
 *  line 20; names + looks are canon, blurbs await @lark). Rootbulb is "roasted": it roasts at the hearth. Capgrain is flour for
 *  bread / porridge / stews: the hearth is open coals, no vessel (09-15), so it has no recipe yet (a later slice). */
export const STAPLES: Readonly<Record<string, FoodDef>> = {
  rootbulb: { name: 'Rootbulb', blurb: 'A knobby, starchy node with pale flesh. It roasts at the hearth.' },
  capgrain: { name: 'Capgrain', blurb: 'Dried, ground shelf-fungi caps, pale tan. Flour for bread and porridge.' },
}
/** What the hearth roasts. ★ M234 s2 (THE RECIPES SIT-DOWN, alchemy.md, Alex + Magii 11-27): FOOD FEEDS SPIRITS, POTIONS HEAL
 *  KEEPERS. A roast no longer heals the keeper: it is a SPIRIT DISH, fed to a garden spirit in her panel, and `bond` is what
 *  it gives her (spirit-dishes.ts, under the daily cap). A plain roast carries no infusion, so no element: bond only. Old saves:
 *  a roast in a bag keeps its id, it is simply a dish now. Bond numbers = Jin's (feel: Alex); blurbs = placeholders for @lark. */
const FEED = 'Feed it to a garden spirit, in her panel.'
export const DISHES: Readonly<Record<string, FoodDef & { bond: number }>> = {
  roast_rinn: { name: 'Roast Rinn', blurb: `A Shimmerscale roasted over the coals. ${FEED}`, bond: 3 },
  roast_eggs: { name: 'Roast Eggs', blurb: `Hearthwing eggs done in the coals. ${FEED}`, bond: 2 },
  roast_drifthorn: { name: 'Roast Drifthorn', blurb: `Drifthorn roasted on the hearth. ${FEED}`, bond: 4 },
  roast_tuskroot: { name: 'Roast Tuskroot', blurb: `Tuskroot roasted in its own fat. ${FEED}`, bond: 5 },
  // M206: a fillet off the Rinnshop's Filet tab roasts too (names + blurbs await @lark)
  roast_shimmerscale_fillet: { name: 'Roast Shimmerscale Fillet', blurb: `A Shimmerscale fillet off the coals. ${FEED}`, bond: 3 },
  roast_ribboneel_fillet: { name: 'Roast Ribboneel Fillet', blurb: `Ribboneel roasted on the hearth. ${FEED}`, bond: 4 },
  roast_clickclaw_meat: { name: 'Roast Clickclaw', blurb: `Clickclaw meat done in the coals. ${FEED}`, bond: 3 },
  // M205: a Rootbulb off the Trading Co. supplier roasts
  roast_rootbulb: { name: 'Roast Rootbulb', blurb: `A rootbulb roasted in the coals. ${FEED}`, bond: 2 },
}

/** ★ M234 s2: THE FIRST DISH (canon, alchemy.md › THE RECIPES SIT-DOWN): **Grilled Rinn with Aqual Sauce** (Water), and its
 *  spicy variant with Fuli Powder crushed with **Firewort** at the Crusher Table (infusions.ts SPICE_MIXES), which adds a touch
 *  of Mana. `steep` = the element slots the dish fills on her bar, in order: a dish's element value VARIES, and three Water is
 *  her whole Water need (infusions.ts MEALS_FOR_FORM) in one meal ("one dish can fill a spirit's element"). A dish with
 *  MOONBERRY gives a little more bond (Magii 30d19fd), still under the daily cap. Element values + bond = Jin's (feel: Alex).
 *  Canon names: Grilled Rinn, Aqual Sauce, Fuli Powder, Firewort, Moonberry. The variant names are PLACEHOLDERS for @lark. */
export interface GrillDef extends FoodDef { in: readonly { id: string; n: number }[]; steep: readonly ('mana' | 'storm' | 'earth' | 'water')[]; bond: number }
export const FIERY_SPICE = 'fiery_fuli_powder'
export const MOONBERRY = 'moonberry'
export const MOONBERRY_BOND = 3
const GRILL_BASE = [{ id: 'shimmerscale', n: 1 }, { id: 'aqual_sauce', n: 1 }]
export const GRILLED: Readonly<Record<string, GrillDef>> = {
  grilled_rinn: { name: 'Grilled Rinn with Aqual Sauce', blurb: `A Shimmerscale grilled with Aqual Sauce. Water for a spirit. ${FEED}`, in: GRILL_BASE, steep: ['water', 'water', 'water'], bond: 4 },
  grilled_rinn_spicy: { name: 'Spicy Grilled Rinn', blurb: `Grilled Rinn with Aqual Sauce and a Firewort kick: Water, and a touch of Mana. ${FEED}`, in: [...GRILL_BASE, { id: FIERY_SPICE, n: 1 }], steep: ['water', 'water', 'water', 'mana'], bond: 4 },
  grilled_rinn_moonberry: { name: 'Grilled Rinn with Moonberry', blurb: `Grilled Rinn with Aqual Sauce and Moonberry. Water, and a little more bond. ${FEED}`, in: [...GRILL_BASE, { id: MOONBERRY, n: 1 }], steep: ['water', 'water', 'water'], bond: 4 + MOONBERRY_BOND },
}

/** BETA M206 (world, Alex 11-26): THE RINNSHOP'S FILET TAB prepares a caught rinn. Jin's pick of the Ather's own roster
 *  (rinning.ts RINN; canon CANON_GAPS 'Cooking, part 2' leaves "which existing rinn map in" to Jin):
 *   · Shimmerscale (tier 1, canon's food rinn) -> a fillet AND its scales. The scales are the one rinn's scales that grind:
 *     Aqual Sauce (infusions.ts) is ground at the Crusher from them + an Aqual (Alex: "shimmerscales ground into a powder").
 *   · Ribboneel (tier 2) -> a fillet; Clickclaw (tier 1) -> its meat (canon cuisine.md says "clickclaw meat").
 *   Glowfin + Moonkoi are SPIRIT food, raw (cuisine.md 09-15): never fileted. A fillet's use: it ROASTS at the hearth.
 *  Neutral UI words, for @lark. */
export const FILLETS: Readonly<Record<string, FoodDef>> = {
  shimmerscale_fillet: { name: 'Shimmerscale Fillet', blurb: 'Cut at the Rinnshop. Roast it at the hearth.' },
  ribboneel_fillet: { name: 'Ribboneel Fillet', blurb: 'Cut at the Rinnshop. Roast it at the hearth.' },
  clickclaw_meat: { name: 'Clickclaw Meat', blurb: 'Picked from the shell at the Rinnshop. Roast it at the hearth.' },
}
export const SCALES = 'shimmerscale_scales'
export const SCALES_DEF: FoodDef = { name: 'Shimmerscale Scales', blurb: 'Scraped at the Rinnshop. Grind them at the Crusher with an Aqual into Aqual Sauce.' }
/** what one rinn is fileted into (in bag order). A rinn not here has no Filet row. */
export const FILET: Readonly<Record<string, readonly { id: string; n: number }[]>> = {
  shimmerscale: [{ id: 'shimmerscale_fillet', n: 1 }, { id: SCALES, n: 1 }],
  ribboneel: [{ id: 'ribboneel_fillet', n: 1 }],
  clickclaw: [{ id: 'clickclaw_meat', n: 1 }],
}
/** a hearth roast (a plain spirit dish, bond only). M234 s2: it no longer heals the keeper. */
export const isDish = (id: string | null | undefined): id is string => !!id && id in DISHES

/** The hearth's jobs: one in, one out, roasted. Shimmerscale is the only WHOLE rinn that roasts (canon: the tier-1 food rinn);
 *  M206: the Filet tab's fillets roast too. */
const roast = (id: string, from: string): Job => ({ id: `roast-${id}`, label: 'Roast', in: [{ id: from, n: 1 }], out: { id, n: 1 } })
export const ROAST: readonly Job[] = [
  roast('roast_rinn', 'shimmerscale'),
  roast('roast_eggs', 'hearthwing_eggs'),
  roast('roast_drifthorn', 'drifthorn_cut'),
  roast('roast_tuskroot', 'tuskroot_cut'),
  roast('roast_shimmerscale_fillet', 'shimmerscale_fillet'),
  roast('roast_ribboneel_fillet', 'ribboneel_fillet'),
  roast('roast_clickclaw_meat', 'clickclaw_meat'),
  roast('roast_rootbulb', 'rootbulb'),
]

/** M204 (Alex 11-26): THE ELEMENT MEALS. M207: an INFUSION (infusions.ts INFUSION: Aqual Sauce, Golden Glaze, Storm Broth,
 *  Fuli Powder, made at the alchemy set) + one Shimmerscale cooks into a meal a garden spirit is FED (her panel): it adds the
 *  infusion's element to her bar for good. Not eaten by the keeper (not a DISH). Ids spelled out here so this data file stays
 *  import-free (infusions.ts INFUSION / mealId make the same strings; infusions.test checks they agree). */
const INFUSED: Readonly<Record<string, string>> = { mana: 'fuli_powder', storm: 'storm_broth', earth: 'golden_tonic', water: 'aqual_sauce' }
const spiced = (el: string): Job => ({ id: `cook-${el}_meal`, label: 'Cook', in: [{ id: INFUSED[el], n: 1 }, { id: 'shimmerscale', n: 1 }], out: { id: `${el}_meal`, n: 1 } })
// M234 s2: the Water meal's hearth job is gone: its inputs (Aqual Sauce + a Shimmerscale) now grill into Grilled Rinn, the first
// dish (three Water, not one). A water_meal already in a bag still feeds (infusions.ts elementOfMeal).
export const SPICED: readonly Job[] = ['mana', 'storm', 'earth'].map(spiced)
/** M234 s2: the grill: the first dish and its variants (GRILLED) */
export const GRILL: readonly Job[] = Object.entries(GRILLED).map(([id, d]) => ({ id: `grill-${id}`, label: 'Grill', in: d.in, out: { id, n: 1 } }))
/** everything the hearth does */
export const HEARTH_JOBS: readonly Job[] = [...ROAST, ...GRILL, ...SPICED]

/** The Smokehouse's counter: bundles, priced on the ladder's scale (economy/prices.ts: a contract run pays ~2-8k), so a
 *  run buys a few bundles. A Shimmerscale from the water stays the free meal; meat is the bought, bigger one. */
export interface Bundle { id: string; n: number; price: number }
export const SMOKEHOUSE_STOCK: readonly Bundle[] = [
  { id: 'hearthwing_eggs', n: 6, price: 300 },
  { id: 'drifthorn_cut', n: 5, price: 500 },
  { id: 'tuskroot_cut', n: 5, price: 800 },
]
export type { Cost }
