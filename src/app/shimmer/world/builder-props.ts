// ── BETA M153 s1a: PLACED SCENERY IN THE WORLD BUILDER'S LAYER (docs/m153-place-mode.md) ──
// The layer's one new list, `props`: what the owner placed in Fly's Place mode (draft, versions, live: the same store as the terrain).
// Absent when empty, so a layer without it stays byte-identical. A prop has no height of its own: it stands on the ground under it
// (drawn and walked: open/ather/scenery.ts), so it follows every terrain edit.
// PURE, no imports (the save-builder route reads this on the server): a kind is checked by SHAPE here; what it draws, its size and
// whether it blocks is scenery.ts's palette, and a kind the palette does not know is simply never drawn. builder-props.test.ts.

/** x, z = world metres; q = turn in quarter turns (the rest of the builder's unit); s = scale; solid = the owner's toggle (absent =
 *  the kind's own answer) */
export interface Prop { id: string; k: string; x: number; z: number; q: number; s: number; solid?: boolean }

export const PROPS_MAX = 600, SCALE_MIN = 0.5, SCALE_MAX = 2, SCALE_STEP = 0.05
/** G walks these (m; 0 = free); T walks these (degrees) */
export const PROP_SNAPS = [1, 0.5, 0.25, 0] as const
export const PROP_TURNS = [90, 45, 15, 5] as const
const ID = /^p[0-9a-z]{1,8}$/, KIND = /^[a-z]{2,10}:[a-z0-9_-]{1,40}$/, XZ_MAX = 20000
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const round = (v: number, d: number) => { const m = 10 ** d, r = Math.round(v * m) / m; return r === 0 ? 0 : r }
/** one turn = 4; kept in [0, 4) */
const wrapQ = (q: number) => { const r = round(((q % 4) + 4) % 4, 4); return r >= 4 ? 0 : r }
export const clampScale = (s: number) => round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, s)), 2)

export function cleanProp(v: unknown): Prop | null {
  const o = v as Partial<Prop> | null
  if (!o || typeof o !== 'object' || typeof o.id !== 'string' || !ID.test(o.id) || typeof o.k !== 'string' || !KIND.test(o.k)) return null
  if (!num(o.x) || !num(o.z) || Math.abs(o.x) > XZ_MAX || Math.abs(o.z) > XZ_MAX) return null
  return { id: o.id, k: o.k, x: round(o.x, 3), z: round(o.z, 3), q: num(o.q) ? wrapQ(o.q) : 0, s: num(o.s) ? clampScale(o.s) : 1, ...(typeof o.solid === 'boolean' ? { solid: o.solid } : {}) }
}
/** a layer JSON's props: junk dropped, one per id (the first), PROPS_MAX at most */
export function cleanProps(j: unknown): Prop[] {
  const a = (j as { props?: unknown } | null)?.props
  if (!Array.isArray(a)) return []
  const out: Prop[] = [], seen = new Set<string>()
  for (const v of a) {
    if (out.length >= PROPS_MAX) break
    const p = cleanProp(v); if (!p || seen.has(p.id)) continue
    seen.add(p.id); out.push(p)
  }
  return out
}
/** order-independent content, for sameLayer */
export const propsCanon = (ps: readonly Prop[] | undefined) => [...(ps ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1)).map(p => [p.id, p.k, p.x, p.z, p.q, p.s, p.solid ?? null])

export function newPropId(ps: readonly Pick<Prop, 'id'>[]): string {
  let n = 0
  for (const p of ps) { const v = parseInt(p.id.slice(1), 36); if (Number.isFinite(v) && v > n) n = v }
  return `p${(n + 1).toString(36)}`
}
export const snapXZ = (v: number, snap: number) => (snap > 0 ? round(Math.round(v / snap) * snap, 3) : round(v, 3))
export const turnBy = (q: number, deg: number) => wrapQ(q + deg / 90)
/** one wheel notch: rolling away grows it */
export const scaleBy = (s: number, deltaY: number) => clampScale(s + (deltaY < 0 ? SCALE_STEP : -SCALE_STEP))
export const nextOf = <T,>(list: readonly T[], cur: T): T => list[(list.indexOf(cur) + 1) % list.length]

/** the list with one more piece, or null when full / not a prop */
export function addProp(ps: readonly Prop[], p: Omit<Prop, 'id'>): Prop[] | null {
  if (ps.length >= PROPS_MAX) return null
  const c = cleanProp({ ...p, id: newPropId(ps) })
  return c ? [...ps, c] : null
}
export const removeProp = (ps: readonly Prop[], id: string): Prop[] => ps.filter(p => p.id !== id)
export const changeProp = (ps: readonly Prop[], id: string, d: Partial<Omit<Prop, 'id' | 'k'>>): Prop[] => ps.map(p => (p.id === id ? cleanProp({ ...p, ...d }) ?? p : p))

// ── the editor keeps one store of { key: { id: value } } maps with one undo history (EditHistory snapshots each map shallowly); the
//    props live in it as { id: Prop }. A Prop is never mutated, only replaced, so a shallow snapshot is a whole one. ──
export const PROPS_KEY = 'props/'
export const propsToStore = (ps: readonly Prop[]) => Object.fromEntries(ps.map(p => [p.id, p])) as unknown as Record<string, number>
export const propsOfStore = (m: Record<string, number> | undefined): Prop[] => Object.values((m ?? {}) as unknown as Record<string, Prop>)
