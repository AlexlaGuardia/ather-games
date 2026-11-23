// ── THE SETTLEMENT SIDE OF MOGLIN RECRUITING (hub, 2026-11-17/18; split agreed with play, contract = moglins.ts) ────────────
// Canon (game/ather-rework-2026-11.md › THE GARDEN VILLAGE, RULED 11-15): each SEASON a settlement's Moglins are generated
// fresh; every Moglin has GRADES THAT NEVER CHANGE and a DREAM / PROFESSION; the keeper can talk to any of them; one with
// NO JOB in its settlement may come for the asking; one WITH a job wants the keeper to EARN ITS TRUST first ("a few hoops").
// The consent law stands: a Moglin chooses to come and can leave (that half is play's `farewell`).
// Jin's (build): how many live in a settlement, the grade odds, which trades a biome leans to, and THE HOOPS.
//
// ★ THE HOOP IS TRADE. A settlement's biome sets what its folk gather (network.ts › SETTLEMENT_GATHERS, Alex 11-17); what a
//   Moglin with a job asks of a keeper is what its settlement LACKS: goods from another biome's list. So trust is earned by
//   carrying the Wilds to each other, which is what a keeper with a garden is for, and the biome settlements pay off twice.
// ★ DETERMINISTIC: the same season + settlement gives the same folk on every device, so a want-list half-filled on the phone
//   is the same want-list on the desktop. Nothing here is stored except the keeper's progress (open.trust.v1, a garden key).
//
// Lines (dreams, the talk) are lark's: folk-lines.ts. Names are generated from a word pool, never a canon name.
import { gardenKey } from '@/lib/keeper-local'
import { SETTLEMENT_GATHERS, type Settlement, type SettlementBiome } from './network'
import { welcome, type MoglinRecord, type Profession, type Grade, type Village } from './moglins'
import { rngOf, rollSkills, SKILL_OF_ROOM, type Skills } from './moglin-skills'
import { DREAMS } from './folk-lines'
import { GLADE_ID, gladeFolk } from './moonwell-glade'

export const FOLK_MIN = 3, FOLK_MAX = 5
/** Odds a Moglin already has a job in its settlement (then it wants trust earned first). */
export const EMPLOYED_P = 0.6
/** Grade odds, 1 (fair) .. 5 (rare): most folk are fair-to-fine; a rare gift is worth the walk. */
export const GRADE_ODDS: readonly [Grade, number][] = [[1, 30], [2, 30], [3, 22], [4, 13], [5, 5]]
/** Which trades a biome's folk lean to (weights). Every trade can turn up anywhere; the biome only tilts the odds. */
export const BIOME_TRADES: Readonly<Record<SettlementBiome, Partial<Record<Profession, number>>>> = {
  shore:  { cook: 5, farmer: 2, carpenter: 1, stonemason: 1, alchemist: 2, smith: 1, jeweler: 1, rinnshop: 3 },   // the bait-maker leans to the water
  meadow: { farmer: 5, cook: 3, carpenter: 2, stonemason: 1, alchemist: 2, smith: 1, jeweler: 1, rinnshop: 1 },
  woods:  { carpenter: 5, farmer: 2, cook: 2, stonemason: 1, alchemist: 3, smith: 1, jeweler: 1, rinnshop: 1 },
  rock:   { stonemason: 4, jeweler: 3, smith: 3, alchemist: 2, carpenter: 1, farmer: 1, cook: 1, rinnshop: 1 },
}
/** Personal names (canon law: CANON/game/shimmer-folds-settlements.md › Names, RULED 09-18): the free folk are SOFT PLANTS
 *  (burrs and thorns are collarer names), drawn from canon's free-folk pool, and no two living speakers share a name. */
export const CANON_POOL = ['Cress', 'Dill', 'Chervil', 'Comfrey', 'Clover', 'Vervain', 'Lovage', 'Burnet', 'Betony', 'Woad', 'Flax',
  'Madder', 'Hyssop', 'Clary', 'Rue', 'Bracken', 'Thyme', 'Basil', 'Marjoram', 'Chive', 'Sprig', 'Cowslip', 'Primrose', 'Campion',
  'Alder', 'Rowan',
  // extended 26 -> 60 (athernyx 295f27f, Alex 11-18 "yes extend the name pool, adopt Jin's list"): covers a season (11 x up to 5)
  'Parsley', 'Tarragon', 'Angelica', 'Borage', 'Chamomile', 'Meadowsweet', 'Lavender', 'Daisy', 'Fern', 'Linden', 'Willow', 'Aster',
  'Bluebell', 'Speedwell', 'Valerian', 'Agrimony', 'Pennyroyal', 'Cicely', 'Celandine', 'Feverfew', 'Bergamot', 'Rosemary', 'Caraway',
  'Anise', 'Lilac', 'Poppy', 'Iris', 'Lupin', 'Heather', 'Myrtle', 'Laurel', 'Chicory', 'Marigold', 'Woodruff']
const NAMES = CANON_POOL
/** M108 s3 (hub 11-23): the DIGGER (canon trades table, Marl's trade) rolls on its OWN seeded stream per slot, so adding the
 *  trade did not reshuffle any other Moglin's season (their trades, dreams, wants are the same draws as before). A rock
 *  settlement leans to it. DIGGER_SURE = the first settlement on the opening path (Greg's shortest road, s1-10 Bryonydell):
 *  it always has one, so the cells' first charge (ship-repair.ts) never waits on a lucky roll. */
export const DIGGER_P: Readonly<Record<SettlementBiome, number>> = { shore: 0.08, meadow: 0.08, woods: 0.08, rock: 0.1 }
export const DIGGER_SURE: readonly string[] = ['s1-10']
export const CANON_NAMES = new Set(['hazel', 'saxifrage', 'sax', 'yarrow', 'fennel', 'mallow', 'burdock', 'vetch', 'sorrel', 'hemlock',
  'marl', 'teasel', 'sedge', 'brack', 'thistle', 'jimbo', 'marra', 'pell', 'wend', 'pertle', 'grust', 'vane', 'heslur', 'tansy', 'nettle', 'tuckbank', 'thistledown', 'downbarrow', 'snagbarrows', 'gorsejacks', 'cinchfist', 'greg', 'gregory'])

export interface Folk {
  id: string                      // `${season}:${settlement id}:${k}`: also the MoglinRecord id once recruited
  name: string; home: string; profession: Profession
  grades: MoglinRecord['grades']
  skills?: Skills; luck?: Grade   // M46 (absent on the glade's five: they migrate when recruited)
  dream: string
  employed: boolean
  /** the hoop: what it asks a keeper to bring before it trusts them (employed only; empty when it would come for the asking) */
  wants: { id: string; n: number }[]
}

function pick<T>(rnd: () => number, w: readonly [T, number][]): T {
  const total = w.reduce((a, [, x]) => a + x, 0); let r = rnd() * total
  for (const [v, x] of w) { if ((r -= x) < 0) return v }
  return w[w.length - 1][0]
}

/** the legacy craft/yield grades, read back off the skills so the old fields never disagree with the new */
const legacyGrades = (p: Profession, sk: Skills) => {
  const g: Partial<MoglinRecord['grades']> = {}
  const r = ({ farmer: 'farm', cook: 'cooking', carpenter: 'carpentry', stonemason: 'stonemason', alchemist: 'alchemy', smith: 'smith', jeweler: 'stonemason', rinnshop: 'rinnshop' } as const)[p as 'farmer']
  if (r) { g.craft = sk[SKILL_OF_ROOM[r].craft]; g.yield = sk[SKILL_OF_ROOM[r].yield] }
  return g
}
/** The Moglins living in a settlement this season. Same inputs, same folk, on every device. */
export function folkOf(s: Settlement, season: number): Folk[] {
  if (s.id === GLADE_ID) return gladeFolk()   // Moonwell Glade: the five, fixed, never re-rolled (moonwell-glade.ts, M30)
  const rnd = rngOf(`folk:${season}:${s.id}`)
  const biome: SettlementBiome = s.biome ?? 'meadow'
  const trades = Object.entries(BIOME_TRADES[biome]) as [Profession, number][]
  const others = (Object.keys(SETTLEMENT_GATHERS) as SettlementBiome[]).filter(b => b !== biome).flatMap(b => SETTLEMENT_GATHERS[b])
  const n = FOLK_MIN + Math.floor(rnd() * (FOLK_MAX - FOLK_MIN + 1))
  const out: Folk[] = []
  // One season-wide order of the pool; each settlement owns FOLK_MAX slots of it by its index (ids are `s<season>-<i>`), so no
  // two Moglins alive this season share a name across ALL settlements, not just within one (canon: two living speakers never do).
  const names = NAMES.filter(x => !CANON_NAMES.has(x.toLowerCase()))
  const order = names.map((_, i) => i), shuf = rngOf(`folk-names:${season}`)
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(shuf() * (i + 1)); [order[i], order[j]] = [order[j], order[i]] }
  const idx = Number(/-(\d+)$/.exec(s.id)?.[1] ?? 0)
  for (let k = 0; k < n; k++) {
    const name = names[order[(idx * FOLK_MAX + k) % order.length]]
    const drawnTrade = pick(rnd, trades)
    const profession: Profession = rngOf(`digger:${season}:${s.id}:${k}`)() < DIGGER_P[biome] ? 'digger' : drawnTrade
    const drawn = { craft: pick(rnd, GRADE_ODDS), yield: pick(rnd, GRADE_ODDS), trade: pick(rnd, GRADE_ODDS) }   // kept so the season's other rolls do not shift
    const { skills, luck } = rollSkills(profession, rngOf(`skills:${season}:${s.id}:${k}`))   // M46: its own seeded stream
    const grades = { ...drawn, ...legacyGrades(profession, skills) }
    const pool = DREAMS[profession]
    const dream = pool[Math.floor(rnd() * pool.length)]
    const employed = rnd() < EMPLOYED_P
    const wants: Folk['wants'] = []
    if (employed) {
      const asks = 1 + Math.floor(rnd() * 2)   // one or two goods
      for (let a = 0; a < asks && others.length; a++) {
        let id = others[Math.floor(rnd() * others.length)]
        if (wants.some(w => w.id === id)) id = others.find(o => !wants.some(w => w.id === o)) ?? id
        if (!wants.some(w => w.id === id)) wants.push({ id, n: 3 + Math.floor(rnd() * 4) })
      }
    }
    out.push({ id: `${season}:${s.id}:${k}`, name, home: s.id, profession, grades, dream, employed, wants, skills, luck })
  }
  if (DIGGER_SURE.includes(s.id) && out.length && !out.some(f => f.profession === 'digger')) {   // the guaranteed one: the LAST slot
    const k = out.length - 1, f = out[k], { skills, luck } = rollSkills('digger', rngOf(`skills:${season}:${s.id}:${k}:digger`))
    out[k] = { ...f, profession: 'digger', skills, luck, grades: { ...f.grades, ...legacyGrades('digger', skills) }, dream: DREAMS.digger[0] }
  }
  return out
}

// ── the keeper's progress on each hoop: a garden key, so a want-list half-filled on one device is the same on the other ──
export const TRUST_KEY = 'open.trust.v1'
export interface Trust { v: 1; given: Record<string, Record<string, number>> }   // folk id -> item id -> how many brought
export const freshTrust = (): Trust => ({ v: 1, given: {} })
export function loadTrust(): Trust {
  try { const t = JSON.parse(localStorage.getItem(gardenKey(TRUST_KEY)) ?? 'null'); if (t && t.v === 1 && t.given && typeof t.given === 'object') return t } catch { /* private */ }
  return freshTrust()
}
export function saveTrust(t: Trust) { try { localStorage.setItem(gardenKey(TRUST_KEY), JSON.stringify(t)) } catch { /* private window */ } }

/** What is still wanted (n left per item); empty = trusted. */
export function wantsLeft(f: Folk, t: Trust): { id: string; n: number }[] {
  const g = t.given[f.id] ?? {}
  return f.wants.map(w => ({ id: w.id, n: Math.max(0, w.n - (g[w.id] ?? 0)) })).filter(w => w.n > 0)
}
export const trusted = (f: Folk, t: Trust) => !f.employed || wantsLeft(f, t).length === 0
/** Record goods handed over (the caller has already taken them from the bag). Never counts past the ask. */
export function bring(t: Trust, f: Folk, id: string, n: number): { trust: Trust; used: number } {
  const want = f.wants.find(w => w.id === id); if (!want) return { trust: t, used: 0 }
  const have = t.given[f.id]?.[id] ?? 0, used = Math.max(0, Math.min(n, want.n - have))
  if (!used) return { trust: t, used: 0 }
  return { trust: { ...t, given: { ...t.given, [f.id]: { ...(t.given[f.id] ?? {}), [id]: have + used } } }, used }
}

/** The recruit step: a trusted Moglin comes to the garden (play's welcome: the cap, no repeats). Null when it cannot. */
export function recruit(v: Village, f: Folk, t: Trust, stage = 0, now = Date.now(), homeName?: string): Village | null {
  if (!trusted(f, t)) return null
  const rec: MoglinRecord = { id: f.id, name: f.name, home: f.home, ...(homeName ? { homeName } : {}), grades: f.grades, ...(f.skills ? { skills: f.skills, luck: f.luck } : {}), dream: f.dream, profession: f.profession, recruitedAt: now }
  return welcome(v, rec, stage)
}
/** The folk still living in a settlement: anyone already in the keeper's village has moved out. */
export const stillHome = (folk: Folk[], v: Village) => folk.filter(f => !v.moglins.some(m => m.id === f.id) && !(v.parted ?? []).includes(f.id))   // a parted Moglin went home to kin, off the map (Magii 559213d)
