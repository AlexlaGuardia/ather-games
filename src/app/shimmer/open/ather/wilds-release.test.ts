// BETA M9 (11-22): releaseTo gives the Wilds' tiles back at home: only the anchor's ring of 9 stays, nothing is loaded.
import { makeWorld, releaseTo, wanted, type TileIndex } from './wilds-world'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m) } }
// a 7x7 grid of tiles centred on (0, 0)
const tiles = [] as { name: string; tx: number; ty: number }[]
for (let ty = -3; ty <= 3; ty++) for (let tx = -3; tx <= 3; tx++) tiles.push({ name: `t${tx}_${ty}`, tx, ty })
const w = makeWorld({ tiles } as unknown as TileIndex)
const fake = {} as never
// the keeper wandered to the far corner: its 5x5 keep-ring is loaded, the boot ring round (0, 0) is not
for (let ty = 0; ty <= 3; ty++) for (let tx = 0; tx <= 3; tx++) w.loaded.set(`t${tx}_${ty}`, fake)
const before = w.loaded.size, rev0 = w.rev
const anchor = wanted(w, 0, 0)
ok(releaseTo(w, 0, 0), 'drops something when tiles lie outside the anchor ring')
ok([...w.loaded.keys()].every(n => anchor.includes(n)), `only the anchor ring stays (${[...w.loaded.keys()].join(',')})`)
ok(w.loaded.size === 4 && before === 16, `16 -> the 4 loaded tiles inside the ring (${w.loaded.size})`)
ok(w.rev === rev0 + 1, 'rev bumped once')
ok(anchor.length === 9 && anchor.filter(n => w.loaded.has(n)).length === 4, 'nothing is loaded: the 5 ring tiles that were not resident stay absent')
ok(!releaseTo(w, 0, 0) && w.rev === rev0 + 1, 'a second release is a no-op (no rev bump)')
// a keeper standing at the anchor loses nothing
const w2 = makeWorld({ tiles } as unknown as TileIndex); for (const n of wanted(w2, 0, 0)) w2.loaded.set(n, fake)
ok(!releaseTo(w2, 0, 0) && w2.loaded.size === 9, 'a keeper whose tiles are the anchor ring loses nothing')
console.log(`wilds-release: ${pass} passed, ${fail} failed`); if (fail) process.exit(1)
