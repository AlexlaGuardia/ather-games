// ── THE WORLD BUILDER STORE (BETA M83 p1 s1a, Alex 11-22: "a double of each map.. build for hours with an auto save feature and a
// save button".. publish pushes it live as a version, roll back to any version) ──
// Per map there are three things:
//   DRAFT    data/builder/<map>/draft.json. The owner's working copy; autosave + Save write it. data/ is gitignored and is never
//            shipped by a build (dev-written.txt: runtime), so a 60 s autosave can never trip coord build's uncommitted-save refusal
//            (M94) and a build can never drop it. Players never read it.
//   VERSIONS src/app/shimmer/world/builder/<map>/vNNNN.json + index.json. One file per PUBLISH, in the repo (diffable, git rollback;
//            dev-written.txt: data, so coord build refuses to ship until they are committed). Never deleted: a rollback is a NEW
//            version whose content is an old one's, so the history only grows.
//   LIVE     the layer file the game already reads at runtime (Wilds: world/wilds-edits.json via GET /shimmer/open/wilds-edits).
//            Kept exactly as M62 left it, so play is unchanged until the first publish.
// ★ ORDER OF WRITES on publish / rollback (hub 11-22: "can't half-land"): the version file first, then the LIVE file (atomic: tmp +
//   rename, lib/backup safeWriteFile), then index.json. A crash between steps leaves an extra version file nobody points at, or a
//   live layer one entry ahead of the index (the next publish re-reads live and repairs it); never a half-written live layer. A
//   coord build cannot catch it mid-way either: it ships a git-archive SNAPSHOT of HEAD (11-18), never the working tree.
//
// Everything below is PURE (no fs, no fetch): builder.test.ts drives it; the route (save-builder) does the IO in the planned order.

import { cleanEdits, cleanWaters, cleanFallss, type Edits, type WaterMap, type FallMap } from '../open/ather/wilds-edits'
import { cleanProps, propsCanon, type Prop } from './builder-props'
import { cleanVoids, type VoidEdits } from '../open/ather/void-edits'
import { cleanZones, type Zone } from './builder-zones'

export const BUILDER_MAPS = ['wilds', 'glade', 'nyx'] as const   // s2a the Glade (world/glade-builder.ts: one virtual tile), s3 the Nyx continent (world/nyx-builder.ts: virtual 1 km tiles)
export type BuilderMap = typeof BUILDER_MAPS[number]
export const isBuilderMap = (m: unknown): m is BuilderMap => typeof m === 'string' && (BUILDER_MAPS as readonly string[]).includes(m)

/** a map's edit layer, the same shape as world/wilds-edits.json. `voids` (M104, the Wilds' void brush: void-edits.ts) is only
 *  present when it holds a cell, so a layer without void edits is byte-identical to the pre-M104 file */
export interface Layer { v: 1; tiles: Edits; water: Record<string, WaterMap>; falls: Record<string, FallMap>; voids?: VoidEdits; /** M84 s1: building zones (builder-zones.ts), only present when there is one; the game reads only `tiles` (the flatten is baked there) */ zones?: Zone[]; /** M153 s1a: placed scenery (builder-props.ts), only present when there is some */ props?: Prop[] }
export const EMPTY_LAYER: Layer = { v: 1, tiles: {}, water: {}, falls: {} }
/** junk-proof: anything that is not a valid sparse map is dropped (the same cleaners the game uses) */
export const cleanLayer = (j: unknown): Layer => {
  const L: Layer = { v: 1, tiles: cleanEdits(j), water: cleanWaters(j), falls: cleanFallss(j) }
  const vo = cleanVoids(j); if (Object.keys(vo).length) L.voids = vo
  const zo = cleanZones(j); if (zo.length) L.zones = zo
  const pr = cleanProps(j); if (pr.length) L.props = pr
  return L
}
export const layerSize = (l: Layer) => {
  const n = (m: Record<string, Record<string, number>>) => Object.values(m).reduce((a, d) => a + Object.keys(d).length, 0)
  const s: { tiles: number; verts: number; water: number; falls: number; voids?: number; zones?: number; props?: number } = { tiles: Object.keys(l.tiles).length, verts: n(l.tiles), water: n(l.water), falls: n(l.falls) }
  const v = Object.keys(l.voids ?? {}).length; if (v) s.voids = v
  if (l.zones?.length) s.zones = l.zones.length
  if (l.props?.length) s.props = l.props.length
  return s
}
/** order-independent equality (JSON key order must not make two equal layers differ) */
export function sameLayer(a: Layer, b: Layer): boolean {
  const canon = (l: Layer) => JSON.stringify([...['tiles', 'water', 'falls'].map(p => {
    const m = l[p as 'tiles'] as Record<string, Record<string, number>>
    return Object.keys(m).sort().map(t => [t, Object.keys(m[t]).sort((x, y) => +x - +y).map(k => [k, m[t][k]])])
  }), Object.keys(l.voids ?? {}).sort().map(k => [k, l.voids![k]]), [...(l.zones ?? [])].sort((a, b) => a.id < b.id ? -1 : 1).map(z => [z.id, z.x0, z.z0, z.x1, z.z1, z.h, z.tag?.kind ?? null, z.tag?.ref ?? null, z.tag?.name ?? null, z.tag?.front ?? null, (z.build ?? []).map(p => [p.id, p.item, p.x, p.z, p.q])]), propsCanon(l.props)] as unknown[])
  return canon(a) === canon(b)
}

export interface Version { v: number; at: string; note: string; /** a rollback: the version whose content this one re-published */ from?: number; size: ReturnType<typeof layerSize> }
export interface Index { map: BuilderMap; live: number | null; versions: Version[] }
export const emptyIndex = (map: BuilderMap): Index => ({ map, live: null, versions: [] })
export function cleanIndex(j: unknown, map: BuilderMap): Index {
  const o = j as Partial<Index> | null
  if (!o || !Array.isArray(o.versions)) return emptyIndex(map)
  const versions = o.versions.filter((x): x is Version => !!x && Number.isInteger(x.v) && x.v > 0 && typeof x.at === 'string').sort((a, b) => a.v - b.v)
  const live = Number.isInteger(o.live) && versions.some(x => x.v === o.live) ? o.live as number : versions.at(-1)?.v ?? null
  return { map, live, versions }
}
export const versionFile = (v: number) => `v${String(v).padStart(4, '0')}.json`
export const NOTE_MAX = 120
const note = (s: unknown, dflt: string) => (typeof s === 'string' && s.trim() ? s.trim().slice(0, NOTE_MAX) : dflt)

/** One write the route must perform, in this order. 'version' = write `layer` as versionFile(v); 'live' = the game's layer file;
 *  'draft' = the owner's draft; 'index' = index.json. */
export type Write = { kind: 'version'; v: number; layer: Layer } | { kind: 'live'; layer: Layer } | { kind: 'draft'; layer: Layer } | { kind: 'index'; index: Index }
export interface Plan { index: Index; writes: Write[] }

/** PUBLISH the draft. A map's FIRST publish records the live layer as it stood as v1 'as shipped before the builder' (M62 edits,
 *  or EMPTY = the exported land), so rolling back to the pre-builder world is always one click. ★ Even when empty: builder-check's
 *  first prod run (11-22) found that skipping an empty v1 made the first publish v1 itself, so there was no version to roll back to. */
export function planPublish(idx: Index, draft: Layer, live: Layer, at: string, msg?: unknown): Plan {
  const index: Index = { ...idx, versions: [...idx.versions] }
  const writes: Write[] = []
  let n = index.versions.at(-1)?.v ?? 0
  if (!index.versions.length) {
    n += 1; const v0: Version = { v: n, at, note: 'as shipped before the builder', size: layerSize(live) }
    index.versions.push(v0); writes.push({ kind: 'version', v: n, layer: live })
  }
  n += 1
  index.versions.push({ v: n, at, note: note(msg, 'publish'), size: layerSize(draft) })
  index.live = n
  writes.push({ kind: 'version', v: n, layer: draft }, { kind: 'live', layer: draft }, { kind: 'index', index })
  return { index, writes }
}

/** ROLL BACK to version `to` (its content, read by the route): a NEW version re-publishing it, live + draft both set to it (so the
 *  next publish does not quietly bring the rolled-back work back). null = no such version. */
export function planRollback(idx: Index, to: number, content: Layer, at: string): Plan | null {
  if (!idx.versions.some(x => x.v === to)) return null
  const n = (idx.versions.at(-1)?.v ?? 0) + 1
  const index: Index = { ...idx, live: n, versions: [...idx.versions, { v: n, at, note: `roll back to v${to}`, from: to, size: layerSize(content) }] }
  return { index, writes: [{ kind: 'version', v: n, layer: content }, { kind: 'live', layer: content }, { kind: 'draft', layer: content }, { kind: 'index', index }] }
}

/** what the builder shows next to Publish */
export function draftState(draft: Layer, live: Layer): 'unpublished changes' | 'matches live' {
  return sameLayer(draft, live) ? 'matches live' : 'unpublished changes'
}
/** "saved 12 s ago" / "saved 3 min ago" / "not saved yet" */
export function savedAgo(at: number | null, now: number): string {
  if (at === null) return 'not saved yet'
  const s = Math.max(0, Math.round((now - at) / 1000))
  return s < 60 ? `saved ${s} s ago` : s < 3600 ? `saved ${Math.floor(s / 60)} min ago` : `saved ${Math.floor(s / 3600)} h ago`
}
export const AUTOSAVE_MS = 60_000
