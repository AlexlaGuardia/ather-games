// BETA M97 s1: rooms are SHELLS (Alex 11-23: just the floor and the furniture inside; no walls, roof, door frame). Run: npx tsx src/app/shimmer/open/ather/shell-rooms.test.ts
import { place, useSpotOf, wallsOf, benchOf, doorOf, benchBox, toWorld, canPlacePiece, nearWork, freshWorks, loadWorks, saveWorks, ROOMS, type Works, type Room } from './rooms'
import { STARTING_SQUARES } from './plot'
import { newInv, give } from '../shared/inventory'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const owned = new Set<string>(STARTING_SQUARES)
const rich = give(give(newInv(12), 'goldwood_log', 60).inv, 'goldwood_stool', 4).inv

const P = { x: -100, z: 100 }
const pl = place(freshWorks(), owned, rich, 'rinnshop', P.x, P.z, 0, 1000)
ok(!!pl && pl.room.shell === true, 'a newly placed room is a shell')
const r = pl!.room, w: Works = pl!.works
for (let q = 0; q < 4; q++) {
  const rr: Room = { ...r, q }, b = benchOf(rr)
  ok(wallsOf(rr).length === 0, `turn ${q}: a shell has nothing solid of its own (no walls, no door frame)`)
  const bb = benchBox(rr); ok(b.x > bb.x0 && b.x < bb.x1 && b.z > bb.z0 && b.z < bb.z1 && bb.x1 - bb.x0 > 0.7, `turn ${q}: the bench box sits on the bench`)
}
// the keeper builds round it: furniture where the back wall used to be is fine now
const back = toWorld(r, 1.5, ROOMS.rinnshop.d / 2)
ok(canPlacePiece(w, owned, 'goldwood_stool', back.x, back.z, 0).ok, 'a stool on the old back-wall line sets (no wall there)')
const d = doorOf(r)
ok(canPlacePiece(w, owned, 'goldwood_stool', d.x, d.z, 0).ok, 'no door: the old doorway takes furniture too')
ok(nearWork(w, benchOf(r).x, benchOf(r).z, r.doneAt + 1)?.kind === 'bench', 'the bench still works')
// an older room keeps its walls
ok(wallsOf({ ...r, shell: undefined }).length === 5, 'an older room (no shell flag) keeps its five walls')
// M97 s2: rooms flush side by side (rinnshop 8 x 6 at P; carpentry 8 x 6 beside it)
const flush = place(w, owned, pl!.inv, 'carpentry', P.x - 8, P.z, 0, 2000)
ok(!!flush, 'a second room stands FLUSH against the first (edge to edge)')
ok(!!flush && nearWork(flush.works, benchOf(flush.room).x, benchOf(flush.room).z, flush.room.doneAt + 1)?.kind === 'bench' && nearWork(flush.works, benchOf(r).x, benchOf(r).z, flush.room.doneAt + 1)?.kind === 'bench', 'both flush rooms work')
ok(!place(w, owned, pl!.inv, 'carpentry', P.x - 7.5, P.z, 0, 2000), 'half a metre of overlap still refuses')
ok(!place(w, owned, pl!.inv, 'carpentry', P.x - 4, P.z + 3, 0, 2000), 'a real overlap refuses')
// survives reload
const store = new Map<string, string>(); (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } }
// M183: a room is a pad. Anything may stand on its floor; only a piece IN the bench or on its use spot crowds it (slabs lie under both)
for (let q = 0; q < 4; q++) {
  const rr: Room = { ...r, q }, ww: Works = { ...w, rooms: [rr] }, at = (u: number, v: number) => toWorld(rr, u, v), D = ROOMS.rinnshop.d / 2, u = useSpotOf(rr), b = benchOf(rr)
  const can = (item: string, x: number, z: number, qq = q) => { const v = canPlacePiece(ww, owned, item, x, z, qq); return { ok: v.ok, why: v.ok ? '' : v.why } }
  ok(Math.abs(Math.hypot(u.x - b.x, u.z - b.z) - 1.2) < 1e-9, `turn ${q}: the use spot is 1.2 m in front of the bench`)
  ok(can('goldwood_table', at(-2.5, 0).x, at(-2.5, 0).z).ok && can('goldwood_stool', at(1.6, D - 1.4).x, at(1.6, D - 1.4).z).ok, `turn ${q}: a table mid-floor, a stool beside the bench (both within the old 1.6 m)`)
  ok(can('stone_slab_wide', b.x, b.z).ok && can('stone_slab_wide', u.x, u.z).ok, `turn ${q}: a floor slab under the bench and on the use spot`)
  ok(can('goldwood_stool', b.x, b.z).why === 'That crowds the bench.' && can('goldwood_stool', b.x + 1.1 * (q % 2 ? 0 : 1), b.z + 1.1 * (q % 2 ? 1 : 0)).why === 'That crowds the bench.', `turn ${q}: a stool in the bench (middle, end) crowds it`)
  ok(can('goldwood_stool', u.x, u.z).why === 'That crowds the bench.' && can('goldwood_table', at(0, D - 3.2).x, at(0, D - 3.2).z).why === 'That crowds the bench.', `turn ${q}: a stool on the use spot, a table across it`)
  ok(can('goldwood_stool', at(0, D - 3.15).x, at(0, D - 3.15).z).ok, `turn ${q}: a stool just clear of the use spot`)
}
saveWorks(w); ok(loadWorks().rooms[0]?.shell === true, 'the shell flag survives reload')

console.log(`shell-rooms: ${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('  FAIL', f); if (fails.length) process.exit(1)
