// BETA M85 s2: the SCATTER BRUSH, pure. Brush math (density x radius -> count, top-up not pile-up, erase only inside the disc and only
// scattered pieces), the jitter, the cap, the never-solid rule, save / publish round-trip through the builder's own layer path, the game
// reads them back non-solid, and the draw groups by kind (one batch per kind). Run: npx tsx src/app/shimmer/world/scatter-brush.test.ts
import { readFileSync } from 'fs'
import { SCATTER_KINDS, SCATTER_DEFAULT_MIX, SCATTER_MAX, SIZE_JITTER, RADIUS_MAX, RADIUS_MIN, paintScatter, eraseScatter, targetCount, scatterCount, isScatter, newScatterId, byKind, clampRadius } from './scatter-brush'
import { cleanProp, cleanProps, pieceCount, addProp, propsToStore, propsOfStore, changeProp, PROPS_MAX, type Prop } from './builder-props'
import { cleanLayer, sameLayer, planPublish, emptyIndex, EMPTY_LAYER, type Layer } from './builder'
import { SCENERY_BY, wildsPublishedProps, sceneryPlaced, sceneryBoxes, isSolid, placeableOn } from '../open/ather/scenery'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const dab = (ps: Prop[], x: number, z: number, radius: number, density: number, seed = 7, kinds: readonly string[] = SCATTER_DEFAULT_MIX) => paintScatter(ps, { x, z, radius, density, kinds, seed })

// 1. the kit: every scatter kind is a real, non-solid kind the Wilds take
for (const k of SCATTER_KINDS) { const K = SCENERY_BY.get(k); ok(!!K && !K.solid && !K.floats && placeableOn('wilds', k), `${k}: real, walk-through, on the Wilds`) }
ok(SCATTER_DEFAULT_MIX.every(k => (SCATTER_KINDS as readonly string[]).includes(k)), 'the default mix is drawn from the kit')

// 2. density x radius -> count
ok(targetCount(3, 0.5) === Math.round(0.5 * Math.PI * 9) && targetCount(3, 0.5) === 14, 'r 3 m at 0.5/m² = 14 pieces')
ok(targetCount(8, 1) === 201 && targetCount(1, 0.1) === 0, 'r 8 at 1/m² = 201; r 1 at 0.1 = 0')
const a = dab([], 0, 0, 3, 0.5)
ok(a.length === 14 && scatterCount(a) === 14, `one dab r 3 d 0.5 on bare ground = 14 (${a.length})`)
ok(a.every(p => Math.hypot(p.x, p.z) <= 3 + 1e-3), 'every piece lands inside the disc')
const b = dab([], 0, 0, 6, 2)
ok(b.length === targetCount(6, 2), `r 6 d 2 = ${targetCount(6, 2)} (${b.length})`)
ok(dab(a, 0, 0, 3, 0.5, 99) === a, 'the same dab again adds nothing (tops up, never piles)')
ok(dab(a, 0, 0, 3, 1, 99).length === targetCount(3, 1), 'a denser dab over it tops up to the new density')
ok(dab(a, 20, 0, 3, 0.5, 99).length === 28, 'a dab elsewhere adds its own 14')
// an even spread: no quadrant empty on a big dab
const big = dab([], 0, 0, 8, 1, 3), quad = [0, 0, 0, 0]; big.forEach(p => quad[(p.x >= 0 ? 1 : 0) + (p.z >= 0 ? 2 : 0)]++)
ok(quad.every(n => n > 201 * 0.15), `uniform in the disc, not bunched in the middle: quadrants ${quad.join('/')}`)
const mid = big.filter(p => Math.hypot(p.x, p.z) < 4).length
ok(mid > 201 * 0.15 && mid < 201 * 0.38, `a quarter of the area holds about a quarter (${mid} of 201 inside r/2)`)

// 3. jitter, mix, ids, never solid
ok(new Set(big.map(p => p.q)).size > 150 && big.every(p => p.q >= 0 && p.q < 4), 'random turns, all in [0, 4)')
ok(big.every(p => p.s >= 1 - SIZE_JITTER - 0.01 && p.s <= 1 + SIZE_JITTER + 0.01) && new Set(big.map(p => p.s)).size > 20, 'sizes jitter in 1 +- 0.3')
ok(SCATTER_DEFAULT_MIX.every(k => big.some(p => p.k === k)) && big.every(p => SCATTER_DEFAULT_MIX.includes(p.k)), 'every kind of the mix appears, nothing outside it')
ok(dab([], 0, 0, 3, 1, 1, ['filler:rock-small']).every(p => p.k === 'filler:rock-small'), 'a one-kind mix paints only that kind')
ok(dab([], 0, 0, 3, 1, 1, []).length === 0, 'an empty mix paints nothing')
ok(big.every(isScatter) && new Set(big.map(p => p.id)).size === big.length, 'scattered ids are s-prefixed and unique')
ok(newScatterId(big) === `s${(big.length + 1).toString(36)}`, 'the next id counts on')
ok(big.every(p => p.solid === undefined && !isSolid(p)), 'a scattered piece never blocks')
ok(cleanProp({ id: 's1', k: 'filler:rock-small', x: 0, z: 0, q: 0, s: 1, solid: true })!.solid === undefined, 'cleanProp drops a solid toggle off a scattered piece')
ok(changeProp([big[0]], big[0].id, { solid: true })[0].solid === undefined, 'B on a scattered piece changes nothing')
ok(cleanProp({ id: 's1', k: 'node:ather', x: 0, z: 0, q: 0, s: 1 }) === null && cleanProp({ id: 's1', k: 'room:cooking', x: 0, z: 0, q: 0, s: 1 }) === null, 'no node or room can be a scattered piece')
ok(dab([], 0, 0, 4, 1, 5, SCATTER_DEFAULT_MIX).length > 0 && paintScatter([], { x: 0, z: 0, radius: 4, density: 1, kinds: SCATTER_DEFAULT_MIX, seed: 5, ok: x => x > 0 }).every(p => p.x > 0), 'ok() keeps pieces off ground the brush may not use (off the land)')
ok(clampRadius(0.2) === RADIUS_MIN && clampRadius(99) === RADIUS_MAX && clampRadius(3.3) === 3.5, 'radius dial clamps 1..12, half-metre steps')

// 4. erase: only inside the radius, only scattered pieces
const placed: Prop[] = [{ id: 'p1', k: 'filler:rock-large', x: 0, z: 0, q: 0, s: 1 }, { id: 'p2', k: 'filler:flowers-white', x: 1, z: 1, q: 0, s: 1 }]
const mixed = [...placed, ...big]
const e1 = eraseScatter(mixed, 0, 0, 4)
ok(e1.filter(p => !isScatter(p)).length === 2, 'erase leaves the placed pieces (a flower placed by hand too)')
ok(e1.filter(isScatter).every(p => Math.hypot(p.x, p.z) > 4 - 1e-9), 'nothing scattered is left inside the radius')
ok(e1.filter(isScatter).length === big.filter(p => Math.hypot(p.x, p.z) > 4).length, 'everything scattered outside the radius stays')
ok(eraseScatter(mixed, 500, 500, 4) === mixed, 'erasing where nothing is changes nothing')
const e2 = eraseScatter(e1, 4, 0, 2), e2ids = new Set(e2.map(p => p.id))
ok(e1.filter(p => !e2ids.has(p.id)).every(p => Math.hypot(p.x - 4, p.z) <= 2), 'an off-centre erase removes only what is within its own disc')

// 5. caps: scattered pieces have their own, placed pieces keep theirs
ok(pieceCount(mixed) === 2, 'the placed-piece count ignores scattered pieces')
ok(addProp(mixed, { k: 'filler:sign', x: 9, z: 9, q: 0, s: 1 }) !== null, 'a full brush stroke never blocks placing a piece')
let full: Prop[] = []
for (let i = 0; scatterCount(full) < SCATTER_MAX && i < 400; i++) full = dab(full, (i % 20) * 30, Math.floor(i / 20) * 30, 12, 3, i)
ok(scatterCount(full) === SCATTER_MAX && dab(full, 9000, 9000, 12, 3) === full, `the scatter cap holds at ${SCATTER_MAX}`)
ok(cleanProps({ props: [...full, { id: 's' + (99999).toString(36), k: 'filler:rock-small', x: 1, z: 1, q: 0, s: 1 }] }).length === SCATTER_MAX, 'cleanProps keeps SCATTER_MAX scattered pieces at most')
ok(cleanProps({ props: [...full, ...Array.from({ length: PROPS_MAX }, (_, i) => ({ id: `p${(i + 1).toString(36)}`, k: 'filler:sign', x: i, z: 0, q: 0, s: 1 }))] }).length === SCATTER_MAX + PROPS_MAX, 'and placed pieces have their own PROPS_MAX beside them')

// 6. save / publish round-trip: the editor store, the draft JSON, Publish, the game
const store = propsToStore(mixed)
ok(JSON.stringify(propsOfStore(store)) === JSON.stringify(mixed), 'the editor store holds the scattered pieces as they were')
const draft: Layer = cleanLayer(JSON.parse(JSON.stringify({ v: 1, tiles: {}, water: {}, falls: {}, props: propsOfStore(store) })))
ok(draft.props?.length === mixed.length && sameLayer(draft, cleanLayer({ v: 1, tiles: {}, water: {}, falls: {}, props: [...mixed].reverse() })), 'the draft keeps every piece (order-independent)')
ok(JSON.stringify(draft.props) === JSON.stringify(cleanProps({ props: mixed })), 'saved pieces come back exactly (round-trip stable)')
const plan = planPublish(emptyIndex('wilds'), draft, EMPTY_LAYER, '2026-11-27T00:00:00Z', 'scatter')
const live = plan.writes.find(w => w.kind === 'live') as { layer: Layer } | undefined
ok(!!live && live.layer.props!.filter(isScatter).length === big.length, 'Publish carries every scattered piece to the live layer')
const game = wildsPublishedProps(JSON.parse(JSON.stringify(live!.layer)).props)
ok(game.filter(isScatter).length === big.length, 'the Wilds game reads them back')
const stood = sceneryPlaced(game, (x, z) => 10 + x * 0.1 + z * 0.05)
ok(stood.filter(isScatter).every(p => Math.abs(p.y - (10 + p.x * 0.1 + p.z * 0.05)) < 1e-9), 'each stands on the ground under it')
ok(sceneryBoxes(stood.filter(isScatter)).length === 0, 'scattered pieces register no collision boxes')

// 7. the draw: one batch per kind, whatever the count; the views really instance by kind
const g500 = dab([], 0, 0, 9, 2, 11, ['filler:flowers-white', 'filler:flowers-yellow', 'filler:flowers-violet', 'filler:grass-tall', 'filler:rock-small']).slice(0, 500)
const groups = byKind(g500)
ok(g500.length === 500 && groups.size === 5 && [...groups.values()].reduce((n, l) => n + l.length, 0) === 500, `500 pieces of 5 filler kinds = 5 batches (${groups.size})`)
const view = readFileSync('src/app/shimmer/open/ather/scenery-view.tsx', 'utf8')
ok(/new THREE\.InstancedMesh\(p\.geometry, mat, items\.length\)/.test(view) && /m\.get\(i\.k\)/.test(view), 'scenery-view draws one InstancedMesh per kind part (the game + Fly)')
const filler = readFileSync('src/app/shimmer/open/ather/scenery-view.tsx', 'utf8').match(/'filler' in K\.model[^\n]*\n[^\n]*baked\.set\(K\.k, \[\{ geometry: g, material: fillerMaterial\(\) \}\]\)/)
ok(!!filler, 'a filler kind bakes to ONE part: 1 draw call per filler kind')
const page = readFileSync('src/app/shimmer/open/ather/page.tsx', 'utf8')
ok(/zone\.kind === 'wilds' && wildsScenery\.length > 0 && <SceneryView items=\{wildsScenery\} \/>/.test(page), 'the Wilds game draws its pieces through SceneryView')
const fly = readFileSync('src/app/shimmer/dev/editors/BuilderFly.tsx', 'utf8'), pm = readFileSync('src/app/shimmer/dev/editors/place-mode.tsx', 'utf8')
ok(/P\?\.scatter && isLocked\(\)/.test(fly) && /e\.button === 0 \|\| e\.shiftKey \|\| e\.altKey/.test(fly), 'Fly: right paints, left / Shift / Alt + right erases')
ok(/e\.code === 'KeyK'/.test(pm) && /eraseScatter\(c\.props/.test(pm) && /paintScatter\(c\.props/.test(pm), 'Place mode: K toggles the brush, dabs paint / erase the draft list')

console.log(fails ? `\n${fails} FAILED` : '\nall pass'); process.exit(fails ? 1 : 0)
