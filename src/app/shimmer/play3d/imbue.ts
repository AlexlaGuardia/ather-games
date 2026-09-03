/**
 * imbue.ts — BINDING A GEM FROM A CRYSTAL: the in-world road to a letter, and it needs no shop.
 *
 * Canon (`shimmer-skilling.md` § THE CASTING VESSELS, RULED 2026-09-03): a rune-gem is *"found, bought,
 * or BOUND FROM A RUNE YOU KNOW. Quality = the prospecting ladder"* (Raw Mana Shard → Element Crystal →
 * Pure Mana Core → Ather Crystal). The 08-22 ruling named the act: ENCHANT, *"Mana bound to objects…
 * permanent enchantments."* And the ladder is ALREADY IN THE GROUND — the ore seams drop every rung
 * (`voxel/registry.ts`: `raw_mana_shard`, the four `*_crystal`s, `pure_mana_core`, `ather_crystal`).
 *
 * So: a keeper who HOLDS a rune (identity — born or trained, never bought) and digs an ELEMENT CRYSTAL
 * of that rune's element can imbue the crystal with the rune and carry the result as a gem. One crystal,
 * one letter. Nothing is bought; the Passage is the OTHER road (a rune you do not know, off-lane gems).
 *
 * ── JIN'S CALLS ──
 *   · the element crystal is the ONLY rung that imbues today; every gem is one letter of one rune.
 *     Quality (core → stronger letter) is the ladder's promise and is not modelled yet — say so, do not fake it
 *   · a raw shard is too crude to hold a rune; a core is more than a letter needs. Neither imbues (yet)
 *   · no mana cost, no station, no delay: imbuing is a bag act. A cozy game does not tax the first gem
 *
 * ── VOCABULARY ── ✅ imbue / bind / set · gem · crystal. ⛔ forge (the Cairn's word), socket, sigil, slot.
 */
import { countItem, removeItems, type Inventory } from '../engine/inventory'
import { RUNES } from './birth/runes.data'
import { addGems, type Letters } from './gems'

/** the element crystal that carries each element's runes — the seam drops in `voxel/registry.ts` */
export const ELEMENT_CRYSTAL: Record<string, string> = {
  mana: 'violet_crystal', storm: 'storm_crystal', earth: 'earth_crystal', water: 'water_crystal',
}

export function crystalFor(runeId: string): string | null {
  const r = RUNES.find((x) => x.id === runeId)
  return r ? (ELEMENT_CRYSTAL[r.element] ?? null) : null
}

export type ImbueRefusal = 'unknown-rune' | 'not-held' | 'no-crystal'

/** Why this keeper cannot imbue a gem of `runeId` right now — or null when they can. */
export function imbueWhy(inv: Inventory, owned: readonly string[], runeId: string): ImbueRefusal | null {
  const crystal = crystalFor(runeId)
  if (!crystal) return 'unknown-rune'
  if (!owned.includes(runeId)) return 'not-held'          // identity: you imbue what you ARE, never what you read about
  if (countItem(inv, crystal) < 1) return 'no-crystal'
  return null
}

export function imbueSentence(why: ImbueRefusal, runeId: string): string {
  const name = RUNES.find((r) => r.id === runeId)?.name ?? runeId
  const crystal = crystalFor(runeId)?.replace(/_/g, ' ') ?? 'a crystal'
  switch (why) {
    case 'unknown-rune': return `no such rune: ${runeId}`
    case 'not-held': return `${name} is not a rune you hold — a gem is bound from a rune you know`
    case 'no-crystal': return `no ${crystal} to bind ${name} into — dig its seam`
  }
}

/**
 * Imbue: take ONE element crystal from the bag and put ONE gem of `runeId` in the letters. Mutates the
 * item inventory in place (the world's own contract for `inv.current`); returns the new letters, or
 * null with the reason when refused. Nothing is taken on a refusal.
 */
export function imbue(inv: Inventory, letters: Letters, owned: readonly string[], runeId: string): { letters: Letters; why: ImbueRefusal | null } {
  const why = imbueWhy(inv, owned, runeId)
  if (why) return { letters, why }
  const crystal = crystalFor(runeId)!
  if (!removeItems(inv, crystal, 1)) return { letters, why: 'no-crystal' }
  return { letters: addGems(letters, runeId, 1), why: null }
}
