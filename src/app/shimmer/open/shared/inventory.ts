// THE OPEN WORLD'S BAG — one inventory for the keeper across every open-world page (Alex 11-15: "the hotbar and
// inventory to make sure they not only function but the menu look as well"). Slots 0..7 ARE the hotbar (the template
// draws them top-left); 8.. are the bag. What you hold is whatever sits in the selected hotbar slot.
//
// ★ PURE (no React, no DOM except the guarded load/save). The store + hook live in bag.tsx.
//
// Item names here are build vocabulary for things canon already has (the Repeater: engine/weapons.ts; waymarks:
// gates.md). A new item is one row in OPEN_ITEMS.
import { NYX_RINN } from '../continent/rinning-nyx'
import { keeperKey } from '@/lib/keeper-local'
import { FURNITURE, KEEPSTONES } from '../ather/furniture'
import { MEATS, DISHES } from '../ather/cooking'

export interface ItemDef {
  name: string
  /** one short line for the bag's info card */
  blurb: string
  icon: string
  /** how many fit in one slot */
  stack: number
  kind: 'gun' | 'placeable' | 'material' | 'tool'
}
export const OPEN_ITEMS: Record<string, ItemDef> = {
  repeater: { name: 'Repeater', blurb: 'A sidearm. Twelve to a clip, R reloads. Only the Wilds give it work.', icon: '/open/icons/repeater.svg', stack: 1, kind: 'gun' },
  waymark: { name: 'Waymark', blurb: 'Plant it on open ground in the Wilds and the fold map can take you back. Lift it to carry it again.', icon: '/open/icons/waymark.svg', stack: 12, kind: 'placeable' },
}
/** Which skill an item comes from: the garden bank's tabs (ather/garden-bank.ts). Filled beside each table below, so a
 *  new row lands in its tab with no second list to keep. Not in here = 'gear' (guns, waymarks). */
export type ItemGroup = 'forestry' | 'rinning' | 'prospecting' | 'cooking' | 'decor'
export const ITEM_GROUP: Record<string, ItemGroup> = {}
// ── Forestry's yield (canon: game/shimmer-skilling.md › Forestry resources + design-briefs/shimmer-resources.md; the drop
//    table is world/resources.ts › NODE_DEFS). Icons: public/open/icons/<id with dashes>.svg, drawn by tools/art/forestry_icons.py.
const wood = (name: string, blurb: string): ItemDef => ({ name, blurb, icon: '', stack: 99, kind: 'material' })
const FORESTRY = {
  goldwood_plank: wood('Goldwood Plank', 'Light, warm-toned wood. Easy to work with.'),
  goldwood_bark: wood('Goldwood Bark', 'Papery golden bark, mildly aromatic.'),
  shimmeroak_plank: wood('Shimmeroak Plank', 'Dense wood with a rippled grain that catches light.'),
  amber_sap: wood('Amber Sap', 'Thick golden resin. Smells like warm honey.'),
  starwillow_branch: wood('Starwillow Branch', 'Bends without breaking. Glows faintly at the tips.'),
  starwillow_sap: wood('Starwillow Sap', 'Luminescent sap with mana properties.'),
  dawnwood_plank: wood('Dawnwood Plank', 'Ancient wood that holds warmth. Building with it feels permanent.'),
  crystallized_sap: wood('Crystallized Sap', "Sap so old it's hardened into amber crystal. Contains raw mana."),
  // what a prune pays (forestry.ts): raw logs to refine, and rarely a sapling to plant
  goldwood_log: wood('Goldwood Log', 'Warm golden wood, fresh off the tree. Refine it into planks or bark.'),
  shimmeroak_log: wood('Shimmeroak Log', 'Heavy, rippled wood. Refine it into planks or amber sap.'),
  starwillow_log: wood('Starwillow Log', 'Springy wood that still glows at the cut. Refine it into branches or sap.'),
  dawnwood_log: wood('Dawnwood Log', 'Ancient wood that holds warmth. Refine it into planks or crystallized sap.'),
  goldwood_sapling: wood('Goldwood Sapling', 'A young goldwood, roots balled. It will grow where you plant it.'),
  shimmeroak_sapling: wood('Shimmeroak Sapling', 'A young shimmeroak, already stubborn. It will grow where you plant it.'),
  starwillow_sapling: wood('Starwillow Sapling', 'A young starwillow, tips faintly lit. It will grow where you plant it.'),
  dawnwood_sapling: wood('Dawnwood Sapling', 'A dawnwood seedling. Rare, and slow, and worth it.'),
} satisfies Record<string, ItemDef>
for (const [id, def] of Object.entries(FORESTRY)) def.icon = `/open/icons/${id.replace(/_/g, '-')}.svg`
for (const id of Object.keys(FORESTRY)) ITEM_GROUP[id] = 'forestry'
Object.assign(OPEN_ITEMS, FORESTRY)
// ── Rinning (ather/rinning.ts): bait to cast with, and canon's rinn (game/shimmer-skilling.md › Skill 4: names + lines).
//    Icons: public/open/icons/<id with dashes>.svg, drawn by tools/art/rinn_icons.py (asleep, never dead: shimmer-resources.md).
const catchOf = (name: string, blurb: string): ItemDef => ({ name, blurb, icon: '', stack: 99, kind: 'material' })
const RINNING: Record<string, ItemDef> = {
  bait: { name: 'Bait', blurb: 'Hold it and click the water to cast. One bait a cast. Make more here from a small catch or mast.', icon: '', stack: 99, kind: 'material' },
  shimmerscale: catchOf('Shimmerscale', 'Tiny, warm-scaled. Schools of them catch the light.'),
  clickclaw: catchOf('Clickclaw', 'Small crustacean. Clicks when annoyed. Surprisingly tasty.'),
  glowfin: catchOf('Glowfin', 'Soft bioluminescent scales. Nutritious. Spirits love it raw.'),
  ribboneel: catchOf('Ribboneel', 'Long, slippery, iridescent. Prized for potion-making.'),
  moonkoi: catchOf('Moonkoi', 'Beautiful silver-gold. Slow, patient catch. Worth the wait.'),
  pearlshell: catchOf('Pearlshell', 'Occasionally contains a small Ather pearl.'),
  crystal_rinn: catchOf('Crystal Rinn', 'A Rinn made partly of crystallized mana. Catching one feels like holding a wish.'),
}
for (const [id, def] of Object.entries(RINNING)) def.icon = `/open/icons/${id.replace(/_/g, '-')}.svg`
for (const id of Object.keys(RINNING)) ITEM_GROUP[id] = 'rinning'
Object.assign(OPEN_ITEMS, RINNING)
// ── Prospecting in the Wilds (ather/prospecting.ts): canon's crystal ladder (game/shimmer-skilling.md › Skill 3; the
//    lines are canon's Description column) and the base stone a letter is cut from (RULED 11-16: "a specific stone and not
//    a hard to get one"; its name is Jin's). Grade is worth and look, never power. Icons: tools/art/crystal_icons.py.
const stone = (name: string, blurb: string): ItemDef => ({ name, blurb, icon: '', stack: 99, kind: 'material' })
const PROSPECTING: Record<string, ItemDef> = {
  blankstone: stone('Blankstone', 'Plain, even-grained stone. Every letter a runesmith cuts begins as one.'),
  raw_mana_shard: stone('Raw Mana Shard', 'Common, unrefined. The foundation of every potion.'),
  violet_crystal: stone('Violet Crystal', 'Hums at a frequency you feel in your teeth.'),
  storm_crystal: stone('Storm Crystal', 'Static jumps between your fingers when you hold it.'),
  earth_crystal: stone('Earth Crystal', 'Feels like it weighs twice what it should. Warm.'),
  water_crystal: stone('Water Crystal', 'Surface is always slightly damp. Flows like liquid when struck.'),
  pure_mana_core: stone('Pure Mana Core', 'Refined crystal that rings like a bell when tapped.'),
  ather_crystal: stone('Ather Crystal', 'Pure dream-stuff crystallized. Looking into it feels like looking into distance.'),
}
for (const [id, def] of Object.entries(PROSPECTING)) def.icon = `/open/icons/${id.replace(/_/g, '-')}.svg`
for (const id of Object.keys(PROSPECTING)) ITEM_GROUP[id] = 'prospecting'
Object.assign(OPEN_ITEMS, PROSPECTING)
// ── Rinning on the waking continent (continent/rinning-nyx.ts): canon's mortal rinn (world/rinn.md), bag rows made from
//    the catch table so a name or a line lives in one place. Clickclaw is already a row (the Ather's): one row, two shores.
//    Icons: tools/art/nyx_rinn_icons.py.
for (const n of NYX_RINN) if (!OPEN_ITEMS[n.id]) OPEN_ITEMS[n.id] = { name: n.name, blurb: n.blurb, icon: `/open/icons/${n.id.replace(/_/g, '-')}.svg`, stack: 99, kind: 'material' }
for (const n of NYX_RINN) ITEM_GROUP[n.id] ??= 'rinning'
/** Bait a new keeper starts with (and an older bag is handed once). More is MADE in the bag: see BAIT_FROM. */
export const STARTING_BAIT = 10
// ── BAIT IS MADE (BETA M6e, 2026-11-17). Canon: bait is a food OFFERING, craftable, one per cast (game/shimmer-skilling.md
//    :563; Magii [RULED-AFK] 65d4c21); which foods + rates are Jin's. Two sources ON PURPOSE: a small catch (the loop feeds
//    itself) and FORAGE off a pruned tree (Alex 11-17), because a rinn can get away and a keeper who spends all ten bait
//    without landing one would otherwise have no food to cut: a dead end. Only tier-1 catches: a moonkoi is worth more
//    landed than cut. Made in the bag for now; its home is the Rinnshop (glossary, 11-17) once the room stands.
// MAST (RULED 11-17, athernyx 017be29; glossary Mast): seeds and nuts in golden husks, one item from ANY pruned Ather tree.
//    Shipped for an hour as the placeholder 'forage'; loadInv renames it.
OPEN_ITEMS.mast = { name: 'Mast', blurb: 'Seeds and nuts shaken loose from a pruned branch. Rinn rise to it where it falls on water.', icon: '/open/icons/mast.svg', stack: 99, kind: 'material' }
ITEM_GROUP.mast = 'forestry'
// DEADFALL + CHARCOAL (RULED 11-17, athernyx c52ba1c; glossary Deadfall): a carpenter Moglin's idle product, and what an idle
//    smith burns it into for the forge (ather/moglins.ts). Never from pruning: that stays the keeper's Forestry. Icons: forestry_icons.
OPEN_ITEMS.deadfall = { name: 'Deadfall', blurb: 'Fallen goldwood, gathered up by a carpenter Moglin.', icon: '/open/icons/deadfall.svg', stack: 99, kind: 'material' }
OPEN_ITEMS.charcoal = { name: 'Charcoal', blurb: 'Deadfall burned slow and black. The forge wants it.', icon: '/open/icons/charcoal.svg', stack: 99, kind: 'material' }
ITEM_GROUP.deadfall = 'forestry'; ITEM_GROUP.charcoal = 'forestry'
// THE KEEPSTONE (RULED 11-17, athernyx 5a20b8f; glossary Keepstone): the plot's storage, an item made at the planning table and
//    set on the plot (ather/rooms.ts). Never "chest" to a player.
for (const [id, k] of Object.entries(KEEPSTONES)) OPEN_ITEMS[id] = { name: k.name, blurb: k.blurb, icon: `/open/icons/${id.replace(/_/g, '-')}.svg`, stack: 10, kind: 'placeable' }
// FURNITURE + DECOR (Alex 11-17): items made in the carpentry room, set on the plot (ather/furniture.ts holds the recipes,
//    sizes and blurbs; the blurbs await @lark). Icons: public/open/icons/<id with dashes>.svg (tools/art/furniture_icons.py).
for (const [id, f] of Object.entries(FURNITURE)) { OPEN_ITEMS[id] = { name: f.name, blurb: f.blurb, icon: `/open/icons/${id.replace(/_/g, '-')}.svg`, stack: 10, kind: 'placeable' }; ITEM_GROUP[id] = 'decor' }
// COOKING (2026-11-17, ather/cooking.ts): Smokehouse meat (RULED 11-17) and the hearth's roasts (ruled 09-15). Raw meat is a
//    material; a dish is held and clicked to eat (ather/page.tsx). Icons: tools/art/food_icons.py.
for (const [id, f] of Object.entries(MEATS)) { OPEN_ITEMS[id] = { name: f.name, blurb: f.blurb, icon: `/open/icons/${id.replace(/_/g, '-')}.svg`, stack: 99, kind: 'material' }; ITEM_GROUP[id] = 'cooking' }
for (const [id, f] of Object.entries(DISHES)) { OPEN_ITEMS[id] = { name: f.name, blurb: f.blurb, icon: `/open/icons/${id.replace(/_/g, '-')}.svg`, stack: 20, kind: 'material' }; ITEM_GROUP[id] = 'cooking' }
export const BAIT_FROM: Readonly<Record<string, number>> = { mast: 2, shimmerscale: 3, clickclaw: 3, glowfin: 3 }
/** What the HUD says when the last bait is gone: where more comes from, so it is never a dead end. */
export const NO_BAIT_LINE = 'No bait left. Make more in the bag from a small catch, or mast off a pruned tree.'
export const itemDef = (id: string): ItemDef => OPEN_ITEMS[id] ?? { name: id.replace(/_/g, ' '), blurb: '', icon: '', stack: 99, kind: 'material' }

export const HOTBAR = 8, BAG = 24, SLOTS = HOTBAR + BAG
export type Stack = { id: string; n: number }
export interface Inv { v: 1; slots: (Stack | null)[]; /** one-off gifts already handed over (an older bag gets each once) */ gifts?: string[] }

export function newInv(waymarks = 12): Inv {
  const slots: (Stack | null)[] = Array(SLOTS).fill(null)
  slots[0] = { id: 'repeater', n: 1 }
  if (waymarks > 0) slots[1] = { id: 'waymark', n: waymarks }
  slots[2] = { id: 'bait', n: STARTING_BAIT }   // rinning (ather/rinning.ts): hold it, click the water
  return { v: 1, slots, gifts: ['bait1'] }
}
// ⚠ keeps `gifts`: dropping it (11-16) re-armed the one-off bait gift, so every reload after any bag change handed out
// 10 more bait
const clone = (inv: Inv): Inv => ({ v: 1, slots: inv.slots.map(s => (s ? { ...s } : null)), ...(inv.gifts ? { gifts: [...inv.gifts] } : {}) })

export const countOf = (inv: Inv, id: string) => inv.slots.reduce((a, s) => a + (s?.id === id ? s.n : 0), 0)

/** Add n of an item: top up matching stacks (hotbar first), then empty slots. Returns the new inv and what did not fit. */
export function give(inv: Inv, id: string, n: number): { inv: Inv; left: number } {
  const out = clone(inv), max = itemDef(id).stack
  let left = n
  for (const s of out.slots) if (left > 0 && s?.id === id && s.n < max) { const t = Math.min(left, max - s.n); s.n += t; left -= t }
  for (let i = 0; i < SLOTS && left > 0; i++) if (!out.slots[i]) { const t = Math.min(left, max); out.slots[i] = { id, n: t }; left -= t }
  return { inv: out, left }
}
/** Take n of an item, from the bag first so the hotbar's stack lasts. Returns null when there is not enough. */
export function take(inv: Inv, id: string, n: number): Inv | null {
  if (countOf(inv, id) < n) return null
  const out = clone(inv)
  let need = n
  for (let i = SLOTS - 1; i >= 0 && need > 0; i--) {
    const s = out.slots[i]; if (s?.id !== id) continue
    const t = Math.min(need, s.n); s.n -= t; need -= t
    if (s.n === 0) out.slots[i] = null
  }
  return out
}
/** Cut ONE of `id` into bait (BAIT_FROM). Null when it is not bait food, the bag has none, or the bait would not fit. */
export function makeBait(inv: Inv, id: string): { inv: Inv; made: number } | null {
  const made = BAIT_FROM[id]; if (!made) return null
  const less = take(inv, id, 1); if (!less) return null
  const r = give(less, 'bait', made)
  return r.left > 0 ? null : { inv: r.inv, made }
}
/** Drop the stack at `from` onto `to`: merge into a matching stack (overflow stays behind), else swap. */
export function move(inv: Inv, from: number, to: number): Inv {
  if (from === to || !inv.slots[from]) return inv
  const out = clone(inv), a = out.slots[from]!, b = out.slots[to]
  if (b && b.id === a.id) {
    const max = itemDef(a.id).stack, t = Math.min(a.n, max - b.n)
    b.n += t; a.n -= t
    if (a.n === 0) out.slots[from] = null
  } else { out.slots[to] = a; out.slots[from] = b }
  return out
}
/** Split half a stack (rounded down) into the first empty slot of the same section, else any empty slot. */
export function split(inv: Inv, at: number): Inv {
  const s = inv.slots[at]; if (!s || s.n < 2) return inv
  const out = clone(inv), half = Math.floor(s.n / 2)
  const sameSection = at < HOTBAR ? [...Array(HOTBAR).keys()] : [...Array(BAG).keys()].map(k => k + HOTBAR)
  const to = [...sameSection, ...Array(SLOTS).keys()].find(i => !out.slots[i])
  if (to === undefined) return inv
  out.slots[at]!.n -= half; out.slots[to] = { id: s.id, n: half }
  return out
}
/** Shift-click: send a stack across, hotbar ↔ bag (merging first). Unchanged if there is no room. */
export function quickMove(inv: Inv, at: number): Inv {
  const s = inv.slots[at]; if (!s) return inv
  const range = at < HOTBAR ? [...Array(BAG).keys()].map(k => k + HOTBAR) : [...Array(HOTBAR).keys()]
  let out = clone(inv)
  for (const i of range) if (out.slots[i]?.id === s.id) { out = move(out, at, i); if (!out.slots[at]) return out }
  const empty = range.find(i => !out.slots[i])
  return empty === undefined ? out : move(out, at, empty)
}

export const INV_KEY = 'open.inv.v1'
/** Load the keeper's bag, or a fresh one. `waymarksLeft` seeds a fresh bag for a keeper who already planted some. */
export function loadInv(waymarksLeft = 12): Inv {
  try {
    const v = JSON.parse(localStorage.getItem(keeperKey(INV_KEY)) ?? 'null')
    if (v?.v === 1 && Array.isArray(v.slots) && v.slots.length === SLOTS) {
      // ★ tools are not bag items (Alex 11-15, the stance: "interacting with a node should just automatically use the right
      // tool"): they sit in the sockets round the mana orb (engine/tools.ts). A Worn Blade a bag got for an hour on 11-15
      // is taken back out here.
      let out: Inv = v.slots.some((x: Stack | null) => x?.id === 'worn_blade') ? { ...v, slots: v.slots.map((x: Stack | null) => (x?.id === 'worn_blade' ? null : x)) } : v
      // the bait floor shipped an hour as 'forage' before canon named it MAST (11-17): rename it in place
      if (out.slots.some((x: Stack | null) => x?.id === 'forage')) out = { ...out, slots: out.slots.map((x: Stack | null) => (x?.id === 'forage' ? { ...x, id: 'mast' } : x)) }
      // rinning arrived (11-15): an older bag is handed the starting bait once
      if (!(out.gifts ?? []).includes('bait1')) out = { ...give(out, 'bait', STARTING_BAIT).inv, gifts: [...(out.gifts ?? []), 'bait1'] }
      return out
    }
  } catch { /* private window */ }
  return newInv(waymarksLeft)
}
export function saveInv(inv: Inv) { try { localStorage.setItem(keeperKey(INV_KEY), JSON.stringify(inv)) } catch { /* private window */ } }
