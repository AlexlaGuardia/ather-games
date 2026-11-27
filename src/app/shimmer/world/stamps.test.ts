// BETA M85 s3: STAMPS + COPY / PASTE, pure, and the close-time draft flush (carried from s2). A stamp keeps each piece's kind, turn,
// size, toggle and offset; stamping makes NEW ordinary pieces (p / s ids) with the offsets turned with the stamp; paste = the same with
// new ids; the shelf survives JSON (localStorage) and drops junk; the caps hold a stamp whole or not at all; stamped pieces ride the
// builder's own layer (save / publish) and the game reads them back. The flush: a 2000-piece draft is still SENT when the editor closes.
// Run: npx tsx src/app/shimmer/world/stamps.test.ts
import { STAMPS_MAX, addStamp, cleanStamps, loadStamps, placeStamp, stampOf, stampSpots, turnOffset, type StampPiece } from './stamps'
import { flushInit, byteLength, KEEPALIVE_MAX_BYTES } from './builder-flush'
import { PROPS_MAX, SCATTER_MAX, cleanProp, cleanProps, pieceCount, yawOfQ, type Prop } from './builder-props'
import { paintScatter, scatterCount } from './scatter-brush'
import { cleanLayer, type Layer } from './builder'
import { wildsPublishedProps } from '../open/ather/scenery'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const near = (a: number, b: number, e = 1e-3) => Math.abs(a - b) <= e
const P = (id: string, k: string, x: number, z: number, q = 0, s = 1, solid?: boolean): Prop => cleanProp({ id, k, x, z, q, s, ...(solid === undefined ? {} : { solid }) })!

// a lamp + bench cluster and a scattered flower, and things that are never copied
const base: Prop[] = [
  P('p1', 'filler:sign', 10, 20, 0, 1),
  P('p2', 'filler:fence', 12, 20, 1, 1.5, false),
  P('p3', 'filler:rock-medium', 10, 23, 0.5, 4, true),
  P('s1', 'filler:flowers-white', 11, 21, 2.3, 0.8),
  { id: 'wgreg', k: 'who:greg', x: 0, z: 0, q: 0, s: 1 },
  { id: 'n1abc', k: 'node:tree-oak', x: 5, z: 5, q: 0, s: 1 },
].filter(Boolean)
ok(base.length === 6, 'fixture: 6 pieces clean')

// 1. a stamp of a selection: offsets from the centre, own turn / size / toggle kept; people and nodes left out
const st = stampOf(base, ['p1', 'p2', 'p3', 's1', 'wgreg', 'n1abc'])
ok(st.length === 4, 'stamp of 6 selected = 4 pieces (the person and the node are not copied)')
const cx = (10 + 12 + 10 + 11) / 4, cz = (20 + 20 + 23 + 21) / 4
ok(st.every((p, i) => near(p.dx, [10, 12, 10, 11][i] - cx) && near(p.dz, [20, 20, 23, 21][i] - cz)), 'offsets are from the selection centre')
ok(near(st.reduce((a, p) => a + p.dx, 0), 0) && near(st.reduce((a, p) => a + p.dz, 0), 0), 'offsets sum to zero')
ok(st[1].q === 1 && st[1].s === 1.5 && st[1].solid === false && st[2].s === 4 && st[2].solid === true, 'turn, size (outcrop 4) and toggle kept')
ok(st[3].sc === 1 && !st[0].sc, 'a scattered piece is marked scattered')
ok(stampOf(base, ['wgreg']).length === 0 && stampOf(base, []).length === 0, 'nothing stampable = an empty stamp')

// 2. stamping: new ids, the same relative layout, ground under each (no y of its own)
const r0 = placeStamp(base, st, 100, -50, 0)!
ok(!!r0 && r0.props.length === base.length + 4 && r0.added.length === 4, 'stamp adds 4 pieces')
ok(r0.added.every(id => !base.some(p => p.id === id)) && new Set(r0.added).size === 4, 'new ids, none reused')
ok(r0.added.filter(id => id[0] === 'p').length === 3 && r0.added.filter(id => id[0] === 's').length === 1, 'placed pieces get p ids, scattered ones s ids')
const got0 = r0.added.map(id => r0.props.find(p => p.id === id)!)
ok(got0.every((p, i) => near(p.x - 100, st[i].dx) && near(p.z + 50, st[i].dz) && p.q === st[i].q && p.s === st[i].s), 'unturned: offsets, turns, sizes exact')
ok(got0.every(p => !('y' in p)), 'a stamped piece has no height of its own: it stands on the ground where it lands')
ok(got0[3].solid === undefined && got0[2].solid === true, 'the scattered piece stays never-solid; the solid toggle rides')
ok(r0.props.every(p => cleanProp(p) !== null), 'every stamped piece is a clean prop')

// 3. relative transforms preserved under rotation: distances + angles between pieces, each piece's own turn + the stamp's
for (const q of [1, 0.5, 2, 3, 1.25]) {
  const r = placeStamp(base, st, 30, 40, q)!, g = r.added.map(id => r.props.find(p => p.id === id)!)
  const d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)
  const orig = st.map(p => ({ x: p.dx, z: p.dz }))
  let same = true
  for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) same &&= near(d(g[i], g[j]), d(orig[i], orig[j]), 2e-3)
  ok(same, `q ${q}: every pairwise distance kept`)
  ok(g.every((p, i) => near(((p.q - st[i].q - q) % 4 + 4) % 4 % 4, 0, 1e-3) || near(((p.q - st[i].q - q) % 4 + 4) % 4, 4, 1e-3)), `q ${q}: each piece turned by the stamp's turn too`)
  // the offset turns the way a piece's front turns (rotation.y = yawOfQ): piece-local +z ends up where the offset (0, 1) goes
  const o = turnOffset(0, 1, q), a = yawOfQ(q)
  ok(near(o.dx, Math.sin(a)) && near(o.dz, Math.cos(a)), `q ${q}: the offset turns with the drawn yaw`)
  ok(near(g.reduce((s, p) => s + p.x, 0) / 4, 30, 2e-3) && near(g.reduce((s, p) => s + p.z, 0) / 4, 40, 2e-3), `q ${q}: centred where aimed`)
}
const q1 = stampSpots([{ k: 'filler:fence', dx: 2, dz: 0, q: 0, s: 1 }], 0, 0, 1)[0]
ok(near(q1.x, 0) && near(q1.z, 2) && q1.q === 1, 'a quarter turn moves a piece 2 m along +x to 2 m along +z, and turns it once (three.js rotation.y = -90° takes +x to +z)')

// 4. stamping twice: both copies, all ids distinct, nothing in the first moved
const r1 = placeStamp(r0.props, st, -100, 60, 1)!
ok(r1.props.length === base.length + 8 && new Set(r1.props.map(p => p.id)).size === r1.props.length, 'stamped twice: 8 new pieces, ids unique')
ok(r0.props.every(p => JSON.stringify(r1.props.find(o => o.id === p.id)) === JSON.stringify(p)), 'the second stamp leaves every earlier piece as it was')

// 5. paste (Ctrl+C / Ctrl+V = stampOf + placeStamp): duplicates with new ids, same kind / turn / size
const cp = stampOf(r1.props, ['p2']), pz = placeStamp(r1.props, cp, 7, 8, 0)!
const dup = pz.props.find(p => p.id === pz.added[0])!, src = r1.props.find(p => p.id === 'p2')!
ok(pz.added.length === 1 && dup.id !== 'p2' && dup.k === src.k && dup.q === src.q && dup.s === src.s && dup.solid === src.solid && dup.x === 7 && dup.z === 8, 'paste one piece: a copy with a new id at the crosshair')
ok(pz.props.some(p => p.id === 'p2'), 'the original stays')

// 6. the land: a piece off the land is left out; the caps hold a stamp whole or not at all
const land = (x: number) => x < 10.5
const rl = placeStamp(base, st, 10, 0, 0, (x) => land(x))!
ok(rl.added.length === st.filter(p => land(10 + p.dx)).length && rl.added.length < 4, 'pieces off the land are left out')
const full: Prop[] = Array.from({ length: PROPS_MAX - 2 }, (_, i) => P(`p${(i + 1).toString(36)}`, 'filler:rock-small', i % 100, Math.floor(i / 100)))
ok(pieceCount(full) === PROPS_MAX - 2 && placeStamp(full, st, 0, 0, 0) === null, 'no room for 3 placed pieces under the cap: nothing placed')
ok(placeStamp(full, st.slice(0, 2), 0, 0, 0)?.added.length === 2, 'exactly room for 2: both go')
const sMax: Prop[] = Array.from({ length: SCATTER_MAX }, (_, i) => P(`s${(i + 1).toString(36)}`, 'filler:flowers-white', i % 100, 300 + Math.floor(i / 100)))
ok(scatterCount(sMax) === SCATTER_MAX && placeStamp(sMax, st, 0, 0, 0) === null, 'scatter cap full: a stamp with a scattered piece is refused whole')

// 7. the shelf survives localStorage (JSON) and drops junk
let shelf = addStamp([], st, 1000)
shelf = addStamp(shelf, cp, 1000)
ok(shelf.length === 2 && shelf[0].id !== shelf[1].id && shelf[0].name === 'Stamp 1' && shelf[1].name === 'Stamp 2', 'two stamps, distinct ids + names')
const back = loadStamps(JSON.stringify(shelf))
ok(JSON.stringify(back) === JSON.stringify(shelf), 'save / load round-trips exactly')
const rb = placeStamp(base, back[0].pieces, 100, -50, 0)!
ok(JSON.stringify(rb.props) === JSON.stringify(r0.props), 'a loaded stamp stamps exactly like the one saved')
ok(loadStamps(null).length === 0 && loadStamps('{bad').length === 0 && loadStamps('"x"').length === 0, 'missing / broken storage = empty shelf')
const junk = cleanStamps([{ id: 'a1', name: 'ok', pieces: [{ k: 'filler:fence', dx: 1, dz: 1, q: 9, s: 1 }, { k: 'who:greg', dx: 0, dz: 0, q: 0, s: 1 }, { k: 'BAD', dx: 0, dz: 0 }, { k: 'node:tree-oak', dx: 0, dz: 0 }] }, { id: 'a1', pieces: [{ k: 'filler:fence', dx: 0, dz: 0 }] }, { id: 'b2', pieces: [] }, null, 5])
ok(junk.length === 1 && junk[0].pieces.length === 1 && junk[0].pieces[0].q === 1, 'junk pieces, people, nodes, duplicate ids and empty stamps dropped; turn wrapped')
const many = Array.from({ length: STAMPS_MAX + 5 }, (_, i) => i).reduce((s, i) => addStamp(s, st, 5000 + i), [] as ReturnType<typeof addStamp>)
ok(many.length === STAMPS_MAX && loadStamps(JSON.stringify(many)).length === STAMPS_MAX, `the shelf keeps the newest ${STAMPS_MAX}`)
ok(addStamp(shelf, [] as StampPiece[]).length === shelf.length, 'an empty selection saves nothing')

// 8. stamped pieces ride the builder's own layer (draft / publish = cleanLayer) and the game draws them
const layer: Layer = cleanLayer(JSON.parse(JSON.stringify({ v: 1, tiles: {}, water: {}, falls: {}, props: r1.props })))
ok(layer.props?.length === r1.props.length, 'the draft keeps every stamped piece')
const game = wildsPublishedProps(JSON.parse(JSON.stringify(layer)).props)
ok(r1.added.every(id => game.some(p => p.id === id)), 'the Wilds game reads every stamped piece back')

// 9. THE CLOSE-TIME FLUSH (s2 carried bug): 2000+ pieces still reach the server when the editor closes without Save.
//    Browsers refuse a keepalive body over 64 KiB (the fetch rejects, nothing is sent): `browser` models that rule.
const browser = (url: string, init: RequestInit): unknown | null => (init.keepalive && byteLength(String(init.body)) > 65536 ? null : JSON.parse(String(init.body)))
let big: Prop[] = []
for (let i = 0; scatterCount(big) < 2000 && i < 100; i++) big = paintScatter(big, { x: (i % 10) * 25, z: Math.floor(i / 10) * 25, radius: 12, density: 3, kinds: ['filler:flowers-white', 'filler:grass-tall', 'bush:bloom-bush'], seed: i + 1 })
big = [...big, ...r1.props.filter(p => p.id[0] === 'p')]
const body = JSON.stringify({ map: 'wilds', action: 'draft', layer: { v: 1, tiles: {}, water: {}, falls: {}, props: big } })
ok(scatterCount(big) >= 2000 && byteLength(body) > 65536, `fixture: ${big.length} pieces = ${byteLength(body)} bytes, past the keepalive quota`)
const sent = browser('/shimmer/save-builder', flushInit(body)) as { layer: unknown } | null
ok(sent !== null, 'the close-time flush of a 2000-piece draft is SENT (not refused as an over-quota keepalive)')
ok(sent !== null && cleanProps(sent.layer).length === big.length, 'and it carries every piece')
const small = JSON.stringify({ map: 'wilds', action: 'draft', layer: { v: 1, tiles: {}, water: {}, falls: {}, props: base } })
ok(flushInit(small).keepalive === true && byteLength(small) <= KEEPALIVE_MAX_BYTES, 'a small draft still goes keepalive (survives a closing tab)')
ok(flushInit(body).method === 'POST' && flushInit(body).body === body, 'same POST, same body as the normal draft save')

console.log(`\nstamps: ${fails ? `${fails} FAILED` : 'all passed'}`)
if (fails) process.exit(1)
