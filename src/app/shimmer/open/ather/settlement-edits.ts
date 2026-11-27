// ── BETA M237 s1: SETTLEMENTS IN THE WORLD BUILDER (Alex 11-27: "place a new settlement or drag an existing one.. a panel with
// DROPDOWNS sets its trade focus, home count, an event tent"). The season's settlements are BAKED (scripts/bake-wilds-network.mts
// -> public/open/wilds/network-s<N>.json); the owner's hand edits are an OWNER LAYER, the `settlements` list of the Wilds World
// Builder layer (world/builder.ts: draft -> Publish -> world/wilds-edits.json), applied ON TOP of the baked file by id, so a
// re-bake keeps them (an edit whose baked id is gone is ignored; an ADDED settlement has its own id form and always stands).
// Canon (Magii d2e2dca): an authored layer is the author's tool, not a canon change; the tent is the Thistledown troupe's,
// never a town's, so the EVENT TENT here means "the Fair pitches beside it this season" (stored now, pitched in s2).
// s1 limits (s3 lifted both: settlement-routes.ts routes a spur + levels new pads at load): a moved or added settlement kept no path and lost its baked lot pads (its flat disc
// still levels the ground under it).
//
// ★ PURE (no fetch, no React): settlement-edits.test.ts drives it. Imports only TYPES from network.ts (network.ts imports this).
import type { Network, Settlement, SettlementBiome, Contest, ClashLevel } from './network'

/** the trade focus options = SETTLEMENT_GATHERS' biomes (a test holds them equal) */
export const FOCUS_BIOMES: readonly SettlementBiome[] = ['shore', 'meadow', 'woods', 'rock']
/** the event tent's contest + Clash level options (= network.ts CONTESTS / ClashLevel; a test holds them equal) */
export const TENT_CONTESTS: readonly Contest[] = ['clash', 'dash', 'smash']
export const CLASH_LEVELS: readonly ClashLevel[] = ['easy', 'average', 'difficult']
/** home count = lots, at most settlement-lots MAX_LOTS (a test holds them equal) */
export const HOMES_MAX = 5
export interface TentPick { contest: Contest; level?: ClashLevel }
/** One settlement's hand edit. A BAKED id (`s<season>-<i>`) edits that settlement; an ADDED id (`s<season>-x-<n>`) is a new
 *  one (needs x, z; its name rides here). Absent fields keep the bake's value. */
export interface SettlementEdit {
  id: string
  name?: string
  x?: number; z?: number
  focus?: SettlementBiome
  homes?: number
  tent?: TentPick
  removed?: true
}
export type SettlementEdits = SettlementEdit[]

export const BAKED_ID = /^s\d+-\d+$/
/** an added settlement's id: still ends in `-<n>`, so settlement-folk's name slots read its index (n >= the bake's count) */
export const ADDED_ID = /^s\d+-x-\d+$/
export const isAddedId = (id: string) => ADDED_ID.test(id)
export const EDITS_MAX = 64
const COORD_MAX = 20000
const NAME_OK = /^[A-Za-z][A-Za-z' -]{1,31}$/

/** junk-proof, off the wire (route + loader): reads `j.settlements`; bad entries dropped, last entry per id wins */
export function cleanSettlementEdits(j: unknown): SettlementEdits {
  const raw = (j as { settlements?: unknown } | null)?.settlements
  if (!Array.isArray(raw)) return []
  const by = new Map<string, SettlementEdit>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>, id = o.id
    if (typeof id !== 'string' || !(BAKED_ID.test(id) || ADDED_ID.test(id))) continue
    const e: SettlementEdit = { id }
    const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= COORD_MAX
    if (num(o.x) && num(o.z)) { e.x = Math.round(o.x as number); e.z = Math.round(o.z as number) }
    if (typeof o.focus === 'string' && (FOCUS_BIOMES as readonly string[]).includes(o.focus)) e.focus = o.focus as SettlementBiome
    if (Number.isInteger(o.homes) && (o.homes as number) >= 0 && (o.homes as number) <= HOMES_MAX) e.homes = o.homes as number
    const t = o.tent as Record<string, unknown> | null | undefined
    if (t && typeof t === 'object' && typeof t.contest === 'string' && (TENT_CONTESTS as readonly string[]).includes(t.contest)) {
      e.tent = { contest: t.contest as Contest }
      if (t.contest === 'clash') e.tent.level = typeof t.level === 'string' && (CLASH_LEVELS as readonly string[]).includes(t.level) ? t.level as ClashLevel : 'easy'
    }
    if (o.removed === true) e.removed = true
    if (isAddedId(id)) {
      if (e.removed || e.x === undefined) continue   // an added one with no spot (or taken out) is simply not there
      e.name = typeof o.name === 'string' && NAME_OK.test(o.name) ? o.name : id
    }
    by.delete(id); by.set(id, e)
  }
  return [...by.values()].slice(-EDITS_MAX)
}

/** order-independent fingerprint (builder.ts sameLayer) */
export function settlementEditsCanon(e: SettlementEdits | undefined): string {
  return JSON.stringify([...(e ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(s => [s.id, s.name ?? null, s.x ?? null, s.z ?? null, s.focus ?? null, s.homes ?? null, s.tent?.contest ?? null, s.tent?.level ?? null, s.removed ?? false]))
}

/** what an edited settlement carries beyond the bake: its home count and the Fair's tent beside it (s2 reads both) */
export interface EditedSettlement extends Settlement { homes?: number; tent?: TentPick; bakedBiome?: SettlementBiome; moved?: boolean; added?: boolean }

function edited(s: Settlement, e: SettlementEdit): EditedSettlement {
  const r: EditedSettlement = { ...s }
  if (e.x !== undefined && e.z !== undefined && (e.x !== s.x || e.z !== s.z)) { r.x = e.x; r.z = e.z; r.moved = true; delete r.pads }   // its baked pads stood at the old spot
  if (e.focus) { r.bakedBiome = s.biome; r.biome = e.focus }   // the trade focus overrides the biome default (folk trades, gathers, stall)
  if (e.homes !== undefined) r.homes = e.homes
  if (e.tent) r.tent = { ...e.tent }
  return r
}
/** THE MERGE: the baked network with the owner's settlement edits on top. No edits = the very same object. */
export function applySettlementEdits(n: Network, edits: SettlementEdits | null | undefined): Network {
  if (!edits?.length) return n
  const by = new Map(edits.map(e => [e.id, e]))
  const out: Settlement[] = []
  for (const s of n.settlements) {
    const e = by.get(s.id)
    if (!e) { out.push(s); continue }
    if (e.removed) continue
    out.push(edited(s, e))
  }
  for (const e of edits) {
    if (!isAddedId(e.id) || e.removed || e.x === undefined || e.z === undefined || out.some(s => s.id === e.id)) continue
    out.push(<EditedSettlement>{ ...edited({ id: e.id, name: e.name ?? e.id, x: e.x, z: e.z, biome: e.focus ?? 'meadow' }, { ...e, x: undefined, z: undefined }), added: true })
  }
  return { ...n, settlements: out }
}

// ── the editor's moves (pure: return a NEW list) ──
/** set fields on one settlement's edit (made if absent); `undefined` in the patch clears that field */
export function patchEdit(edits: SettlementEdits, id: string, patch: Partial<Omit<SettlementEdit, 'id'>>): SettlementEdits {
  const cur = edits.find(e => e.id === id) ?? { id }
  const next: SettlementEdit = { ...cur }
  for (const [k, v] of Object.entries(patch)) { if (v === undefined) delete (next as unknown as Record<string, unknown>)[k]; else (next as unknown as Record<string, unknown>)[k] = v }
  const bare = Object.keys(next).length === 1
  const rest = edits.filter(e => e.id !== id)
  return bare ? rest : [...rest, next]
}
/** the next added id this season: n past every baked index and every added one */
export function nextAddedId(edits: SettlementEdits, base: Network): string {
  let n = 0
  for (const s of base.settlements) { const m = /-(\d+)$/.exec(s.id); if (m) n = Math.max(n, +m[1] + 1) }
  for (const e of edits) { const m = /-(\d+)$/.exec(e.id); if (m && isAddedId(e.id)) n = Math.max(n, +m[1] + 1) }
  return `s${base.season}-x-${n}`
}
// names: the bake's own generator pool (scripts/bake-wilds-network.mts HEADS x TAILS, never a canon name)
const HEADS = ['Bramble', 'Furze', 'Cress', 'Clover', 'Burnet', 'Sloe', 'Woad', 'Madder', 'Tansy', 'Rush', 'Fern', 'Moss', 'Bryony', 'Campion', 'Plantain', 'Dock', 'Sweetbriar', 'Hawthorn', 'Elder', 'Betony', 'Comfrey', 'Lovage', 'Rue', 'Agrimony']
const TAILS = ['dell', 'holt', 'bank', 'hollow', 'burrow', 'mead', 'combe', 'knoll', 'delve', 'brake', 'hythe', 'warth']
const CANON = ['hazel', 'saxifrage', 'yarrow', 'fennel', 'mallow', 'burdock', 'vetch', 'sorrel', 'hemlock', 'nettle', 'marl', 'teasel', 'sedge', 'tuckbank', 'thistledown', 'downbarrow', 'snagbarrows', 'moonwell', 'gloview', 'warren']
export const SETTLEMENT_NAME_POOL = { HEADS, TAILS, CANON } as const
/** a generated name no settlement of the merged network already has (seeded by the id, so the same add names the same) */
export function addedName(id: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  let h = 2166136261; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  const all = HEADS.length * TAILS.length
  for (let k = 0; k < all; k++) {
    const q = (h + k * 7919) % all, n = HEADS[Math.floor(q / TAILS.length)] + TAILS[q % TAILS.length]
    if (!used.has(n) && !CANON.some(c => n.toLowerCase().includes(c))) return n
  }
  return id
}
/** ADD one at (x, z): an added id + a pool name, meadow focus by default (the panel changes it) */
export function addSettlementEdit(edits: SettlementEdits, base: Network, x: number, z: number): { edits: SettlementEdits; id: string } {
  const id = nextAddedId(edits, base), merged = applySettlementEdits(base, edits)
  const e: SettlementEdit = { id, name: addedName(id, merged.settlements.map(s => s.name)), x: Math.round(x), z: Math.round(z), focus: 'meadow' }
  return { edits: [...edits, e], id }
}
/** MOVE one to (x, z) */
export const moveSettlementEdit = (edits: SettlementEdits, id: string, x: number, z: number) => patchEdit(edits, id, { x: Math.round(x), z: Math.round(z) })
/** REMOVE one: an added one's entry goes; a baked one is marked removed (its other edits are kept for a restore) */
export function removeSettlementEdit(edits: SettlementEdits, id: string): SettlementEdits {
  return isAddedId(id) ? edits.filter(e => e.id !== id) : patchEdit(edits, id, { removed: true })
}
/** the baked settlements the owner removed (the panel offers them back) */
export const removedIds = (edits: SettlementEdits) => edits.filter(e => e.removed && !isAddedId(e.id)).map(e => e.id)
