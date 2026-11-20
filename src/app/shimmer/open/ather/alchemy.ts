// THE ALCHEMY ROOM'S CAULDRON (2026-11-17, play / Jin 30bbef32). Pure data, like cooking.ts: inventory.ts reads it to make
// the bag rows, so this file imports types only.
//
// Canon: the three fires (world/cuisine.md › THE ATHER HEARTH): the CAULDRON BOILS a brew, the oven bakes, the hearth roasts.
// The potions, their names and recipes are canon's own (engine/alchemy.ts › POTION_DEFS, the shared table play3d + voxel
// brew from). The open world brews the ones it can reach: every input below is a bag row the Wilds already give.
//   · SHARD TONIC   — mana back at once (engine/potion-effects.ts › MANA_POTIONS: 65).
//   · STARLIGHT TINCTURE — Starlight: gathering XP ×1.5 for 8 min (BUFF_DEFS.starlight, STARLIGHT_XP).
//   · ATHER INFUSION — Ather Flow: mana regen lifted for 10 min (BUFF_DEFS.ather_flow).
// ★ WHY ATHER FLOW IS ×2 HERE, NOT THE ENGINE'S ×10: ATHER_REGEN was tuned against play3d's 1 mana a MINUTE ("a felt trickle").
//   The open world refills 1.5 a SECOND (page.tsx manaRef); ×10 would be 15/s, a bar every seven seconds, which deletes mana as
//   a cost. ×2 is felt (a full bar in ~33 s instead of ~67 s) and keeps casts a choice. Open-world tuning, not a canon fact.
// ★ The names, recipes and the instant/buff numbers MIRROR the engine table on purpose (inventory.ts must not import the
//   engine: it pulls spirits + skills into every bag), and alchemy.test.ts pins each one against POTION_DEFS / potion-effects
//   so the copy cannot drift silently (PATTERNS: never trust a hand-kept mirror; make it a checked one).
import type { Job } from './furniture'
import { keeperKey } from '@/lib/keeper-local'
import { isAlcPotion, effectOf, alcName } from './alchemy-set'

export type BuffId = 'starlight' | 'ather_flow' | 'wisdom'
export interface PotionRow {
  name: string
  blurb: string
  recipe: readonly { id: string; n: number }[]
  /** how many one brew pours */
  makes: number
  /** instant mana */
  mana?: number
  /** a timed buff */
  buff?: { id: Exclude<BuffId, 'wisdom'>; ms: number }   // the engine's buffs (BUFF_DEFS); Wisdom is the alchemy set's own
}
export const STARLIGHT_XP = 1.5
/** M57: the alchemy set's XP potion (alchemy-set.ts › wisdom): +25%, its grade sets how long */
export const WISDOM_XP = 1.25
export const OPEN_FLOW_MULT = 2
export const POTIONS: Readonly<Record<string, PotionRow>> = {
  shard_tonic: {
    name: 'Shard Tonic', blurb: 'Mana shards boiled down with goldwood bark. Hold it and click to drink. Restores 65 mana.',
    recipe: [{ id: 'raw_mana_shard', n: 3 }, { id: 'goldwood_bark', n: 2 }], makes: 1, mana: 65,
  },
  starlight_tincture: {
    name: 'Starlight Tincture', blurb: 'Starwillow sap, mana cores and glowfin, boiled together. Hold it and click to drink. Gathering teaches you half again as much for 8 minutes.',
    recipe: [{ id: 'starwillow_sap', n: 3 }, { id: 'pure_mana_core', n: 2 }, { id: 'glowfin', n: 2 }], makes: 1, buff: { id: 'starlight', ms: 8 * 60_000 },
  },
  ather_infusion: {
    name: 'Ather Infusion', blurb: 'An Ather crystal steeped in old sap. Drink it and your mana comes back twice as fast, for 10 minutes.',
    recipe: [{ id: 'ather_crystal', n: 1 }, { id: 'crystallized_sap', n: 2 }, { id: 'pure_mana_core', n: 3 }], makes: 1, buff: { id: 'ather_flow', ms: 10 * 60_000 },
  },
}
export const BUFF_NAME: Readonly<Record<BuffId, string>> = { starlight: 'Starlight', ather_flow: 'Ather Flow', wisdom: 'Wisdom' }
export const isPotion = (id: string | null | undefined): id is string => !!id && (id in POTIONS || isAlcPotion(id))

/** The cauldron's jobs, in the order a keeper reaches them. */
export const BREW: readonly Job[] = Object.entries(POTIONS).map(([id, p]) => ({ id: `brew-${id}`, label: 'Brew', in: p.recipe, out: { id, n: p.makes } }))

// ── buffs: an `until` per buff (ms since epoch), saved per keeper (open.buffs.v1, keeper-key-specs) ─────────────────
export type Buffs = Partial<Record<BuffId, number>>
export const buffLeft = (b: Buffs, id: BuffId, now = Date.now()) => Math.max(0, (b[id] ?? 0) - now)
export const buffOn = (b: Buffs, id: BuffId, now = Date.now()) => buffLeft(b, id, now) > 0
/** Drinking a buff potion sets its clock to a fresh span; a second bottle refreshes, it never stacks. */
export const withBuff = (b: Buffs, id: BuffId, ms: number, now = Date.now()): Buffs => ({ ...b, [id]: now + ms })

export type Drink = { ok: true; mana?: number; heal?: number; buffs: Buffs; line: string } | { ok: false; why: string }
/** What drinking `id` does now. Refuses a tonic at a full bar (it would be wasted). The page spends the bottle on ok. */
export function drink(id: string, mana: { cur: number; max: number }, buffs: Buffs, now = Date.now()): Drink {
  if (isAlcPotion(id)) {   // M57: a graded bottle from the alchemy set; its grade is already in the numbers (effectOf)
    const e = effectOf(id)!, name = alcName(id)!
    if ('mana' in e) {
      if (mana.cur >= mana.max - 0.5) return { ok: false, why: 'Your mana is full. Keep it for a cast.' }
      return { ok: true, mana: Math.min(mana.max, mana.cur + e.mana), buffs, line: `${name} · +${Math.round(Math.min(e.mana, mana.max - mana.cur))} mana` }
    }
    if ('heal' in e) return { ok: true, heal: e.heal, buffs, line: `${name} · +${e.heal}` }   // the page checks the Wilds + health first
    return { ok: true, buffs: withBuff(buffs, 'wisdom', e.ms, now), line: `${name} · Wisdom for ${Math.round(e.ms / 60_000)} min` }
  }
  const p = POTIONS[id]
  if (!p) return { ok: false, why: '' }
  if (p.mana) {
    if (mana.cur >= mana.max - 0.5) return { ok: false, why: 'Your mana is full. Keep it for a cast.' }
    return { ok: true, mana: Math.min(mana.max, mana.cur + p.mana), buffs, line: `${p.name} · +${Math.round(Math.min(p.mana, mana.max - mana.cur))} mana` }
  }
  if (p.buff) return { ok: true, buffs: withBuff(buffs, p.buff.id, p.buff.ms, now), line: `${p.name} · ${BUFF_NAME[p.buff.id]} for ${Math.round(p.buff.ms / 60_000)} min` }
  return { ok: false, why: '' }
}

export const BUFFS_KEY = 'open.buffs.v1'
export function loadBuffs(now = Date.now()): Buffs {
  try {
    const v = JSON.parse(localStorage.getItem(keeperKey(BUFFS_KEY)) ?? 'null'), out: Buffs = {}
    if (v && typeof v === 'object') for (const k of Object.keys(BUFF_NAME) as BuffId[]) if (Number.isFinite(v[k]) && v[k] > now) out[k] = v[k]
    return out
  } catch { return {} }
}
export function saveBuffs(b: Buffs) { try { localStorage.setItem(keeperKey(BUFFS_KEY), JSON.stringify(b)) } catch { /* private window */ } }
