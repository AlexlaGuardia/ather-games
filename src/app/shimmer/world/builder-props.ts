// ── BETA M153 s1a: PLACED SCENERY IN THE WORLD BUILDER'S LAYER (docs/m153-place-mode.md) ──
// The layer's one new list, `props`: what the owner placed in Fly's Place mode (draft, versions, live: the same store as the terrain).
// Absent when empty, so a layer without it stays byte-identical. A prop has no height of its own: it stands on the ground under it
// (drawn and walked: open/ather/scenery.ts), so it follows every terrain edit.
// PURE, no imports (the save-builder route reads this on the server): a kind is checked by SHAPE here; what it draws, its size and
// whether it blocks is scenery.ts's palette, and a kind the palette does not know is simply never drawn. builder-props.test.ts.

/** x, z = world metres; q = turn in quarter turns (the rest of the builder's unit); s = scale; solid = the owner's toggle (absent =
 *  the kind's own answer) */
export interface Prop { id: string; k: string; x: number; z: number; q: number; s: number; solid?: boolean; /** s1b, a node only: hours till it grows back; absent = NODE_WAIT_H */ w?: number; /** s1c-1, the newborn spot only: the owner turned it (absent = facing Greg) */ turned?: boolean }

// ── s1b: TUTORIAL NODES are pieces too (`node:<tree or crystal kind>`; the game's half is open/ather/glade-nodes.ts): always true size,
//    no toggle. Ids are `n` + the time it was placed, never used again (a keeper's timer hangs on it); pieces count up from `p1`.
export const NODE_PREFIX = 'node:'
export const isNode = (p: Pick<Prop, 'k'>) => p.k.startsWith(NODE_PREFIX)
export const NODE_WAIT_H = 24, WAIT_MIN_H = 1, WAIT_MAX_H = 168
/** N walks these (hours, real) */
export const NODE_WAITS = [1, 2, 4, 8, 12, 24, 48, 72, 168] as const
export const nodeWaitH = (p: Pick<Prop, 'w'>) => p.w ?? NODE_WAIT_H

// ── s1c-1: PEOPLE AND THE NEWBORN SPOT are pieces too (`who:<id>`): one each, with a fixed id (`w<id>`), so a list never holds two and
//    none is ever deleted: without its piece a person simply stands where the code puts them (open/ather/glade-people.ts). x, z, q only;
//    the newborn spot also has `turned`, the owner's own turn (absent = it faces Greg).
export const WHO_PREFIX = 'who:'
export const WHO = ['greg', 'otto', 'tess', 'bonn', 'fennel', 'sax', 'yarrow', 'mallow', 'hazel', 'newborn'] as const
export type Who = (typeof WHO)[number]
export const isWho = (p: Pick<Prop, 'k'>) => p.k.startsWith(WHO_PREFIX)
export const whoOf = (k: string): Who | null => { const w = k.slice(WHO_PREFIX.length) as Who; return k.startsWith(WHO_PREFIX) && WHO.includes(w) ? w : null }
export const whoId = (w: Who) => `w${w}`
/** a figure's yaw (radians, the model faces +z) and the builder's quarter turns */
export const yawOfQ = (q: number) => -q * Math.PI / 2
export const qOfYaw = (yaw: number) => wrapQ(-yaw * 2 / Math.PI)
/** the list with this person standing there (the one piece they have, added or replaced) */
export function putWho(ps: readonly Prop[], w: Who, at: { x: number; z: number; q: number; turned?: boolean }): Prop[] {
  const c = cleanProp({ id: whoId(w), k: WHO_PREFIX + w, ...at, s: 1 })
  return c ? [...ps.filter(p => p.id !== c.id), c] : [...ps]
}
/** the pieces the cap counts: people are extra */
export const pieceCount = (ps: readonly Prop[]) => ps.reduce((n, p) => n + (isWho(p) ? 0 : 1), 0)

export const PROPS_MAX = 600, SCALE_MIN = 0.5, SCALE_MAX = 2, SCALE_STEP = 0.05
/** G walks these (m; 0 = free); T walks these (degrees) */
export const PROP_SNAPS = [1, 0.5, 0.25, 0] as const
export const PROP_TURNS = [90, 45, 15, 5] as const
const ID = /^[pn][0-9a-z]{1,8}$/, KIND = /^[a-z]{2,10}:[a-z0-9_-]{1,40}$/, XZ_MAX = 20000
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const round = (v: number, d: number) => { const m = 10 ** d, r = Math.round(v * m) / m; return r === 0 ? 0 : r }
/** one turn = 4; kept in [0, 4) */
const wrapQ = (q: number) => { const r = round(((q % 4) + 4) % 4, 4); return r >= 4 ? 0 : r }
export const clampScale = (s: number) => round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, s)), 2)

export function cleanProp(v: unknown): Prop | null {
  const o = v as Partial<Prop> | null
  if (o && typeof o === 'object' && typeof o.k === 'string' && isWho({ k: o.k })) {
    const w = whoOf(o.k); if (!w || !num(o.x) || !num(o.z) || Math.abs(o.x) > XZ_MAX || Math.abs(o.z) > XZ_MAX) return null
    return { id: whoId(w), k: o.k, x: round(o.x, 3), z: round(o.z, 3), q: num(o.q) ? wrapQ(o.q) : 0, s: 1, ...(w === 'newborn' && o.turned === true ? { turned: true } : {}) }
  }
  if (!o || typeof o !== 'object' || typeof o.id !== 'string' || !ID.test(o.id) || typeof o.k !== 'string' || !KIND.test(o.k)) return null
  if (!num(o.x) || !num(o.z) || Math.abs(o.x) > XZ_MAX || Math.abs(o.z) > XZ_MAX) return null
  if (isNode({ k: o.k })) {
    const w = num(o.w) ? round(Math.min(WAIT_MAX_H, Math.max(WAIT_MIN_H, o.w)), 2) : NODE_WAIT_H
    return { id: o.id, k: o.k, x: round(o.x, 3), z: round(o.z, 3), q: num(o.q) ? wrapQ(o.q) : 0, s: 1, ...(w === NODE_WAIT_H ? {} : { w }) }
  }
  return { id: o.id, k: o.k, x: round(o.x, 3), z: round(o.z, 3), q: num(o.q) ? wrapQ(o.q) : 0, s: num(o.s) ? clampScale(o.s) : 1, ...(typeof o.solid === 'boolean' ? { solid: o.solid } : {}) }
}
/** a layer JSON's props: junk dropped, one per id (the first), PROPS_MAX at most */
export function cleanProps(j: unknown): Prop[] {
  const a = (j as { props?: unknown } | null)?.props
  if (!Array.isArray(a)) return []
  const out: Prop[] = [], seen = new Set<string>()
  let n = 0
  for (const v of a) {
    const p = cleanProp(v); if (!p || seen.has(p.id) || (!isWho(p) && n >= PROPS_MAX)) continue
    seen.add(p.id); out.push(p); if (!isWho(p)) n++
  }
  return out
}
/** order-independent content, for sameLayer */
export const propsCanon = (ps: readonly Prop[] | undefined) => [...(ps ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1)).map(p => [p.id, p.k, p.x, p.z, p.q, p.s, p.solid ?? null, p.w ?? null, ...(p.turned ? [1] : [])])

export function newPropId(ps: readonly Pick<Prop, 'id'>[]): string {
  let n = 0
  for (const p of ps) { if (p.id[0] !== 'p') continue; const v = parseInt(p.id.slice(1), 36); if (Number.isFinite(v) && v > n) n = v }
  return `p${(n + 1).toString(36)}`
}
export function newNodeId(ps: readonly Pick<Prop, 'id'>[], now = Date.now()): string {
  let t = now; while (ps.some(p => p.id === `n${t.toString(36)}`)) t++
  return `n${t.toString(36)}`
}
export const snapXZ = (v: number, snap: number) => (snap > 0 ? round(Math.round(v / snap) * snap, 3) : round(v, 3))
export const turnBy = (q: number, deg: number) => wrapQ(q + deg / 90)
/** one wheel notch: rolling away grows it */
export const scaleBy = (s: number, deltaY: number) => clampScale(s + (deltaY < 0 ? SCALE_STEP : -SCALE_STEP))
export const nextOf = <T,>(list: readonly T[], cur: T): T => list[(list.indexOf(cur) + 1) % list.length]

/** the list with one more piece, or null when full / not a prop. A node picked up and put down keeps its id (`p.id`). */
export function addProp(ps: readonly Prop[], p: Omit<Prop, 'id'> & { id?: string }, now = Date.now()): Prop[] | null {
  if (isWho(p) || pieceCount(ps) >= PROPS_MAX) return null
  const c = cleanProp({ ...p, id: !isNode(p) ? newPropId(ps) : p.id && !ps.some(o => o.id === p.id) ? p.id : newNodeId(ps, now) })
  return c ? [...ps, c] : null
}
export const removeProp = (ps: readonly Prop[], id: string): Prop[] => ps.filter(p => p.id !== id)
export const changeProp = (ps: readonly Prop[], id: string, d: Partial<Omit<Prop, 'id' | 'k'>>): Prop[] => ps.map(p => (p.id === id ? cleanProp({ ...p, ...d }) ?? p : p))

// ── the editor keeps one store of { key: { id: value } } maps with one undo history (EditHistory snapshots each map shallowly); the
//    props live in it as { id: Prop }. A Prop is never mutated, only replaced, so a shallow snapshot is a whole one. ──
export const PROPS_KEY = 'props/'
export const propsToStore = (ps: readonly Prop[]) => Object.fromEntries(ps.map(p => [p.id, p])) as unknown as Record<string, number>
export const propsOfStore = (m: Record<string, number> | undefined): Prop[] => Object.values((m ?? {}) as unknown as Record<string, Prop>)
