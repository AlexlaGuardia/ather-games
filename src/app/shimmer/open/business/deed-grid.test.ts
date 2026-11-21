// business/deed-grid.ts (M49 s1, new shape): a grid the keeper PLACES things in; bounds, overlap, turn, pick up, palette, save
import { DEED_GRID, DEED_PALETTES, MAX_DEED_ITEMS, emptyDeed, cellsOf, placeRefusal, place, itemAt, pickUp, setPalette, paletteOf, cellAtLocal, pieceCentre, parseDeed, type Footprint } from './deed-grid'
import { FURNITURE } from '../ather/furniture'
let n = 0, fails = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log('  FAIL', m) } }
const fpOf = (id: string): Footprint | null => FURNITURE[id] ? { w: FURNITURE[id].w, d: FURNITURE[id].d } : null
const G = DEED_GRID.shipyard
// a 2x1 test piece taken from the real catalogue: the widest piece whose footprint covers 2 cells across and 1 deep
const wide = Object.keys(FURNITURE).find(id => cellsOf(fpOf(id)!, 0, 0, 0).length === 2 && FURNITURE[id].w > 1 && FURNITURE[id].d <= 1)!
const stool = 'goldwood_stool'
ok(!!wide && !!FURNITURE[stool], 'the catalogue has a 1-cell stool and a 2-cell-wide piece to test with')
ok(cellsOf({ w: 1.5, d: 0.6 }, 3, 4, 0).length === 2 && cellsOf({ w: 1.5, d: 0.6 }, 3, 4, 1).every(([x]) => x === 3), 'a quarter turn swaps across and deep')
ok(cellsOf({ w: 1, d: 1 }, 0, 0, 0).length === 1 && cellsOf({ w: 1.0000001, d: 1 }, 0, 0, 0).length === 1, 'exactly 1 m is one cell (float slack), not two')
let s = emptyDeed()
s = place(s, 'shipyard', fpOf, stool, 0, 0, 0)
ok(s.items.length === 1 && itemAt(s, fpOf, 0, 0) === 0, 'a stool sets on cell 0,0 and is found there')
ok(placeRefusal(s, 'shipyard', fpOf, stool, 0, 0, 0) === 'taken' && place(s, 'shipyard', fpOf, stool, 0, 0, 0) === s, 'a taken cell refuses and leaves the state as it was')
ok(placeRefusal(s, 'shipyard', fpOf, stool, G.w, 0, 0) === 'out' && placeRefusal(s, 'shipyard', fpOf, stool, 0, -1, 0) === 'out', 'off the grid refuses (both edges)')
ok(placeRefusal(s, 'shipyard', fpOf, wide, G.w - 1, 2, 0) === 'out' && placeRefusal(s, 'shipyard', fpOf, wide, G.w - 1, 2, 1) === null, 'a wide piece hangs off the last column, turned it fits')
ok(placeRefusal(s, 'shipyard', fpOf, 'no_such_piece', 2, 2, 0) === 'out', 'an unknown id never places')
s = place(s, 'shipyard', fpOf, wide, 1, 0, 0)
ok(s.items.length === 2 && itemAt(s, fpOf, 2, 0) === 1, 'the wide piece covers its second cell too')
ok(placeRefusal(s, 'shipyard', fpOf, stool, 2, 0, 0) === 'taken', "the wide piece's second cell is taken")
ok(placeRefusal(s, 'shipyard', fpOf, wide, 1, 0, 0, 1) === null, 'moving a piece onto its own cells is fine (ignore its own index)')
const up = pickUp(s, 0)
ok(up.id === stool && up.state.items.length === 1 && itemAt(up.state, fpOf, 0, 0) === -1, 'picking up returns the id and frees the cell')
ok(pickUp(s, 9).id === null && pickUp(s, 9).state === s, 'picking up nothing changes nothing')
let full = emptyDeed()
for (let z = 0; z < G.d && full.items.length < MAX_DEED_ITEMS; z++) for (let x = 0; x < G.w && full.items.length < MAX_DEED_ITEMS; x++) full = place(full, 'shipyard', fpOf, stool, x, z, 0)
ok(full.items.length === MAX_DEED_ITEMS && G.w * G.d > MAX_DEED_ITEMS && placeRefusal(full, 'shipyard', fpOf, stool, G.w - 1, G.d - 1, 0) === 'full', 'the cap holds with free cells left')
ok(paletteOf(setPalette(s, 2)).id === DEED_PALETTES[2].id && setPalette(s, DEED_PALETTES.length).palette === 0 && setPalette(s, -1).palette === DEED_PALETTES.length - 1, 'palette picks wrap both ways')
ok(DEED_PALETTES.some(p => p.mat === 'iron'), 'metal is a choice Nyx-side (canon: metal is normal)')
ok(cellAtLocal('shipyard', -G.w / 2 + 0.1, -G.d / 2 + 0.1)?.cx === 0 && cellAtLocal('shipyard', G.w / 2 - 0.1, 0)?.cx === G.w - 1 && cellAtLocal('shipyard', G.w / 2 + 0.1, 0) === null, 'local metres map to cells, edge to edge, and off the grid is null')
const c = pieceCentre('shipyard', fpOf(wide)!, 1, 0, 0)
ok(Math.abs(c.lx - (2 - G.w / 2)) < 1e-9 && Math.abs(c.lz - (0.5 - G.d / 2)) < 1e-9, 'a 2-cell piece centres on the line between its cells')
const saved = JSON.parse(JSON.stringify(setPalette(s, 3)))
const back = parseDeed(saved, 'shipyard', fpOf)
ok(JSON.stringify(back) === JSON.stringify(setPalette(s, 3)), 'a save round-trips exactly (items, turns, palette)')
ok(parseDeed({ v: 1, palette: 0, items: [{ id: stool, cx: 0, cz: 0, rot: 0 }, { id: stool, cx: 0, cz: 0, rot: 0 }, { id: stool, cx: 99, cz: 0, rot: 0 }, { id: 5 }] }, 'shipyard', fpOf).items.length === 1, 'a tampered save drops the overlap, the off-grid and the junk')
ok(parseDeed(null, 'shipyard', fpOf).items.length === 0 && parseDeed({ v: 2 }, 'shipyard', fpOf).items.length === 0 && parseDeed('x', 'shipyard', fpOf).palette === 0, 'no save / another version / junk = an empty deed, never a throw')
console.log(`deed-grid: ${n - fails}/${n} pass${fails ? `, ${fails} FAIL` : ''}`)
if (fails) process.exit(1)
