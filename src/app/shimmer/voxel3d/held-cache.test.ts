/**
 * THE CACHE THAT HELD COMES HOME (2026-09-29): a chest in every way but its look, never crafted, and delivered from an
 * expedition through a mailbox that never loses one to a full bag. Run: `npx tsx src/app/shimmer/voxel3d/held-cache.test.ts`
 */
import { readFileSync } from 'node:fs'
import { MAT, isChest } from '../voxel/depth'
import { blockDef } from '../voxel/registry'
import { RECIPES } from '../voxel/recipes'
import { recordFind, heldCachesWaiting, deliverHeldCaches, loadFinds } from '../play3d/expedition-bank'
// the bank reads storage at call time, so a shim set before the first call is enough
const mem = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v) }, removeItem: (k: string) => { mem.delete(k) }, key: () => null, length: 0 }

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

ok(isChest(MAT.CHEST) && isChest(MAT.HELD_CACHE) && !isChest(MAT.CACHE), '★ both are chests; the warren/loot CACHE is not (canon: a cache is never a chest)')
const d = blockDef(MAT.HELD_CACHE)
ok(!!d && d.placeable && d.drops[0]?.itemId === 'held_cache' && d.name === 'Held Cache', 'it places, and breaks back into itself')
ok(!(RECIPES as { output?: { itemId: string } }[]).some((r) => r.output?.itemId === 'held_cache'), '★ it cannot be crafted: the only road is an expedition')

// the mailbox
recordFind({ kind: 'held-cache', at: 1, seed: 1 }); recordFind({ kind: 'held-cache', at: 2, seed: 2 }); recordFind({ kind: 'held-cache', at: 3, seed: 3 })
ok(heldCachesWaiting() === 3, 'three held caches wait')
deliverHeldCaches(2)
ok(heldCachesWaiting() === 1 && loadFinds().length === 1, '★ a bag that took two leaves the third waiting (a full bag never eats a find)')
deliverHeldCaches(5)
ok(heldCachesWaiting() === 0, 'delivering more than waits is safe')

const vw = readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8')
ok(!/=== MAT\.CHEST/.test(vw), '★ no site in the world tests `=== MAT.CHEST` any more: a held cache opens, counts, spills and caps like a chest')
ok((vw.match(/void countChests\(\)/g) || []).length === 3, 'the plot census counts both kinds, at all three places it is taken')
ok(vw.includes("const took = waiting - give(inv.current, 'held_cache', waiting)") && vw.includes('deliverHeldCaches(took)'), 'on load the waiting caches go in the bag, and only what went in leaves the mailbox')
const ia = readFileSync(new URL('./interact.ts', import.meta.url), 'utf8')
ok(ia.includes("if (isChest(aimed)) return 'open'"), 'it opens like a chest')
const tiles = readFileSync(new URL('./tex/tiles.ts', import.meta.url), 'utf8')
ok(tiles.includes('case MAT.HELD_CACHE: paintChest(dst, size, seed, face, HELD_LOOK)'), 'it has its own look (brass on heartwood), never the ore painter')

console.log(`held-cache: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
