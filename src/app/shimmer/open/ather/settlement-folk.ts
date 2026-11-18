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
import { DREAMS } from './folk-lines'

export const FOLK_MIN = 3, FOLK_MAX = 5
/** Odds a Moglin already has a job in its settlement (then it wants trust earned first). */
export const EMPLOYED_P = 0.6
/** Grade odds, 1 (fair) .. 5 (rare): most folk are fair-to-fine; a rare gift is worth the walk. */
export const GRADE_ODDS: readonly [Grade, number][] = [[1, 30], [2, 30], [3, 22], [4, 13], [5, 5]]
/** Which trades a biome's folk lean to (weights). Every trade can turn up anywhere; the biome only tilts the odds. */
export const BIOME_TRADES: Readonly<Record<SettlementBiome, Partial<Record<Profession, number>>>> = {
  shore:  { cook: 5, farmer: 2, carpenter: 1, stonemason: 1, alchemist: 2, smith: 1, jeweler: 1 },
  meadow: { farmer: 5, cook: 3, carpenter: 2, stonemason: 1, alchemist: 2, smith: 1, jeweler: 1 },
  woods:  { carpenter: 5, farmer: 2, cook: 2, stonemason: 1, alchemist: 3, smith: 1, jeweler: 1 },
  rock:   { stonemason: 4, jeweler: 3, smith: 3, alchemist: 2, carpenter: 1, farmer: 1, cook: 1 },
}
/** Personal names: plant, earth and craft words. Filtered against canon's named Moglins and places (glossary). */
const NAMES = ['Loam', 'Heath', 'Furrow', 'Pebble', 'Briar', 'Rowan', 'Thatch', 'Wicker', 'Spindle', 'Bracken', 'Clove', 'Quill',
  'Tumble', 'Burl', 'Knot', 'Chert', 'Flint', 'Shale', 'Pumice', 'Ochre', 'Umber', 'Sumac', 'Lupin', 'Cobnut', 'Acorn', 'Tallow',
  'Bobbin', 'Ember', 'Hob', 'Peat', 'Rush', 'Withy', 'Hazelnut', 'Dock', 'Sloe', 'Tinder', 'Gravel', 'Mica', 'Basil', 'Pippin']
export const CANON_NAMES = new Set(['hazel', 'saxifrage', 'sax', 'yarrow', 'fennel', 'mallow', 'burdock', 'vetch', 'sorrel', 'hemlock',
  'marl', 'teasel', 'sedge', 'nettle', 'tuckbank', 'thistledown', 'downbarrow', 'snagbarrows', 'gorsejacks', 'cinchfist', 'greg', 'gregory'])

export interface Folk {
  id: string                      // `${season}:${settlement id}:${k}`: also the MoglinRecord id once recruited
  name: string; home: string; profession: Profession
  grades: MoglinRecord['grades']
  dream: string
  employed: boolean
  /** the hoop: what it asks a keeper to bring before it trusts them (employed only; empty when it would come for the asking) */
  wants: { id: string; n: number }[]
}

function rngOf(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  let s = h >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}
function pick<T>(rnd: () => number, w: readonly [T, number][]): T {
  const total = w.reduce((a, [, x]) => a + x, 0); let r = rnd() * total
  for (const [v, x] of w) { if ((r -= x) < 0) return v }
  return w[w.length - 1][0]
}

/** The Moglins living in a settlement this season. Same inputs, same folk, on every device. */
export function folkOf(s: Settlement, season: number): Folk[] {
  const rnd = rngOf(`folk:${season}:${s.id}`)
  const biome: SettlementBiome = s.biome ?? 'meadow'
  const trades = Object.entries(BIOME_TRADES[biome]) as [Profession, number][]
  const others = (Object.keys(SETTLEMENT_GATHERS) as SettlementBiome[]).filter(b => b !== biome).flatMap(b => SETTLEMENT_GATHERS[b])
  const n = FOLK_MIN + Math.floor(rnd() * (FOLK_MAX - FOLK_MIN + 1))
  const used = new Set<string>(), out: Folk[] = []
  const names = NAMES.filter(x => !CANON_NAMES.has(x.toLowerCase()))
  for (let k = 0; k < n; k++) {
    let name = names[Math.floor(rnd() * names.length)]
    for (let tries = 0; used.has(name) && tries < names.length; tries++) name = names[(names.indexOf(name) + 1) % names.length]
    used.add(name)
    const profession = pick(rnd, trades)
    const grades = { craft: pick(rnd, GRADE_ODDS), yield: pick(rnd, GRADE_ODDS), trade: pick(rnd, GRADE_ODDS) }
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
    out.push({ id: `${season}:${s.id}:${k}`, name, home: s.id, profession, grades, dream, employed, wants })
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
export function recruit(v: Village, f: Folk, t: Trust, stage = 0, now = Date.now()): Village | null {
  if (!trusted(f, t)) return null
  const rec: MoglinRecord = { id: f.id, name: f.name, home: f.home, grades: f.grades, dream: f.dream, profession: f.profession, recruitedAt: now }
  return welcome(v, rec, stage)
}
/** The folk still living in a settlement: anyone already in the keeper's village has moved out. */
export const stillHome = (folk: Folk[], v: Village) => folk.filter(f => !v.moglins.some(m => m.id === f.id))
