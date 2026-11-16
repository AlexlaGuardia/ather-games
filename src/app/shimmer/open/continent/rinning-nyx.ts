// RINNING ON THE WAKING CONTINENT (Alex 11-16: "bring rinning over here too"; canon: CANON_GAPS tycoon entry (3), RULED
// 11-15/16: "a rinn ecosystem to rinn off world/rinn.md's zones (rinn are animals, so rinning is lawful)", seat's note:
// "start ~10 species"). Same rod, wait and reel as the Wilds (shared/rinning-fx.tsx, shared/reel.ts); this file is what
// bites where on the mortal side.
//
// ★ THE CATCH IS CANON'S, NOT INVENTED. Every name below is in world/rinn.md (The Shallows, Coastal Eels, Open Blue),
//   with its line from canon's Notes column. Left out on purpose:
//   · ★ Shimmerscale (canon's tuna) and Ribboneel ARE here, as `sea_shimmerscale` / `sea_ribboneel` (RULED 11-16,
//     rinn.md › Shared names across the gate: two creatures, one name each, the Ather's are the dreaming cousins). The
//     bag tells them apart by look and line, under canon's one name; the ids keep the Ather's rows as they were.
//   · Wavebacks ("never eaten") and Shellmound ("protected, bad luck to harm"): canon forbids taking them.
//   · Inkpots, Sandburrowers, Spireshells: gathered off rocks and dug at low tide, not rinned.
//   · The hunters, giants, Sky-Swimmers and the Deep: not from a shore with a rinstick.
//   ★ RIVERS (RULED 11-16, rinn.md › Rivers & Lakes, Alex's "a few more for variety"): Pebblefin, Reedperch,
//     Mudwhisker, Longjaw, Fallsleaper, Oldplate. Bluescale stays the river-mouth rinn (rivers and coast both).
//
// WATER: the continent's sea is one plane at y −0.15 (continent/page.tsx › Water); rivers are carved below it. Which
// water a cast lands in is read from how much water lies round it: narrow water is a RIVER, wide is the COAST, and
// water that is nearly all water out to 220 m is the OPEN sea (the rarer rinn).
// Tiers, level gates and XP follow the Ather's (1 / 4 / 7 / 10; RINN_XP), so one Rinning level means the same on both sides.
//
// ★ PURE but for the region it reads.

import type { Region } from '../region'
import { RINN_XP, type Rinn, type Pattern } from '../shared/reel'

/** the continent's water surface (continent/page.tsx › Water) */
export const NYX_WATER_Y = -0.15
export type NyxWater = 'river' | 'coast' | 'open'

export interface NyxRinn extends Rinn { waters: NyxWater[] }
const r = (id: string, name: string, tier: 1 | 2 | 3 | 4, pattern: Pattern, waters: NyxWater[], blurb: string): NyxRinn =>
  ({ id, name, tier, level: [0, 1, 4, 7, 10][tier], xp: RINN_XP[tier], blurb, pattern, waters })

/** canon's mortal rinn a keeper can take from the shore (world/rinn.md; blurbs are canon's Notes) */
export const NYX_RINN: NyxRinn[] = [
  // tier 1: what villages fish, what everyone eats
  r('silvergill', 'Silvergill', 1, 'darter', ['coast', 'open'], 'The staple. Smoked, salted, fried. Every coastal village lives on these.'),
  r('razorback', 'Razorbacks', 1, 'darter', ['coast'], 'Abundant. Dried, fried, or in stews.'),
  r('clickclaw', 'Clickclaw', 1, 'sidler', ['coast'], 'Most common. Boiled, cracked, eaten with bread.'),
  r('bluescale', 'Bluescale', 1, 'steady', ['river', 'coast'], 'Found where rivers meet sea. Delicate flavor.'),
  // tier 2: the good fish for meals
  r('coppermouth', 'Coppermouth', 2, 'steady', ['coast'], 'Firm white flesh. The "good fish" for meals.'),
  r('duskfin', 'Duskfin', 2, 'zigzag', ['coast', 'open'], 'Oily, rich. Grilled whole. Keeps well smoked.'),
  r('mossback', 'Mossback', 2, 'roller', ['coast'], 'Bottom-dweller. Mild taste. Pan-fried in butter.'),
  r('thornhead', 'Thornhead', 2, 'sulker', ['coast'], 'Ugly but delicious. Spines removed, meat is tender.'),
  // tier 3: prized
  r('reefrunner', 'Reefrunner', 3, 'darter', ['coast'], 'Bright scales, sweet meat. Prized catch.'),
  r('moray_rinn', 'Moray Rinn', 3, 'zigzag', ['coast'], 'Hides in reef crevices. Territorial. Bite is nasty but meat is good.'),
  r('lanternjaw', 'Lanternjaw', 3, 'sulker', ['coast', 'open'], 'Shallow-water variety. Lure glows faint green. Meat is dense.'),
  r('pearljaw', 'Pearljaws', 3, 'sidler', ['coast'], 'Raw or cooked. Occasionally contain actual pearls.'),
  r('stoneshell', 'Stoneshell', 3, 'sidler', ['open'], 'Larger, deeper water. Celebration food.'),
  // tier 4: the open water's
  r('stormrunner', 'Stormrunner', 4, 'roller', ['open'], 'Follows ships. Bright colors fade after death.'),
  r('razormouth', 'Razormouth', 4, 'darter', ['open'], 'Lightning fast. Attacks shiny objects.'),
  r('ironside', 'Ironside', 4, 'zigzag', ['open'], 'Solitary hunter. Dense flesh. Trophy catch.'),
  // the mortal cousins of two Ather names (the same canon name; the bag's look and line tell them apart)
  r('sea_ribboneel', 'Ribboneel', 2, 'zigzag', ['coast'], 'The sea eel, 1-2 metres. Common. Slippery, fast. Smoked eel is a delicacy.'),
  r('sea_shimmerscale', 'Shimmerscale', 3, 'darter', ['open'], 'The ocean shimmerscale. Migratory schools. Fast, powerful. Premium meat.'),
  // rivers and lakes (rinn.md › Rivers & Lakes)
  r('pebblefin', 'Pebblefin', 1, 'darter', ['river'], 'Schools in shallow streams over gravel. Fried by the handful. Every river child\'s first catch.'),
  r('reedperch', 'Reedperch', 1, 'steady', ['river'], 'Striped, bold, lives in the slow reedy bends. The everyday river supper.'),
  r('mudwhisker', 'Mudwhisker', 2, 'sulker', ['river'], 'Whiskered bottom-feeder of slow brown water. Bites best at dusk. Ugly, sweet meat.'),
  r('longjaw', 'Longjaw', 3, 'zigzag', ['river'], 'Ambush hunter in the weedbeds, all teeth. Fights hard. Anglers measure it with their arms.'),
  r('fallsleaper', 'Fallsleaper', 3, 'darter', ['river'], 'Runs upriver every autumn and leaps the falls, red at the end of the run. Smoked for winter.'),
  r('oldplate', 'Oldplate', 4, 'roller', ['river'], 'Armoured in bony plates, lives a hundred years in the deepest river pools. Rare. Its roe is a Citadel luxury.'),
]

const TIER_WEIGHT = [0, 10, 4, 1.6, 0.35]   // as the Wilds': the table leans common
const OPEN_RARE = 1.6                         // open water tips toward the rarer rinn

/** what kind of water is at x, z: narrow = river, wide = coast, nearly all water out to 220 m = the open sea */
export function nyxWaterAt(R: Region, x: number, z: number): NyxWater {
  const frac = (rad: number, n: number) => {
    let w = 0
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; if (R.heightAt(x + Math.cos(a) * rad, z + Math.sin(a) * rad) < NYX_WATER_Y) w++ }
    return w / n
  }
  if (frac(70, 16) < 0.3) return 'river'
  return frac(220, 24) > 0.7 ? 'open' : 'coast'
}
/** real water deep enough to cast into */
export const nyxIsWater = (R: Region, x: number, z: number) => R.heightAt(x, z) < NYX_WATER_Y - 0.1

/** What bites: weighted by tier among the rinn of this water the keeper's Rinning level can hook. */
export function rollNyxRinn(level: number, water: NyxWater, rng: () => number): NyxRinn {
  let open = NYX_RINN.filter(n => n.level <= level && n.waters.includes(water))
  if (!open.length) open = NYX_RINN.filter(n => n.level <= 1 && n.waters.includes('coast'))
  const w = open.map(n => TIER_WEIGHT[n.tier] * (water === 'open' && n.tier > 1 ? OPEN_RARE : 1))
  let k = rng() * w.reduce((a, b) => a + b, 0)
  for (let i = 0; i < open.length; i++) { k -= w[i]; if (k <= 0) return open[i] }
  return open[open.length - 1]
}
