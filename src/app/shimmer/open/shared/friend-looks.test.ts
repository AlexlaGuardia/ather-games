// BETA M154: npx tsx src/app/shimmer/open/shared/friend-looks.test.ts
// Bonn, Otto, Tess are KEEPERS (hub call 11-27): each look record is a keeper Look whose head + torso match the friend's sex,
// in the card's colours (Otto FAIR + sandy-copper, Tess hazel, Bonn warm brown + green), with the card's shapes, built by
// buildKeeper. Alex 11-24: 'tess and bonn are female and otto a male'.
import * as THREE from 'three'
import { FRIEND_LOOKS, friendProportions, friendRecord } from './friend-looks'
import { FRIEND_IDS } from './friend-figure'
import { buildKeeper } from './keeper-figure'
import { OPT, isFemaleTorso, parseLook } from './keeper-look'
import { cartoonHead } from './keeper-heads'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const lum = (hex: string) => { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b }
const hsl = (hex: string) => new THREE.Color(hex).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace)

const SEX = { bonn: 'F', otto: 'M', tess: 'F' } as const
for (const id of FRIEND_IDS) {
  const f = FRIEND_LOOKS[id], ch = cartoonHead(f.look.head)
  ok(f.sex === SEX[id], `${id}: sex ${f.sex}, Alex says ${SEX[id]}`)
  ok(!!ch && ch.sex === f.sex, `${id}: head ${f.look.head} is not a ${f.sex} cartoon head (got ${ch?.letter}-${ch?.sex})`)
  ok(isFemaleTorso(f.look.torso) === (f.sex === 'F'), `${id}: torso ${OPT.torso[f.look.torso]} is the wrong sex`)
  ok(JSON.stringify(parseLook(f.look)) === JSON.stringify(f.look), `${id}: the look is not one the creator could save (a field out of range)`)
  ok(OPT.ears[f.look.ears] === 'Pointed', `${id}: card note: pointed ear tips`)
  const k = buildKeeper(f.look, friendProportions(id), f.dress)
  ok(k.height > 1.2 && k.height < 2.2, `${id}: stands ${k.height.toFixed(2)} m`)
  const cols = new Set<string>(); k.group.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined; if (m?.color) cols.add('#' + m.color.getHexString()) })
  for (const c of ['skin', 'hair', 'top', 'foot'] as const) ok(cols.has(f.dress[c]!), `${id}: ${c} colour ${f.dress[c]} is not on the built figure`)
  ok(cols.has(f.dress.iris!), `${id}: eye colour ${f.dress.iris} not drawn`)
  const r = friendRecord(id)
  ok(r.sex === f.sex && r.head === f.look.head && r.hair === f.dress.hair && r.skin === f.dress.skin, `${id}: the probe record does not carry the look`)
}
// the card notes, one by one
const B = FRIEND_LOOKS.bonn, O = FRIEND_LOOKS.otto, T = FRIEND_LOOKS.tess
ok(B.dress.hairStyle === 'Coily' && lum(B.dress.hair!) < 0.08, 'Bonn: big coily DARK hair')
ok(hsl(B.dress.iris!).h > 0.25 && hsl(B.dress.iris!).h < 0.45, 'Bonn: green eyes')
ok(lum(B.dress.skin!) < lum(O.dress.skin!) - 0.2, 'Bonn: warm brown skin, darker than Otto / Tess')
ok(B.dress.scarf === null, 'Bonn: an open neck, no scarf')
ok(lum(O.dress.skin!) > 0.7, 'Otto: FAIR skin (Alex 11-25: never warm brown)')
ok(hsl(O.dress.hair!).h > 0.05 && hsl(O.dress.hair!).h < 0.1 && hsl(O.dress.hair!).l > 0.45, 'Otto: lighter sandy-copper hair')
ok(O.dress.hand !== O.dress.skin && !!O.dress.goggles && !!O.dress.apron, 'Otto: gloves, goggles up, apron')
ok(!!T.dress.hood && T.dress.hood === T.dress.top, 'Tess: the hood is her coat\'s')
{ const s = hsl(T.dress.top!); ok(s.s > 0.3 && s.h > 0.08 && s.h < 0.16, 'Tess: SAND coat, never grey') }
{ const e = hsl(T.dress.iris!); ok(e.h > 0.08 && e.h < 0.2 && e.l < 0.5, 'Tess: hazel eyes') }
ok(hsl(T.dress.scarf!).h > 0.7 && hsl(T.dress.scarf!).h < 0.85, 'Tess: lavender scarf')
// the friends are drawn as keepers: FriendModel builds with buildKeeper on this record (not the old moulded figure)
import { readFileSync } from 'fs'
const src = readFileSync(new URL('./friend-model.tsx', import.meta.url), 'utf8')
ok(/buildKeeper\(FRIEND_LOOKS\[who\]\.look, friendProportions\(who\), FRIEND_LOOKS\[who\]\.dress\)/.test(src) && !/friendFigure\(/.test(src), 'FriendModel does not build the friends as keepers')

console.log(`friend-looks: ${pass} pass, ${fails.length} fail`)
if (fails.length) { console.log(fails.join('\n')); process.exit(1) }
