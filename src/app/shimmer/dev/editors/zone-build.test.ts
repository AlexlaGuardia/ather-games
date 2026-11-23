// BETA M84 s2: build on a Creative-mode zone (pure). Run: npx tsx src/app/shimmer/dev/editors/zone-build.test.ts
import { ZONE_PARTS, partGroup, canSet, setPart, movePart, deletePart, partAt } from './zone-build'
import { cleanZones, cleanBuild, type Zone, type ZonePiece } from '../../world/builder-zones'
import { cleanLayer, sameLayer, type Layer } from '../../world/builder'
import { FURNITURE } from '../../open/ather/furniture'
import { quad } from '../../open/ather/build-prefs'
import { TABLE_ITEM } from '../../open/ather/rooms'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

// a 12 x 10 m zone far from the home plot (the plot's squares / gate / Gregory are NOT there: only the zone counts)
const Z: Zone = { id: 'z1', x0: 400, z0: -300, x1: 412, z1: -290, h: 3, tag: null, prev: {} }
const furn = ZONE_PARTS.find(id => partGroup(id) === 'furniture' && FURNITURE[id].solid)!
const qOf = (p: ZonePiece) => quad(p.x, p.z, FURNITURE[p.item].w, FURNITURE[p.item].d, p.q) as [number, number][]

ok(!ZONE_PARTS.includes(TABLE_ITEM) && !ZONE_PARTS.some(id => FURNITURE[id].shaft), 'no planning table, no lift')
ok(['walls', 'floors', 'furniture'].every(g => ZONE_PARTS.some(id => partGroup(id) === g)), 'walls + floors + furniture offered')
ok(partGroup('goldwood_panel') === 'walls' && partGroup('stone_slab') === 'floors', 'panels are walls, slabs are floors')

// place a wall, a floor, a furniture piece: free (no bag, no owned ground), zone-local
let z = Z
const w1 = setPart(z, 'goldwood_panel', 3, 1, 0, 1000); ok(w1.ok, 'a wall panel sets inside the zone (no bag)'); if (w1.ok) z = w1.zone
const f1 = setPart(z, 'goldwood_slab_wide', 6, 5, 0, 1001); ok(f1.ok, 'a floor slab sets'); if (f1.ok) z = f1.zone
const p1 = setPart(z, furn, 6, 5, 0, 1002); ok(p1.ok, `furniture (${furn}) stands ON the slab (the player's slab rule)`); if (p1.ok) z = p1.zone
ok(z.build?.length === 3 && z.build.every(p => Number.isFinite(p.x)), '3 parts on the zone')
ok(Z.build === undefined, 'pure: the old zone is untouched')
ok(!setPart(z, 'goldwood_panel', 3, 1, 0, 1003).ok, 'a second wall on the first refuses (overlap)')
ok(!setPart(z, 'stone_slab', 6, 5, 0, 1004).ok, 'slab on slab refuses')
const out = setPart(z, 'goldwood_panel', 11.8, 5, 0)
ok(!out.ok && out.why.includes('zone'), 'over the zone edge refuses (the site, not the plot)')
ok(!setPart(z, TABLE_ITEM, 3, 8, 0).ok, 'the planning table is not a zone part')
ok(setPart(z, 'goldwood_panel', 3, 8, 0.5).ok, 'a wall at 45 deg sets')

// move / turn / delete
const pid = z.build![0].id
const mv = movePart(z, pid, 2, 8, 1); ok(mv.ok && mv.zone.build!.find(p => p.id === pid)!.x === 2 && mv.zone.build!.find(p => p.id === pid)!.q === 1, 'move + turn a wall')
ok(movePart(z, pid, 3, 1, 1).ok, 'turning in place ignores itself')
const fid = z.build![2].id
ok(!movePart(z, pid, z.build![2].x, z.build![2].z, 0).ok, 'moving a wall onto the furniture refuses')
const dz = deletePart(z, fid); ok(dz.build!.length === 2 && !dz.build!.some(p => p.id === fid), 'delete one part')
ok(deletePart(deletePart(dz, dz.build![0].id), dz.build![1].id).build === undefined, 'deleting the last part leaves no build key')

// pick: the furniture over the slab wins, the slab elsewhere
ok(partAt(z, 6, 5, qOf)?.id === fid, 'click on furniture over a slab picks the furniture')
ok(partAt(z, 6.9, 5.9, qOf)?.item === 'goldwood_slab_wide', 'click on the bare slab picks the slab')
ok(partAt(z, 10, 9, qOf) === null, 'empty ground picks nothing')

// persistence: survives cleanZones / cleanLayer and counts in sameLayer
const L: Layer = { v: 1, tiles: {}, water: {}, falls: {}, zones: [z] }
const back = cleanLayer(JSON.parse(JSON.stringify(L)))
ok(JSON.stringify(back.zones?.[0].build) === JSON.stringify(z.build), 'the build round-trips through the route cleaner')
ok(!sameLayer(L, { ...L, zones: [dz] }), 'a build change is a layer change (autosave sees it)')
ok(sameLayer(L, back), 'unchanged build = same layer')
const junk = cleanBuild([{ id: 'a', item: 'nope', x: 1, z: 1, q: 0 }, { id: 'b', item: 'goldwood_panel', x: 99, z: 1, q: 0 }, { id: 'c', item: 'goldwood_panel', x: 1, z: 1, q: 0 }, { id: 'c', item: 'goldwood_panel', x: 2, z: 1, q: 0 }, { id: 'd', item: 'goldwood_panel', x: 'x', z: 1, q: 0 }, null], 12, 10)
ok(junk.length === 1 && junk[0].id === 'c', 'junk parts dropped (unknown item, outside, duplicate id, bad number)')
ok(cleanZones({ zones: [{ ...Z }] })[0].build === undefined, 'a zone with no build has no build key')
ok(cleanZones({ zones: [] }).length === 0, 'deleting the zone = the build goes with it (it lives on the zone)')

console.log(fails ? `\n${fails} FAILED` : '\nall pass')
process.exit(fails ? 1 : 0)
