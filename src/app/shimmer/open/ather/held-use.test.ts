// ather/held-use.ts (M45): what E does with what is in hand.
//   npx tsx src/app/shimmer/open/ather/held-use.test.ts
import { heldUse, placesFromHand, useLabel } from './held-use'
import { FURNITURE_ORDER, KEEPSTONES } from './furniture'
import { BAIT } from './rinning'

let fails = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log('FAIL', m) } }

for (const id of FURNITURE_ORDER) {
  ok(heldUse(id, 'plot') === 'place-piece', `${id} places on the plot`)
  ok(heldUse(id, 'wilds') === null, `${id} does nothing in the Wilds (no plot to set it on)`)
}
for (const id of Object.keys(KEEPSTONES)) {
  ok(heldUse(id, 'plot') === 'place-chest', `${id} sets as a Keepstone on the plot`)
  ok(heldUse(id, 'wilds') === null, `${id} not in the Wilds`)
}
ok(heldUse('waymark', 'wilds') === 'plant', 'waymark plants in the Wilds')
ok(heldUse('waymark', 'plot') === null, 'waymark not on the plot')
ok(heldUse(BAIT, 'wilds') === 'cast', 'bait casts in the Wilds')
ok(heldUse('goldwood_plank', 'plot') === null, 'a material does nothing')
ok(heldUse(null, 'plot') === null && heldUse(undefined, 'wilds') === null, 'empty hand does nothing')
ok(placesFromHand('place-piece') && placesFromHand('place-chest') && !placesFromHand('eat') && !placesFromHand(null), 'placesFromHand')
ok(useLabel('place-piece') === null && useLabel('eat') === 'eat' && useLabel('drink') === 'drink' && useLabel('cast') === null, 'phone labels')

console.log(fails ? `${fails}/${n} FAILED` : `held-use: ${n} passed`)
if (fails) process.exit(1)
