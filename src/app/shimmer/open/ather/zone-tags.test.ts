// BETA M114 s2: the game reads a published zone's tag (pure). Run: npx tsx src/app/shimmer/open/ather/zone-tags.test.ts
import { zoneDoor, zoneUse, zonePrompt, zoneSay, homeTalk, ZONE_DOOR_OUT } from './zone-tags'
import { FRONT_SHOPS } from '../business/doors'
import { cleanTag, cleanZones } from '../../world/builder-zones'
import { shopChoices, supplierChoices, gladeHomes } from '../../dev/editors/zone-choices'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

// the E point: middle of the +z edge, just outside
const d = zoneDoor({ x0: 100, x1: 112, z0: -40, z1: -30 })
ok(d.x === 106 && d.z === -30 + ZONE_DOOR_OUT, 'E point = middle of the front (+z) edge, just outside')
// M114 s3: the picked front edge (N = -z, E = +x, S = +z, W = -x); no pick / null tag = S (+z), the s2 spot
const R = { x0: 100, x1: 112, z0: -40, z1: -30 }
const at = (front?: 'n' | 'e' | 's' | 'w') => zoneDoor({ ...R, tag: { front } })
ok(at('n').x === 106 && at('n').z === -40 - ZONE_DOOR_OUT, 'front N: middle of the -z edge, just outside')
ok(at('e').x === 112 + ZONE_DOOR_OUT && at('e').z === -35, 'front E: middle of the +x edge, just outside')
ok(at('w').x === 100 - ZONE_DOOR_OUT && at('w').z === -35, 'front W: middle of the -x edge, just outside')
ok(at('s').x === 106 && at('s').z === -30 + ZONE_DOOR_OUT && at().z === at('s').z && zoneDoor({ ...R, tag: null }).z === at('s').z, 'front S / none / untagged: the +z edge (old zones keep their E point)')
// the tag reader keeps a picked edge, drops junk, never stores the default
ok(cleanTag({ kind: 'shop', ref: 'x', front: 'e' })?.front === 'e' && cleanTag({ kind: 'other', front: 'w' })?.front === 'w', 'cleanTag keeps a picked front (Other too)')
ok(!('front' in (cleanTag({ kind: 'shop', front: 's' }) ?? {})) && !('front' in (cleanTag({ kind: 'shop', front: 'up' }) ?? {})), 'cleanTag: S (the default) and junk are not stored')
ok(cleanZones({ zones: [{ id: 'z1', x0: 0, z0: 0, x1: 8, z1: 8, h: 1, prev: {}, tag: { kind: 'other', front: 'n' } }] })[0].tag?.front === 'n', 'a zone keeps its front through cleanZones (publish + draft path)')
// a Wilds home pick reads 'Name (Settlement)': the label is the name
const wh = zoneUse({ tag: { kind: 'home', ref: 'm1', name: 'Bram (Hollow Row)' } })
ok(wh?.kind === 'home' && wh.name === 'Bram' && zoneSay(wh) === "Bram's home", "Wilds home: the settlement suffix is not in the label")

// OTHER = locked
const o = zoneUse({ tag: { kind: 'other' } })
ok(o?.kind === 'locked' && zonePrompt(o) === 'E · the door' && zoneSay(o) === 'The door is locked.', 'Other: locked, a plain line, nothing to enter')
ok(zoneUse({ tag: null }) === null, 'untagged zone: no E point')

// SHOP = that storefront (every shop the popup offers resolves to its own FRONT_SHOPS entry)
for (const c of shopChoices()) {
  const u = zoneUse({ tag: { kind: 'shop', ref: c.ref, name: c.name } })
  ok(u?.kind === 'shop' && u.id === c.ref && u.name === FRONT_SHOPS[c.ref].name && zoneSay(u) === null, `Shop ${c.ref}: opens its own panel`)
}
ok(zoneUse({ tag: { kind: 'shop', ref: 'no-such-shop', name: 'X' } }) === null && zoneUse({ tag: { kind: 'shop' } }) === null, 'unknown / missing shop: no E point (never a wrong panel)')

// HOME = "<name>'s home"
const h = zoneUse({ tag: { kind: 'home', ref: 'otto', name: 'Otto' } })
ok(h?.kind === 'home' && h.ref === 'otto' && zonePrompt(h) === "E · Otto's home" && zoneSay(h) === "Otto's home", 'Home: the resident\'s label')
ok(zoneUse({ tag: { kind: 'home', ref: 'x' } }) === null, 'home with no name: no E point')

// SUPPLIER = placeholder only
const firstSup = supplierChoices()[0]
const s = zoneUse({ tag: { kind: 'supplier', ref: firstSup.ref, name: firstSup.name } })
ok(s?.kind === 'supplier' && zoneSay(s) === `Supplier: ${firstSup.name}` && zonePrompt(s) === `E · Supplier: ${firstSup.name}`, 'Supplier: placeholder line with the stand-in name')
const s2 = zoneUse({ tag: { kind: 'supplier', ref: firstSup.ref } })
ok(s2?.kind === 'supplier' && s2.name === firstSup.name, 'supplier with only a ref: the good\'s own name')

// homeTalk: every Glade home the popup offers maps to its existing talk when that NPC stands here
const here = { greg: true, friends: ['otto', 'tess', 'bonn'], fennel: 'moonwell:fennel', folk: ['moonwell:fennel', 'moonwell:hazel', 'moonwell:sax'] }
ok(homeTalk('greg', here)?.kind === 'greg', 'Gregory -> his talk')
ok(homeTalk('greg', { ...here, greg: false }) === null, 'Gregory away (tour) -> label only')
const ft = homeTalk('tess', here); ok(ft?.kind === 'friend' && ft.f === 'tess', 'a friend -> their talk')
ok(homeTalk('moonwell:fennel', here)?.kind === 'fennel', 'Fennel -> her own talk')
ok(homeTalk('moonwell:hazel', here)?.kind === 'folk', 'a Glade Moglin -> the folk talk')
ok(homeTalk('moonwell:mallow', here) === null, 'a Moglin not standing here -> label only (nobody moved)')
ok(homeTalk(undefined, here) === null, 'no ref -> label only')
const known = new Set(['greg', ...here.friends])
for (const c of gladeHomes()) ok(known.has(c.ref) || c.ref.startsWith('moonwell:'), `Glade home ${c.ref} is a Greg / friend / Glade Moglin id`)

console.log(fails ? `\n${fails} FAIL` : '\nall pass'); process.exit(fails ? 1 : 0)
