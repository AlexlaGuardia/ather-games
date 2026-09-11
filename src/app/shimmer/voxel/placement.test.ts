// ★ PLACEMENT ROWS, GUARDED. Run: npx tsx src/app/shimmer/voxel/placement.test.ts
//
// Shape (`placementProblems`) and ground (`placementSiteProblems`) are the two halves the route and
// the worktable's button judge through; this pins both, then reads the wiring at the source: the
// button posts to the route, the route exports the verbs, the blueprint route regenerates the index,
// and prebuild regenerates it before the worker bundle that imports it.
import { readFileSync } from 'fs'
import { join } from 'path'
import { placementProblems, placementSiteProblems } from './placement'
import { makeBlueprint } from './blueprints'
import { MAT } from './depth'
import type { Stamp } from './stamps'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const ids = new Set(['hut'])
const good = { id: 'my-hut', blueprint: 'hut', x: 10, z: -20, rot: 1 }

ok(placementProblems(good, ids).length === 0, `a well-formed row has no problems (${placementProblems(good, ids).join('; ')})`)
ok(placementProblems({ ...good, id: 'Bad Id!' }, ids).some(m => /id must match/.test(m)), 'a bad id is refused')
ok(placementProblems({ ...good, blueprint: 'ghost' }, ids).some(m => /no blueprint 'ghost'/.test(m)), 'a blueprint that is not on disk is refused, by name')
ok(placementProblems({ ...good, x: 1.5 }, ids).some(m => /integer/.test(m)), 'a fractional column is refused')
ok(placementProblems({ ...good, rot: 4 }, ids).some(m => /rot must be 0-3/.test(m)), 'rot 4 is refused')
ok(placementProblems({ ...good, sink: -1 }, ids).some(m => /sink/.test(m)), 'a negative sink is refused')
ok(placementProblems(null, ids).length === 1, 'null is one problem, not a crash')

const bp = makeBlueprint('hut', 'Hut', [{ x: 0, y: 0, z: 0, m: MAT.CUT_STONE }, { x: 4, y: 0, z: 4, m: MAT.CUT_STONE }])
const stamp: Stamp = { id: 'my-hut', bp, x: 100, z: 100, rot: 0 }
const flat = { surfaceAt: () => 50, roadAt: () => false, seaLevel: 10 }
ok(placementSiteProblems(stamp, flat).length === 0, 'flat, dry, off-road ground has no problems')
ok(placementSiteProblems(stamp, { ...flat, surfaceAt: (x: number) => (x >= 102 ? 52 : 50) }).some(m => /steps 2/.test(m)), 'a pad that steps 2 is refused, with the number')
ok(placementSiteProblems(stamp, { ...flat, roadAt: (x: number, z: number) => x === 99 && z === 100 }).some(m => /story road/.test(m)), 'the road within the one-block margin is refused')
ok(placementSiteProblems(stamp, { ...flat, surfaceAt: (x: number) => (x === 104 ? 5 : 50) }).some(m => /under water/.test(m)), 'water under any footprint cell is refused')
ok(placementSiteProblems(stamp, { ...flat, reserved: [{ x: 102, z: 102, name: 'Greg' }] }).some(m => /stand on Greg/.test(m)), 'a reserved cell is refused by name')
ok(placementSiteProblems(stamp, { ...flat, reserved: [{ x: 120, z: 120, name: 'Greg' }] }).length === 0, 'a reserved cell elsewhere is not')

{
  const strip = (raw: string) => raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const at = (p: string) => strip(readFileSync(join(process.cwd(), p), 'utf-8'))
  const page = at('src/app/shimmer/dev/worktable/page.tsx')
  ok(/fetch\('\/shimmer\/save-placement'/.test(page) && /method: 'PUT'/.test(page), 'the worktable PUTs to /shimmer/save-placement')
  ok(/place in world/.test(page), 'the button exists on the page')
  ok(/next deploy/.test(page), '★ the page says a placement is live at the next deploy — "I placed it and nothing happened" is the first bug otherwise')
  const route = at('src/app/shimmer/save-placement/route.ts')
  for (const v of ['GET', 'PUT', 'DELETE']) ok(new RegExp(`export async function ${v}`).test(route), `the route exports ${v}`)
  ok(/placementProblems\(/.test(route) && /placementSiteProblems\(/.test(route), 'the route judges shape AND ground through the shared functions')
  ok(/writeIndex\(\)/.test(route), 'the route regenerates the blueprint index after a write')
  const bpRoute = at('src/app/shimmer/save-blueprint/route.ts')
  ok((bpRoute.match(/writeIndex\(\)/g) ?? []).length >= 2, 'save-blueprint regenerates the index on PUT and DELETE')
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))
  ok(/gen-blueprints\.mts.*build-worker\.mjs/.test(pkg.scripts.prebuild), '★ prebuild regenerates the index BEFORE bundling the worker that imports it')
  const proxy = at('src/proxy.ts')
  ok(/\/shimmer\/save-/.test(proxy), 'the owner gate still covers /shimmer/save-* (the route name is the security)')
}

console.log(`\nplacement: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
