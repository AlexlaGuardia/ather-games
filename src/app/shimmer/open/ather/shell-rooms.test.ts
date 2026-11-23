// BETA M97 s1: rooms are SHELLS (floor + door frame + working bits, no walls or roof). Run: npx tsx src/app/shimmer/open/ather/shell-rooms.test.ts
import { place, wallsOf, benchOf, doorOf, benchBox, toWorld, canPlacePiece, nearWork, freshWorks, loadWorks, saveWorks, ROOMS, FRAME_H, DOOR_W, type Works, type Room } from './rooms'
import { STARTING_SQUARES, GROUND_Y } from './plot'
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
  const rr: Room = { ...r, q }, ws = wallsOf(rr), d = doorOf(rr), b = benchOf(rr)
  const inWall = (x: number, z: number) => ws.some(k => x > k.x0 && x < k.x1 && z > k.z0 && z < k.z1)
  ok(ws.length === 2 && ws.every(k => k.y0 < GROUND_Y && Math.abs(k.y1 - (GROUND_Y + FRAME_H)) < 1e-9), `turn ${q}: a shell is solid at its two door posts only`)
  ok(!inWall(d.x, d.z) && !inWall(b.x, b.z), `turn ${q}: the doorway and the bench are open`)
  const post = toWorld(rr, DOOR_W / 2 + 0.12, -ROOMS.rinnshop.d / 2)
  ok(inWall(post.x, post.z), `turn ${q}: a post stands beside the doorway`)
  const back = toWorld(rr, 0, ROOMS.rinnshop.d / 2), side = toWorld(rr, ROOMS.rinnshop.w / 2, 0)
  ok(!inWall(back.x, back.z) && !inWall(side.x, side.z), `turn ${q}: no back or side wall`)
  const bb = benchBox(rr); ok(b.x > bb.x0 && b.x < bb.x1 && b.z > bb.z0 && b.z < bb.z1 && bb.x1 - bb.x0 > 0.7, `turn ${q}: the bench box sits on the bench`)
}
// the keeper builds round it: furniture where the back wall used to be is fine now, the doorway still refuses
const back = toWorld(r, 1.5, ROOMS.rinnshop.d / 2)
ok(canPlacePiece(w, owned, 'goldwood_stool', back.x, back.z, 0).ok, 'a stool on the old back-wall line sets (no wall there)')
const d = doorOf(r)
ok(!canPlacePiece(w, owned, 'goldwood_stool', d.x, d.z, 0).ok, 'the doorway still refuses')
ok(nearWork(w, benchOf(r).x, benchOf(r).z, r.doneAt + 1)?.kind === 'bench', 'the bench still works')
// an older room keeps its walls
ok(wallsOf({ ...r, shell: undefined }).length === 5, 'an older room (no shell flag) keeps its five walls')
// survives reload
const store = new Map<string, string>(); (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } }
saveWorks(w); ok(loadWorks().rooms[0]?.shell === true, 'the shell flag survives reload')

console.log(`shell-rooms: ${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('  FAIL', f); if (fails.length) process.exit(1)
