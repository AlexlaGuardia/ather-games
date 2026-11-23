// Melee (BETA M42). Run: npx tsx src/app/shimmer/open/ather/melee.test.ts
import { meleeTarget, strike, canSwing, breakTarget, rayBox, MELEE_HITS, MELEE_REACH, MELEE_CD_MS, MELEE_RESET_MS } from './melee'
import { freshWorks, type Works } from './rooms'
import { GROUND_Y } from './plot'
import { newInv, give, countOf } from '../shared/inventory'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const eye = GROUND_Y + 1.62
const w: Works = { ...freshWorks(), pieces: [{ id: 's1', item: 'goldwood_stool', x: 0, z: -1.5, q: 0, placedAt: 1 }],
  chests: [{ id: 'k1', x: 3, z: -1.5, q: 0, placedAt: 1 }] }
const look = (x: number, z: number, tx: number, ty: number, tz: number): [[number, number, number], [number, number, number]] => {
  const d = [tx - x, ty - eye, tz - z], l = Math.hypot(...d); return [[x, eye, z], d.map(v => v / l) as [number, number, number]] }

// aim
{ const [o, d] = look(0, 0, 0, GROUND_Y + 0.3, -1.5); const t = meleeTarget(w, o, d)
  ok(t?.kind === 'piece' && t.id === 's1', `aiming at the stool hits it (${JSON.stringify(t)})`) }
{ const [o, d] = look(3, 0, 3, GROUND_Y + 0.6, -1.5); ok(meleeTarget(w, o, d)?.id === 'k1', 'aiming at a placed Keepstone hits it') }
{ const [o, d] = look(0, 3, 0, GROUND_Y + 0.3, -1.5); ok(meleeTarget(w, o, d) === null, `out of reach (> ${MELEE_REACH} m) hits nothing`) }
{ const [o, d] = look(0, 0, 0, eye + 2, -3); ok(meleeTarget(w, o, d) === null, 'looking over it hits nothing') }
{ const sw = { ...freshWorks() }; const [o, d] = look(0, 0, 0, GROUND_Y + 0.3, -1.5); ok(meleeTarget(sw, o, d) === null, 'the starter Keepstone / an empty plot: nothing to hit') }
ok(rayBox([0, 0, 0], [1, 0, 0], { x0: 2, x1: 3, y0: -1, y1: 1, z0: -1, z1: 1 }) === 2, 'ray-box distance')

// hit counter
let h = null as ReturnType<typeof strike>['hits'], r = strike(h, 's1', 1000)
ok(r.n === 1 && !r.broke, 'first hit counts 1'); h = r.hits
r = strike(h, 's1', 1600); ok(r.n === 2 && !r.broke, 'second hit counts 2'); h = r.hits
r = strike(h, 's1', 2200); ok(r.n === MELEE_HITS && r.broke && r.hits === null, 'third hit breaks it, the count clears')
r = strike({ id: 's1', n: 2, at: 0 }, 's1', MELEE_RESET_MS + 1); ok(r.n === 1 && !r.broke, 'a long pause resets the count')
r = strike({ id: 's1', n: 2, at: 0 }, 'k1', 100); ok(r.n === 1, 'a new target starts at 1')
ok(!canSwing(1000, 1000 + MELEE_CD_MS - 1) && canSwing(1000, 1000 + MELEE_CD_MS), 'swing cooldown')

// refund
{ const inv = newInv(), b = breakTarget(w, { kind: 'piece', id: 's1' }, inv, {})
  ok(!!b && b !== 'spirit' && b.works.pieces.length === 0 && countOf(b.inv, 'goldwood_stool') === 1, 'a broken stool comes back to the bag whole')
  const c = breakTarget(w, { kind: 'chest', id: 'k1' }, inv, {})
  ok(!!c && c !== 'spirit' && c.works.chests.length === 0 && c.works.pieces.length === 1, 'a broken placed Keepstone comes back, the rest stands')
  let full = newInv(); for (let i = 0; i < 64; i++) full = give(full, 'goldwood_log', 999).inv
  ok(breakTarget(w, { kind: 'piece', id: 's1' }, full, {}) === null, 'a full bag: nothing moves') }

console.log(`melee: ${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('  FAIL', f); if (fails.length) process.exit(1)
