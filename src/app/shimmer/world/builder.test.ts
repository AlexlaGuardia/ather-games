// BETA M83 p1 s1a: the World Builder store (pure). Run: npx tsx src/app/shimmer/world/builder.test.ts
import { planPublish, planRollback, cleanLayer, cleanIndex, emptyIndex, sameLayer, draftState, savedAgo, versionFile, layerSize, isBuilderMap, EMPTY_LAYER, NOTE_MAX, type Layer, type Index, type Plan } from './builder'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const T = '2026-11-22T22:00:00.000Z'
const L = (tiles: Record<string, Record<string, number>>, water = {}, falls = {}): Layer => ({ v: 1, tiles, water, falls })

// a tiny in-memory "disk" that applies a plan the way the route does (in order), so order + content are both checked
interface Disk { versions: Record<number, Layer>; live: Layer; draft: Layer | null; index: Index }
const apply = (d: Disk, p: Plan) => { for (const w of p.writes) { if (w.kind === 'version') d.versions[w.v] = w.layer; else if (w.kind === 'live') d.live = w.layer; else if (w.kind === 'draft') d.draft = w.layer; else d.index = w.index } }

// maps
ok(isBuilderMap('wilds') && !isBuilderMap('glade') && !isBuilderMap('../etc'), 'builder maps: wilds only in s1a, no path tricks')
ok(versionFile(7) === 'v0007.json' && versionFile(1234) === 'v1234.json', 'version file names sort as text')

// cleaning: junk dropped, same cleaners as the game
const junk = cleanLayer({ tiles: { 'first-wilds': { 5: 30 }, 'other': { 5: 1, x: 4 }, '../bad': { 1: 1 } }, water: 'nope', falls: null })
ok(Object.keys(junk.tiles).join() === 'first-wilds' && junk.tiles['first-wilds']['5'] === 30, 'cleanLayer keeps valid tiles, drops a tile with a junk key (the game\'s cleanTile rule) + bad tile names')
ok(Object.keys(junk.water).length === 0 && Object.keys(junk.falls).length === 0, 'cleanLayer: malformed water/falls = none')

// equality ignores key order
ok(sameLayer(L({ a: { 1: 2, 3: 4 }, b: { 9: 1 } }), L({ b: { 9: 1 }, a: { 3: 4, 1: 2 } })), 'sameLayer ignores key order')
ok(!sameLayer(L({ a: { 1: 2 } }), L({ a: { 1: 3 } })), 'sameLayer sees a changed vertex')
ok(draftState(L({ a: { 1: 2 } }), L({ a: { 1: 2 } })) === 'matches live' && draftState(L({ a: { 1: 2 } }), EMPTY_LAYER) === 'unpublished changes', 'draft state vs live')

// FIRST PUBLISH over an M62-sculpted live layer: v1 = the pre-builder world, v2 = the draft
const pre = L({ 'first-wilds': { 100: 50 } }, { 'first-wilds': { 7: 120 } })
const hill = L({ 'first-wilds': { 100: 50, 200: 300 } }, { 'first-wilds': { 7: 120 } })
const disk: Disk = { versions: {}, live: pre, draft: hill, index: emptyIndex('wilds') }
const p1 = planPublish(disk.index, hill, pre, T, '  a hill by the road  ')
ok(p1.writes.map(w => w.kind).join() === 'version,version,live,index', `publish order: versions, then LIVE, then index LAST (${p1.writes.map(w => w.kind).join()})`)
apply(disk, p1)
ok(disk.index.versions.length === 2 && disk.index.versions[0].note === 'as shipped before the builder' && sameLayer(disk.versions[1], pre), 'first publish records the pre-builder live layer as v1')
ok(disk.index.live === 2 && sameLayer(disk.live, hill) && sameLayer(disk.versions[2], hill), 'v2 = the draft, and it is live')
ok(disk.index.versions[1].note === 'a hill by the road', 'note trimmed')
ok(disk.index.versions[1].size.verts === 2 && disk.index.versions[1].size.water === 1, 'version records its size')

// first publish over an EMPTY live layer: v1 is STILL recorded (empty = the exported land), so a rollback to it exists
// (builder-check's first prod run, 11-22: without it the first publish WAS v1 and "roll back to v1" kept the hill)
const p0 = planPublish(emptyIndex('wilds'), hill, EMPTY_LAYER, T)
ok(p0.index.versions.length === 2 && layerSize((p0.writes[0] as { layer: Layer }).layer).verts === 0 && p0.index.versions[1].note === 'publish' && p0.index.live === 2, 'empty live: v1 = the empty pre-builder layer, the draft is v2 (default note)')
const d0: Disk = { versions: {}, live: EMPTY_LAYER, draft: hill, index: emptyIndex('wilds') }; apply(d0, p0)
apply(d0, planRollback(d0.index, 1, d0.versions[1], T)!)
ok(layerSize(d0.live).verts === 0 && layerSize(d0.draft!).verts === 0, 'empty live: roll back to v1 = the hill is gone')
ok(planPublish(emptyIndex('wilds'), hill, EMPTY_LAYER, T, 'x'.repeat(500)).index.versions[1].note.length === NOTE_MAX, 'note capped')

// ★ HALF-LAND: whatever prefix of the writes completes, the live layer is always a WHOLE layer (old or new), never a mix, and the
//   index never points at a version file that was not written
const p2 = planPublish(disk.index, L({ 'first-wilds': { 200: 300, 300: -40 } }), disk.live, T, 'second')
let allWhole = true, neverDangling = true
for (let k = 0; k <= p2.writes.length; k++) {
  const d: Disk = { versions: { ...disk.versions }, live: disk.live, draft: disk.draft, index: disk.index }
  apply(d, { index: p2.index, writes: p2.writes.slice(0, k) })
  if (!(sameLayer(d.live, disk.live) || sameLayer(d.live, p2.writes.find(w => w.kind === 'live')!.layer as Layer))) allWhole = false
  for (const v of d.index.versions) if (!d.versions[v.v]) neverDangling = false
  if (d.index.live !== null && !d.versions[d.index.live]) neverDangling = false
}
ok(allWhole, 'a publish cut off after ANY write leaves live = the old layer or the new one, whole')
ok(neverDangling, 'a publish cut off after ANY write never leaves the index naming a missing version')
apply(disk, p2)
ok(disk.index.live === 3 && disk.index.versions.length === 3, 'second publish = v3')

// ROLLBACK to v1: a NEW version (v4), live + draft both = v1's content, nothing deleted
const rb = planRollback(disk.index, 1, disk.versions[1], T)!
ok(rb.writes.map(w => w.kind).join() === 'version,live,draft,index', `rollback order: version, live, draft, index last (${rb.writes.map(w => w.kind).join()})`)
apply(disk, rb)
ok(disk.index.live === 4 && disk.index.versions.at(-1)!.from === 1 && disk.index.versions.at(-1)!.note === 'roll back to v1', 'rollback = v4, from v1')
ok(sameLayer(disk.live, pre) && sameLayer(disk.draft!, pre), 'rollback: the hill is gone from live AND from the draft')
ok(Object.keys(disk.versions).length === 4 && sameLayer(disk.versions[2], hill), 'rollback deletes nothing: v2 (the hill) can be rolled forward to')
ok(planRollback(disk.index, 99, EMPTY_LAYER, T) === null, 'rollback to a missing version = refused')
const fwd = planRollback(disk.index, 2, disk.versions[2], T)!; apply(disk, fwd)
ok(sameLayer(disk.live, hill) && disk.index.live === 5, 'roll FORWARD to v2 brings the hill back as v5')

// index cleaning
const ci = cleanIndex({ live: 9, versions: [{ v: 2, at: T, note: 'b' }, { v: 1, at: T, note: 'a' }, { v: -1, at: T }, { v: 'x' }] }, 'wilds')
ok(ci.versions.map(v => v.v).join() === '1,2' && ci.live === 2, 'cleanIndex: sorted, junk dropped, a live pointing nowhere falls back to the newest')
ok(cleanIndex(null, 'wilds').live === null && cleanIndex('garbage', 'wilds').versions.length === 0, 'cleanIndex: no file = empty')

// saved-ago label
ok(savedAgo(null, 0) === 'not saved yet' && savedAgo(1000, 13_400) === 'saved 12 s ago' && savedAgo(0, 185_000) === 'saved 3 min ago' && savedAgo(0, 7_300_000) === 'saved 2 h ago', 'saved-ago label')
ok(layerSize(EMPTY_LAYER).verts === 0, 'empty layer size')

console.log(fails ? `\n${fails} FAILED` : '\nall pass')
process.exit(fails ? 1 : 0)
