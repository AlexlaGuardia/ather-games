// BETA M169 s3: stairs (railing optional), railings, a fence + gate in the same rail style, a ramp, in the one building catalog.
// The walker is the real one (shared/locomotion on terrain-world) on the pieces' own walker boxes (rooms.ts pieceBoxes).
// Run: npx tsx src/app/shimmer/open/ather/build-stairs.test.ts
import { buildCatalog, buildBoxes, buildSolids, pieceIcon, opens, STAIR, RAMP, RAIL, CREATIVE_OPEN } from './build-catalog'
import { FURNITURE } from './furniture'
import { SCENERY_BY, sceneryBoxes } from './scenery'
import { planPiece, pieceBoxes, toggleOpen, nearWork, loadWorks, saveWorks, KEEP_CLEAR, type Works } from './rooms'
import { buildAll, plannedNeeds } from './plot-bom'
import { plotFootprints, footBlocked } from './obstacles'
import { newInv, give, countOf } from '../shared/inventory'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from './plot'
import { terrainWorld, type Box } from '../terrain-world'
import { createLoco, tickLocomotion, type LocoInput } from '../shared/locomotion'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const J = JSON.stringify, near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e
const STAIRS = ['stair', 'stair_rail_left', 'stair_rail_right', 'stair_railed'], RAILS = ['railing', 'railing_wide', 'fence', 'fence_gate'], NEW = [...STAIRS, ...RAILS, 'ramp']

// ── the catalog: Stairs, Railings + fences, Ramps + ladders, plain nouns, in Creative's Build too ──
const cat = Object.fromEntries(buildCatalog().map(g => [g.sub, g.ids]))
ok(J(cat.Stairs) === J(STAIRS), `Stairs (${cat.Stairs})`)
ok(J(cat['Railings + fences']) === J(RAILS), `Railings + fences (${cat['Railings + fences']})`)
ok(J(cat['Ramps + ladders']) === J(['ramp']), `Ramps + ladders (${cat['Ramps + ladders']})`)
for (const id of NEW) ok(SCENERY_BY.get(`piece:${id}`)?.group === 'Build' && SCENERY_BY.get(`piece:${id}`)?.sub === FURNITURE[id].build, `${id}: in Creative's Build, same sub-category`)

// ── sizes: the stair climbs the 4.8 m wall top in steps the walker takes (rise <= 0.5); NOTES: 0.5 m deep, 2 m wide, 6 m long ──
ok(STAIR.rise <= 0.5 && near(STAIR.steps * STAIR.rise, FURNITURE.goldwood_panel.h) && near(STAIR.steps * STAIR.tread, FURNITURE.stair.d) && FURNITURE.stair.w === 2, `stair: ${STAIR.steps} x ${STAIR.rise} m = the wall top, ${FURNITURE.stair.d} m run`)
ok(STAIRS.every(id => FURNITURE[id].w === 2 && FURNITURE[id].d === 6 && FURNITURE[id].h === 4.8), 'every stair the same size')
ok(RAMP.rise <= 0.5 && near(RAMP.strips * RAMP.rise, FURNITURE.ramp.h), 'ramp: its strips rise to its height, each under a step')
const box = (id: string, open = false) => buildBoxes(FURNITURE[id], open)!
const top = (id: string) => Math.max(...box(id).map(b => b.p[1] + b.s[1] / 2))
ok(near(top('stair'), 4.8) && near(top('stair_railed'), 4.8 + RAIL.h) && near(top('railing'), RAIL.h + 0.04) && near(top('fence'), top('railing')) && near(top('fence_gate'), top('railing')), 'one rail height: the stair\'s railings, the railing, the fence, the gate')
// one rail style: the railing's posts and the stair's posts are the same section and colour
{ const post = (id: string) => box(id).filter(b => near(b.s[0], RAIL.post) && near(b.s[2], RAIL.post) && near(b.s[1], RAIL.h)).map(b => b.c)
  ok(post('railing').length >= 2 && post('stair_railed').length >= 12 && post('fence').length >= 3 && post('fence_gate').length === 2 && new Set([...post('railing'), ...post('stair_railed'), ...post('fence'), ...post('fence_gate')]).size === 1, 'the stair, railing, fence and gate share one post') }
ok(box('stair_rail_left').filter(b => b.p[0] < -0.5 && b.p[1] > 0.5 + 0.4).length > 0 && !box('stair_rail_left').some(b => b.p[0] > 0.9 && b.p[1] > 4.8), 'left railing on the left only (climbing toward -z)')
ok(J(box('fence_gate')) !== J(box('fence_gate', true)) && J(box('fence')) === J(box('fence', true)), 'only the gate changes when open')
ok(NEW.every(id => opens(FURNITURE[id]) === (id === 'fence_gate')), 'only the gate opens')

// ── the real walker on the pieces' boxes ──
const own = new Set(STARTING_SQUARES), held = (x: number, z: number) => { const s = squareAt(x, z); return !!s && own.has(sqId(s.i, s.j)) }
let X = 0, Z = 0
find: for (let z = -150; z < 150; z++) for (let x = -150; x < 150; x++) if ([[-8, -8], [8, -8], [-8, 8], [8, 8], [0, 0]].every(([a, b]) => held(x + a, z + b)) && KEEP_CLEAR.every(c => Math.hypot(c.x - x, c.z - z) > c.r + 10)) { X = x; Z = z; break find }
const base = (): Works => ({ v: 1, rooms: [], chests: [], pieces: [] })
const plan = (w: Works, item: string, dx: number, dz: number, q = 0) => { const r = planPiece(w, own, item, X + dx, Z + dz, q); if ('why' in r) throw new Error(`${item}: ${r.why}`); return r.works }
const stand = (w: Works) => ({ ...w, pieces: [...w.pieces, ...(w.planned ?? [])], planned: undefined }) as Works
const input = (o: Partial<LocoInput> = {}): LocoInput => ({ mvX: 0, mvZ: 0, fwdX: 0, fwdZ: -1, rightX: 1, rightZ: 0, jumpKey: false, crouchKey: false, dt: 1 / 60, ...o })
const worldOf = (w: Works) => { const bx: Box[] = pieceBoxes(w); return terrainWorld({ ground: () => GROUND_Y, solids: () => bx, water: () => [] }) }
/** walk (mvX, mvZ) for t seconds from (x, z) on the ground; the keeper's last spot */
/** walk (mvX, mvZ) for t seconds (or until `stop`) from (x, z) on the ground; the keeper's spot then, and the highest her feet got */
const walk = (w: Works, x: number, z: number, mv: [number, number], t: number, from?: { raw: ReturnType<typeof createLoco> }, stop?: (z: number) => boolean) => {
  const world = worldOf(w), lc = from?.raw ?? createLoco(x, GROUND_Y, z); let top = lc.py
  if (!from) for (let k = 0; k < 60; k++) tickLocomotion(lc, input(), world)
  for (let k = 0; k < 60 * t && !stop?.(lc.pz); k++) { tickLocomotion(lc, input({ mvX: mv[0], mvZ: mv[1], fwdX: mv[0] || 0, fwdZ: mv[1] || -1, rightX: 1, rightZ: 0 }), world); top = Math.max(top, lc.py) }
  if (stop) for (let k = 0; k < 30; k++) tickLocomotion(lc, input(), world)   // stand still: settle on the step
  return { px: lc.px, pz: lc.pz, py: lc.py - GROUND_Y, top: top - GROUND_Y, raw: lc }
}
const MID = (z: number) => z < Z + 0.5   // half way up a stair at (X, Z): step 6, feet 2.4 m
// a stair with its back flush to a wall panel: walk up it and on to the wall top
let w = plan(base(), 'stair_railed', 0, 0); w = plan(w, 'goldwood_panel', 0, -3.15); w = plan(w, 'goldwood_panel', 1, -3.15, 0)
ok(w.planned!.length === 3, 'a stair stands flush against a wall')
{ const s = stand(w), lc = walk(s, X, Z + 4, [0, -1], 6)
  ok(lc.top > 4.7 && lc.top < 4.9, `the walker climbs the stair to the wall top (feet up to ${lc.top.toFixed(2)})`)
  // the railings stop a fall: half way up, push left, then right
  const mid = walk(s, X, Z + 4, [0, -1], 4, undefined, MID), y0 = mid.py
  const l = walk(s, 0, 0, [-1, 0], 2, mid); ok(l.px > X - 1 && l.py > y0 - 0.45, `railed: pushing left she stays on the stair (x ${(l.px - X).toFixed(2)}, feet ${l.py.toFixed(2)} from ${y0.toFixed(2)})`)
  const r = walk(s, 0, 0, [1, 0], 3, l); ok(r.px < X + 1 && r.py > y0 - 0.45, `railed: pushing right she stays on the stair (x ${(r.px - X).toFixed(2)})`) }
{ const bare = stand(plan(base(), 'stair', 0, 0)), mid = walk(bare, X, Z + 4, [0, -1], 4, undefined, MID), y0 = mid.py, off = walk(bare, 0, 0, [-1, 0], 2, mid)
  ok(y0 > 1 && off.px < X - 1.2 && off.py < y0 - 0.45, `no railing: pushing left she walks off the side (x ${(off.px - X).toFixed(2)}, feet ${off.py.toFixed(2)} from ${y0.toFixed(2)})`)
  const lft = stand(plan(base(), 'stair_rail_left', 0, 0)), m2 = walk(lft, X, Z + 4, [0, -1], 4, undefined, MID)
  ok(walk(lft, 0, 0, [-1, 0], 2, m2).px > X - 1 && walk(lft, 0, 0, [1, 0], 2, walk(lft, X, Z + 4, [0, -1], 4, undefined, MID)).px > X + 1.2, 'left railing: held on the left, open on the right') }
// the ramp
{ const s = stand(plan(base(), 'ramp', 0, 0)), lc = walk(s, X, Z + 3, [0, -1], 1.2)
  ok(lc.py > 0.4 && lc.py < 1.25, `half way up the ramp (feet ${lc.py.toFixed(2)})`)
  const t = walk(s, X, Z + 3, [0, -1], 1.6); ok(t.py > 1.0 || t.pz < Z - 2, `up the ramp (feet ${t.py.toFixed(2)} at z ${(t.pz - Z).toFixed(2)})`) }
// a railing and a fence are in the way; a gate: shut blocks, E opens, open lets her through
{ let f = plan(base(), 'fence', -1.6, 0); f = plan(f, 'fence_gate', 0, 0); f = plan(f, 'fence', 1.6, 0); f = plan(f, 'railing_wide', 0, 4)
  const s = stand(f), g = s.pieces.find(p => p.item === 'fence_gate')!
  ok(walk(s, X - 1.6, Z + 2, [0, -1], 2).pz > Z, 'the fence stops the keeper')
  ok(walk(s, X, Z + 2, [0, -1], 2).pz > Z, 'the shut gate stops the keeper')
  ok(walk(s, X, Z + 2, [0, 1], 1.5).pz < Z + 4, 'the railing stops the keeper')
  ok(nearWork(s, g.x, g.z + 1.2)?.kind === 'piece', 'E reaches the gate')
  const o = toggleOpen(s, g.id, { x: g.x, z: g.z + 1.5 }); ok(!!o && 'works' in o && o.works.pieces.find(p => p.id === g.id)!.open === true, 'E opens the gate')
  const so = (o as { works: Works }).works
  ok(walk(so, X, Z + 2, [0, -1], 2).pz < Z - 0.6, 'open, she walks through the gateway')
  ok(walk(so, X - 1.6, Z + 2, [0, -1], 2).pz > Z, 'the fence beside it still stops her')
  ok('why' in (toggleOpen(so, g.id, { x: g.x, z: g.z })!), 'shutting refuses while she stands in the gateway')
  const sh = toggleOpen(so, g.id, { x: g.x, z: g.z + 2 }); ok(!!sh && 'works' in sh && walk(sh.works, X, Z + 2, [0, -1], 2).pz > Z, 'E again shuts it: blocks again')
  // a spirit (obstacles): round the shut gate, through the open one, never through a stair
  ok(footBlocked(plotFootprints(s.pieces), g.x, g.z, 0.3) && !footBlocked(plotFootprints(so.pieces), g.x, g.z, 0.3), 'a spirit: a shut gate is in her way, an open one is not')
  const st = stand(plan(base(), 'stair', 0, 0)).pieces
  ok(footBlocked(plotFootprints(st), X, Z, 0.3) && footBlocked(plotFootprints(st), X, Z + 2.8, 0.3) && !footBlocked(plotFootprints(st), X + 1.5, Z, 0.3), 'a spirit walks round a stair, not through it')
  // reload keeps the gate open
  const store: Record<string, string> = {}; (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem() {}, key: () => null, length: 0 }
  saveWorks(so); ok(loadWorks().pieces.find(p => p.id === g.id)?.open === true, 'reload: the gate stays open') }

// ── plan, pay, build ──
{ let b = plan(base(), 'stair', -4, 0); b = plan(b, 'stair_rail_left', -1.5, 0); b = plan(b, 'stair_rail_right', 1, 0); b = plan(b, 'stair_railed', 3.5, 0)
  b = plan(b, 'railing', -4, 5); b = plan(b, 'railing_wide', -2.5, 5); b = plan(b, 'fence', -0.5, 5); b = plan(b, 'fence_gate', 1.1, 5); b = plan(b, 'ramp', 5, 7)
  const bill = Object.fromEntries(plannedNeeds(b.planned).map(c => [c.id, c.n]))
  ok(J(bill) === J({ goldwood_plank: 12 + 15 + 15 + 18 + 1 + 2 + 2 + 2 + 10 }), `the bill (${J(bill)})`)
  const inv = give(newInv(), 'goldwood_plank', bill.goldwood_plank).inv
  ok(!buildAll(b, give(newInv(), 'goldwood_plank', bill.goldwood_plank - 1).inv, null).ok, 'a plank short: no Build')
  const r = buildAll(b, inv, null); ok(r.ok && r.works.pieces.length === 9 && countOf(r.inv, 'goldwood_plank') === 0, 'Build pays exactly that, all 9 stand') }

// ── Creative: the stair blocks by its steps, the gate stands open ──
{ const at = (k: string) => sceneryBoxes([{ id: 'a', k, x: 0, z: 0, q: 0, s: 1, y: 0 }] as any)
  ok(CREATIVE_OPEN && at('piece:stair').length === STAIR.steps && at('piece:stair_railed').length === STAIR.steps * 3 && at('piece:fence_gate').length === 2 && at('piece:ramp').length === RAMP.strips, 'Creative: a stair by its steps (+ rails), the gate open (its posts), the ramp by its strips') }
ok(J(buildSolids(FURNITURE.fence)) === J([{ x: 0, z: 0, w: 2, d: 0.12, h: 1.04 }]), 'a fence blocks along its length')

// ── icons: one per piece, from its own boxes, no two alike ──
{ const ics = NEW.map(id => pieceIcon(id).map(f => f.d).join())
  ok(NEW.every((id, k) => ics[k].length > 0 && pieceIcon(id).length === box(id).length * 3), 'every new piece has its icon, a face per side per box')
  ok(new Set(ics).size === NEW.length, 'no two icons alike') }

console.log(`build-stairs: ${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL', f); process.exit(1) }
