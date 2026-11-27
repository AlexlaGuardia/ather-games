// BETA M227: npx tsx src/app/shimmer/open/shared/keeper-one-face.test.ts
// Alex 11-27 on the M154 sheet: "the bonn and tess have a second set of eyes overlap thing". A cartoon head draws its own
// eyes; the classic eyes + brows used to be drawn on top of it whenever the keeper wore no goggles (the goggles sat in the
// face chain). Every head draws exactly ONE face source, goggles or not; the friends' faces are their cartoon heads.
import * as THREE from 'three'
import { FRIEND_LOOKS, friendProportions } from './friend-looks'
import { FRIEND_IDS } from './friend-figure'
import { buildKeeper, type KeeperDress } from './keeper-figure'
import { DEFAULT_LOOK, OPT, type Look } from './keeper-look'
import { cartoonHead } from './keeper-heads'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const headOf = (look: Look, dress: KeeperDress = {}, p?: Parameters<typeof buildKeeper>[1]) => buildKeeper(look, p, dress).group.getObjectByName('head') as THREE.Group
const facesOf = (h: THREE.Group) => (h.userData.faces ?? []) as string[]

// 1. the three friends: one face each, and it is their cartoon head's
for (const id of FRIEND_IDS) {
  const f = FRIEND_LOOKS[id], h = headOf(f.look, f.dress, friendProportions(id))
  ok(facesOf(h).length === 1, `${id}: ${facesOf(h).length} face sources drawn (${facesOf(h).join(' + ')}), want 1`)
  ok(facesOf(h)[0] === (cartoonHead(f.look.head) ? 'cartoon' : 'classic'), `${id}: face source ${facesOf(h)[0]}`)
  ok(!h.children.some(c => c.userData.face === 'classic') || !cartoonHead(f.look.head), `${id}: no classic eye / brow mesh on a cartoon head`)
}
// 2. every head (classic + the 8 cartoon heads) x goggles on / off x hood on / off: one face source
for (let head = 0; head < OPT.head.length; head++) for (const goggles of [false, true]) for (const hood of [null, '#e2c68e']) {
  const h = headOf({ ...DEFAULT_LOOK, head } as Look, { goggles, ...(hood ? { hood } : {}) })
  ok(facesOf(h).length === 1, `head ${head} goggles ${goggles} hood ${!!hood}: ${facesOf(h).join(' + ') || 'none'}`)
}
// 3. raw count, no tags: goggles add exactly their one group to the head, nothing else changes (before M227 a goggle-less
//    cartoon head carried the classic eyes + brows as extra meshes)
for (let head = 0; head < OPT.head.length; head++) {
  const a = headOf({ ...DEFAULT_LOOK, head } as Look).children.length, b = headOf({ ...DEFAULT_LOOK, head } as Look, { goggles: true }).children.length
  ok(b === a + 1, `head ${head}: ${a} parts bare, ${b} with goggles (want ${a + 1})`)
}
console.log(fails.length ? `FAIL ${fails.length}\n  ${fails.join('\n  ')}` : `PASS ${pass}`)
process.exit(fails.length ? 1 : 0)
