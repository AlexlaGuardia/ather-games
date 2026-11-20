// Run: npx tsx src/app/shimmer/open/towns/deed-plots.test.ts
// M49 slice 1: deed grids + per-town palettes, the deed's blueprint (valid, fits the grid, door gap, palette), the levelled ground.
import { DEED_GRID, TOWN_PALETTES, makeDeed, deedBlueprint, deedGround, deedPad } from './deed-plots'
import { placeBlueprint, houseProblems } from '../ather/plot-blueprint'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const at = { x: 100, z: 50, yaw: 0.7, level: 12, base: 10 }
ok(DEED_GRID.shipyard.w === 12 && DEED_GRID.shipyard.d === 8 && DEED_GRID.shop.w === 8 && DEED_GRID.shop.d === 6, 'hub default grids')
for (const t of ['citadel', 'gale-haven', 'veradyn', 'rune-hold']) ok(TOWN_PALETTES[t]?.length === 3, `${t}: 3 palettes`)
for (const kind of ['shipyard', 'shop'] as const) for (let p = 0; p < 3; p++) {
  const d = makeDeed('t', 'veradyn', kind, at, p), bp = deedBlueprint(d)
  ok(houseProblems(bp).length === 0, `${kind}/${p}: blueprint valid ${houseProblems(bp).join(',')}`)
  ok(bp.w <= d.w - 2 && bp.d <= d.d - 2, `${kind}/${p}: fits the grid with a margin`)
  ok(Object.values(bp.walls).filter(w => w.kind === 'door').length === 2, `${kind}/${p}: a 2-wide door gap`)
  ok(Object.values(bp.walls).every(w => w.mat === d.palettes[p].mat), `${kind}/${p}: follows the palette`)
}
{
  const d = makeDeed('t', 'rune-hold', 'shipyard', at), pl = placeBlueprint(deedBlueprint(d), deedPad(d))
  for (const [u, v] of [[0, 0], [10, 0], [10, 6], [0, 6]]) { const q = pl.toWorld(u, v); ok(deedGround(d, q.x, q.z) === 12, `corner ${u},${v} at level`) }
  ok(deedGround(d, 100, 50) === 12, 'centre at level')
  const o = pl.toWorld(5, -5); ok(deedGround(d, o.x, o.z) < 12 && deedGround(d, o.x, o.z) > 10, 'skirt banks down')
  ok(deedGround(d, 500, 500) === -Infinity, 'nothing beyond')
}
{ const d = makeDeed('t', 'nowhere', 'shop', at, 9); ok(d.palettes.length === 3 && d.palette === 2, 'unknown town falls back; index clamps') }
console.log(fails.length ? `FAIL ${fails.length}\n${fails.join('\n')}` : `deed-plots ${pass}/0`)
process.exit(fails.length ? 1 : 0)
