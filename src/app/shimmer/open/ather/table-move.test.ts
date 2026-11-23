// BETA M96: the planning table is furniture. Run: npx tsx src/app/shimmer/open/ather/table-move.test.ts
import { freshWorks, tableAt, keepClear, nearWork, workPickables, canPlacePiece, placePiece, pickUpPiece, canPlace, loadWorks, saveWorks, TABLE, TABLE_ITEM, TABLE_KEEP_R, type Works } from './rooms'
import { meleeTarget, breakTarget, TABLE_HIT } from './melee'
import { placedRects } from './cover-clear'
import { idleSpot, IDLE_R } from './moglins-idle'
import { FURNITURE, PIECE_JOBS } from './furniture'
import { STARTING_SQUARES, GROUND_Y } from './plot'
import { newInv, give, countOf, OPEN_ITEMS } from '../shared/inventory'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const owned = new Set<string>(STARTING_SQUARES)
const eye = GROUND_Y + 1.62
const aim = (x: number, z: number, tx: number, tz: number, ty = GROUND_Y + 0.9): [[number, number, number], [number, number, number]] => {
  const d = [tx - x, ty - eye, tz - z], l = Math.hypot(...d); return [[x, eye, z], d.map(v => v / l) as [number, number, number]] }
const hasKeep = (w: Works, x: number, z: number) => keepClear(w).some(k => k.x === x && k.z === z && k.r === TABLE_KEEP_R)

// a keeper who never moved it: no change
const w0 = freshWorks()
ok(JSON.stringify(tableAt(w0)) === JSON.stringify({ x: TABLE.x, z: TABLE.z, q: 0 }), 'fresh: the table stands at its first spot')
ok(hasKeep(w0, TABLE.x, TABLE.z), 'fresh: its keep-clear stands round it')
ok(nearWork(w0, TABLE.x + 1, TABLE.z)?.kind === 'table', 'fresh: E reaches it')
ok(FURNITURE[TABLE_ITEM]?.gift === true && !PIECE_JOBS.some(j => j.id === TABLE_ITEM), 'never made at the bench')
ok(!!OPEN_ITEMS[TABLE_ITEM], 'it has a bag row')

// three hits: the melee ray finds it and the break lifts it into the bag
const [o, d] = aim(TABLE.x, TABLE.z + 2.2, TABLE.x, TABLE.z)
const t = meleeTarget(w0, o, d)
ok(t?.kind === 'table' && t.id === TABLE_HIT, `a swing at the table lands on it (${t?.kind})`)
const b = breakTarget(w0, { kind: 'table', id: TABLE_HIT }, newInv())
ok(!!b && b.works.tableMoved === true && countOf(b.inv, TABLE_ITEM) === 1, 'broken: 1 planning table in the bag, the save remembers')
const w1 = b!.works, inv1 = b!.inv
ok(tableAt(w1) === null && nearWork(w1, TABLE.x + 1, TABLE.z) === null, 'in the bag: nothing to E at the old spot')
ok(!workPickables(w1, () => GROUND_Y).some(p => p.item.kind === 'table'), 'in the bag: no table pickable')
ok(!hasKeep(w1, TABLE.x, TABLE.z), 'in the bag: the old keep-clear is gone')
ok(meleeTarget(w1, o, d)?.kind !== 'table', 'in the bag: a swing finds no table')
ok(breakTarget(w1, { kind: 'table', id: TABLE_HIT }, inv1) === null, 'a moved table cannot be broken out of thin air (no second table)')
ok(!placedRects(w1).some(r => Math.abs((r.x0 + r.x1) / 2 - TABLE.x) < 1e-9 && Math.abs((r.z0 + r.z1) / 2 - TABLE.z) < 1e-9), 'in the bag: the grass grows back on the old spot')
ok(canPlacePiece(w1, owned, 'goldwood_stool', TABLE.x, TABLE.z, 0).ok, 'the old spot is placeable after')
let full = newInv(); for (let i = 0; i < 64; i++) full = give(full, 'goldwood_log', 999).inv
ok(breakTarget(w0, { kind: 'table', id: TABLE_HIT }, full) === null, 'a full bag: the table stays')

// set it somewhere else: it works there
const at = { x: -100, z: 100 }
ok(canPlacePiece(w1, owned, TABLE_ITEM, at.x, at.z, 1, inv1).ok, 'the table sets from the bag on held ground')
const pl = placePiece(w1, owned, inv1, TABLE_ITEM, at.x, at.z, 1)!
const w2 = pl.works
ok(countOf(pl.inv, TABLE_ITEM) === 0 && JSON.stringify(tableAt(w2)) === JSON.stringify({ x: at.x, z: at.z, q: 1 }), 'set: it stands at the new spot, bag empty')
ok(nearWork(w2, at.x + 1, at.z)?.kind === 'table', 'set: E there is the planning table (blueprints open)')
ok(workPickables(w2, () => GROUND_Y).filter(p => p.item.kind === 'table').length === 1 && !workPickables(w2, () => GROUND_Y).some(p => p.item.kind === 'piece' && p.item.id === pl.piece.id), 'set: one table pickable, not also a plain piece')
ok(hasKeep(w2, at.x, at.z) && !hasKeep(w2, TABLE.x, TABLE.z), 'set: its keep-clear moved with it')
ok(!canPlacePiece(w2, owned, 'goldwood_stool', at.x + 2, at.z, 0).ok, 'set: the new keep-clear refuses a stool beside it')
ok(!canPlace(w2, owned, 'carpentry', at.x + 5, at.z, 0).ok, 'set: a room cannot crowd the moved table')
const two = give(pl.inv, TABLE_ITEM, 1).inv
ok((canPlacePiece(w2, owned, TABLE_ITEM, -120, 120, 0, two) as { why?: string }).why === 'Your planning table already stands.', 'one per keeper: a second never sets')
const store = new Map<string, string>(); (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } }
saveWorks(w2); const back = loadWorks()
ok(!!back && JSON.stringify(tableAt(back)) === JSON.stringify(tableAt(w2)), 'survives reload')
const sp = idleSpot(0, 1, tableAt(w2)!)
ok(Math.abs(Math.hypot(sp.x - at.x, sp.z - at.z) - IDLE_R) < 1e-9, 'idle Moglins wait round the moved table')

// and again: the moved table breaks like any piece
const up = pickUpPiece(w2, pl.piece.id, pl.inv)
ok(!!up && countOf(up.inv, TABLE_ITEM) === 1 && tableAt(up.works) === null, 'the moved table picks up like furniture')

console.log(`table-move: ${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('  FAIL', f); if (fails.length) process.exit(1)
