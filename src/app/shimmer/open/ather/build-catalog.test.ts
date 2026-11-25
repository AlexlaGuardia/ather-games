// BETA M169 s1: ONE building catalog for the garden's planning mode and Creative's Place palette.
// Run: npx tsx src/app/shimmer/open/ather/build-catalog.test.ts
import { BUILD_PIECES, buildCatalog, buildBoxes, pieceIcon } from './build-catalog'
import { BUILD_SUBS, FURNITURE, FURNITURE_ORDER, PLAN_PIECES, isPlanned, type PieceDef } from './furniture'
import { SCENERY, SCENERY_BY, SCENERY_GROUPS } from './scenery'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i])

// s1 = nothing new: today's 4 floor slabs + 4 wall panels, moved out of Furniture
const cat = buildCatalog()
ok(same(cat.map(g => g.sub), ['Floors', 'Walls']), `only the filled sub-categories show (${cat.map(g => g.sub)})`)
ok(same(cat[0].ids, ['goldwood_slab', 'goldwood_slab_wide', 'stone_slab', 'stone_slab_wide']), 'Floors = the 4 slabs')
ok(same(cat[1].ids, ['goldwood_panel', 'goldwood_panel_wide', 'brick_panel', 'brick_panel_wide']), 'Walls = the 4 panels')
ok(FURNITURE_ORDER.every(id => !!FURNITURE[id].build === !!(FURNITURE[id].slab || FURNITURE[id].panel)), 'every slab and panel is a building piece, nothing else is (s1)')
ok(!FURNITURE.ruin_column.build, 'the Salvaged Column stays Furniture: a shop piece with no recipe cannot be planned and paid')
ok(cat.every(g => (BUILD_SUBS as readonly string[]).includes(g.sub)), 'sub-categories are Alex\'s list')

// the garden: its plan catalog IS the building catalog
ok(same(PLAN_PIECES, BUILD_PIECES), 'the garden plans exactly the building catalog\'s pieces, in its order')
ok(BUILD_PIECES.every(isPlanned) && FURNITURE_ORDER.filter(isPlanned).length === BUILD_PIECES.length, 'isPlanned = in the building catalog')

// Creative: a 'Build' group, apart from Furniture, by the same sub-categories
ok(SCENERY_GROUPS.includes('Build') && SCENERY_GROUPS.indexOf('Build') < SCENERY_GROUPS.indexOf('Furniture'), 'Build is its own group, before Furniture')
for (const g of cat) ok(same(SCENERY.filter(s => s.group === 'Build' && s.sub === g.sub).map(s => s.k), g.ids.map(id => `piece:${id}`)), `Creative's ${g.sub} = the garden's ${g.sub}`)
ok(SCENERY.filter(s => s.group === 'Build').length === BUILD_PIECES.length, 'nothing else under Build')
ok(SCENERY.filter(s => s.group === 'Furniture').every(s => !s.sub && !BUILD_PIECES.includes(s.k.slice(6))), 'no building piece left in Furniture')
ok(SCENERY_BY.size === SCENERY.length, 'no piece in two groups (one row per key)')
ok(BUILD_PIECES.every(id => SCENERY_BY.get(`piece:${id}`)?.group === 'Build'), 'saved keys unchanged: piece:<id>')

// a piece added later shows in both places with no second list
const plus: Record<string, PieceDef> = { ...FURNITURE, test_door: { name: 'T', blurb: '', recipe: [{ id: 'goldwood_plank', n: 1 }], w: 1, d: 0.2, h: 2, solid: true, wood: 'goldwood', panel: true, build: 'Doors' } }
const cat2 = buildCatalog(plus, [...FURNITURE_ORDER, 'test_door'])
ok(same(cat2.map(g => g.sub), ['Floors', 'Walls', 'Doors']) && same(cat2[2].ids, ['test_door']), 'a new `build` piece makes its sub-category appear')

// every piece has an icon, drawn from the boxes the game draws it with
for (const id of BUILD_PIECES) {
  const bx = buildBoxes(FURNITURE[id]), ic = pieceIcon(id)
  ok(!!bx && bx.length > 0 && ic.length === bx.length * 3, `${id}: an icon face for each visible side of each box`)
  ok(ic.every(f => /^M[\d. L]+Z$/.test(f.d) && /^#[0-9a-f]{6}$/.test(f.fill)), `${id}: icon paths are clean`)
  const nums = ic.flatMap(f => f.d.match(/[\d.]+/g)!.map(Number))
  ok(nums.every(n => n >= 0 && n <= 40), `${id}: icon inside its box`)
}
ok(pieceIcon('goldwood_slab').map(f => f.d).join() !== pieceIcon('goldwood_panel').map(f => f.d).join(), 'a floor and a wall do not look alike')
ok(pieceIcon('goldwood_stool').length === 0, 'furniture draws no building icon')
// the 3D piece reads the same boxes (workshop.tsx PieceBody): a panel = wall + sill + cap, a wide goldwood slab = body + 5 seams
ok(buildBoxes(FURNITURE.goldwood_panel)!.length === 3 && buildBoxes(FURNITURE.goldwood_slab_wide)!.length === 6 && buildBoxes(FURNITURE.stone_slab_wide)!.length === 3, 'box counts match the M98b look')
ok(buildBoxes(FURNITURE.brick_panel)![0].c === '#a4573f', 'brick keeps its tint')

console.log(`build-catalog: ${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL', f); process.exit(1) }
