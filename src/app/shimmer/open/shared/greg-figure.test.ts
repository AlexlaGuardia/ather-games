// BETA M166: npx tsx src/app/shimmer/open/shared/greg-figure.test.ts
// Greg's locked look is on the figure, he sits and stands, and NOBODY ELSE moved: the friends' geometry, the folk rig's
// looks (door folk, players, the folk bench) and Blue's tones against any other Dewbear's.
import * as THREE from 'three'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { GREG_COLOR, GREG_CALLS, GREG_KNEE, GREG_TORSO, PENCIL_SIDE, gregFigure } from './greg-figure'
import { FRIEND_IDS, FRIEND_CALLS, friendFigure, isFriend, radAt } from './friend-figure'
import { NAMED_LOOKS, folkLook, FOLK_HEIGHT } from './folk-model'
import { BLUE_COLOR, DEWBEAR_SEAM, blueTone, blueTint, hexRgb, BLUE_AT } from '../ather/blue-look'
let n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error('✗ ' + m); process.exitCode = 1 } }
const has = (g: THREE.BufferGeometry, hex: string) => { const c = new THREE.Color(hex), a = g.attributes.color; for (let k = 0; k < a.count; k++) if (Math.abs(a.getX(k) - c.r) + Math.abs(a.getY(k) - c.g) + Math.abs(a.getZ(k) - c.b) < 1e-3) return true; return false }
const f = gregFigure(), J = f.joints
ok(f === gregFigure(), 'built once')
ok(GREG_CALLS === FRIEND_CALLS && GREG_CALLS <= 16, 'a friend\'s draw calls, far under the folk rig\'s')
let tris = 0
for (const j of [...Object.values(J), f.sit.legL, f.sit.legR]) for (const g of [j.toon, j.ink]) { ok([...g.attributes.position.array].every(Number.isFinite), 'finite'); tris += g.index!.count / 3 }
ok(tris < 45000, `${tris} triangles`)
const box = (j: { at: number[]; toon: THREE.BufferGeometry }) => { j.toon.computeBoundingBox(); const b = j.toon.boundingBox!; return { lo: b.min.y + j.at[1], hi: b.max.y + j.at[1], z1: b.max.z + j.at[2], z0: b.min.z + j.at[2], x0: b.min.x + j.at[0], x1: b.max.x + j.at[0] } }
ok(Math.abs(box(J.legL).lo) < 0.02 && Math.abs(box(f.sit.legL).lo) < 0.02, 'soles on the ground, standing and seated')
// canon: round, short
ok(f.crown > 1.42 && f.crown < FOLK_HEIGHT * 0.9 + 0.02, `short: his crown (${f.crown.toFixed(2)}) no higher than the rig he replaces (${(FOLK_HEIGHT * 0.9).toFixed(2)}): the talk camera and the diamond stay over him`)
ok(friendFigure('bonn').crown > f.crown, 'shorter than Bonn grown')
const belly = Math.max(...GREG_TORSO.map(([r]) => r))
ok(belly * 2 > 0.55 && belly * 2 > f.crown * 0.36, 'round: a belly over a third of his height across')
ok(f.shoulderW > friendFigure('bonn').shoulderW * 1.5, 'broad')
// the locked look: every colour is on him, and where it belongs
for (const [k, hex] of Object.entries(GREG_COLOR)) ok([...Object.values(J).map(j => j.toon), f.face, f.eyes].some(g => has(g, hex)), `colour: ${k}`)
ok(has(J.body.toon, GREG_COLOR.vest) && has(J.body.toon, GREG_COLOR.shirt) && has(J.body.toon, GREG_COLOR.button), 'a waistcoat over a shirt, buttoned')
ok(has(J.armL.toon, GREG_COLOR.shirt) && has(J.armL.toon, GREG_COLOR.skin) && !has(J.armL.toon, GREG_COLOR.vest), 'shirtsleeves, rolled: shirt and bare forearm, no waistcoat on the arm')
ok(has(J.head.toon, GREG_COLOR.specs) && has(J.head.toon, GREG_COLOR.pencil) && has(J.head.toon, GREG_COLOR.hair), 'spectacles, the pencil, white hair on the head')
const g = new THREE.Color(GREG_COLOR.vest), w = new THREE.Color(GREG_COLOR.hair)
ok(g.g > g.r && g.g > g.b * 1.4, 'the waistcoat is green'); ok(Math.min(w.r, w.g, w.b) > 0.7, 'hair and beard are white')
{ // the beard: white under the chin line, in front, and SHORT (canon rules out a beard to the belt)
  const P = J.head.toon.attributes.position, C = J.head.toon.attributes.color; let low = 0, front = 0
  for (let k = 0; k < P.count; k++) if (Math.abs(C.getX(k) - w.r) + Math.abs(C.getY(k) - w.g) + Math.abs(C.getZ(k) - w.b) < 1e-3) { low = Math.min(low, P.getY(k)); if (P.getY(k) < -0.1 && P.getZ(k) > 0.1) front++ }
  ok(front > 40, 'a beard on the chin'); ok(J.head.at[1] + low > 1.0, `short: it ends at ${(J.head.at[1] + low).toFixed(2)} m, above the top button`)
}
{ // the pencil is behind his RIGHT ear (-x), as the pictures
  const P = J.head.toon.attributes.position, C = J.head.toon.attributes.color, c = new THREE.Color(GREG_COLOR.pencil); let sx = 0, k2 = 0
  for (let k = 0; k < P.count; k++) if (Math.abs(C.getX(k) - c.r) + Math.abs(C.getY(k) - c.g) + Math.abs(C.getZ(k) - c.b) < 1e-3) { sx += P.getX(k); k2++ }
  ok(k2 > 0 && Math.sign(sx) === PENCIL_SIDE && PENCIL_SIDE === -1, 'pencil behind the right ear')
}
// seated: the bench is 0.48 m high and its front edge 0.35 m out (glade-greg.tsx); knees clear it, thighs lie on it
{ const s = box(f.sit.legL)
  ok(s.z1 > 0.35 + 0.1 && GREG_KNEE > 0.35, 'seated knees are past the bench\'s front edge')
  ok(s.hi > 0.6 && s.hi < 0.78, `the thigh lies at seat height (top ${s.hi.toFixed(2)})`)
  ok(s.z0 < 0.02, 'the thigh reaches back to the hip')
  ok(box(J.legL).z1 < 0.25, 'standing legs do not') }
ok(radAt(GREG_TORSO, 0.6) > 0.28, 'belly at the buttons')
// ── nobody else moved ────────────────────────────────────────────────────────────────────────────────────────────────────
const sig = (id: 'bonn' | 'otto' | 'tess') => { const F = friendFigure(id), h = createHash('sha1'), u = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => h.update(Buffer.from((a.array as Float32Array).buffer))
  for (const j of Object.values(F.joints)) { u(j.toon.attributes.position); u(j.toon.attributes.color); u(j.ink.attributes.position) }
  u(F.face.attributes.position); u(F.eyes.attributes.position); return h.digest('hex').slice(0, 16) }
const BEFORE = { bonn: '5abdd24ff068739f', otto: '89465b631cf5a693', tess: '11332284bd1c2091' } as const   // taken on fe11e870, before M166 touched friend-figure.ts
for (const id of FRIEND_IDS) ok(sig(id) === BEFORE[id], `${id}: every vertex and colour as before M166`)
ok(JSON.stringify(FRIEND_IDS.map(id => { const F = friendFigure(id); return [Object.values(F.joints).map(j => j.at), F.eyesAt, F.crown, F.shoulderW] })) === '[[[[0,0,0],[0,1.395,0],[-0.172,1.115,0],[0.172,1.115,0],[-0.095,0.66,0],[0.095,0.66,0]],[0,-0.012,0],1.595,0.344],[[[0,0,0],[0,1.455,0],[-0.3,1.165,0],[0.3,1.165,0],[-0.128,0.64,0],[0.128,0.64,0]],[0,-0.01176,0],1.651,0.6],[[[0,0,0],[0,1.375,0],[-0.168,1.095,0],[0.168,1.095,0],[-0.095,0.6,0],[0.095,0.6,0]],[0,-0.01176,0],1.571,0.336]]', 'the friends\' joints, crowns and shoulders as before M166')
ok(!isFriend('gregory') && !isFriend('greg'), 'Greg is not one of the three friends (the Glade view draws him himself)')
// the folk rig: Greg's old look stays for the folk bench; unnamed folk draw from their id as ever (door folk, players)
ok(JSON.stringify(NAMED_LOOKS.gregory) === '{"skin":"#eccdab","hair":"#dcd7cb","shirt":"#e9dfc6","vest":"#5f6b4a","apron":null,"trouser":"#5a4632","boot":"#3a2a1c","hat":"none","beard":false,"specs":true,"pencil":true,"crinkle":true,"build":{"girth":1.28,"height":0.9}}', 'the folk rig\'s gregory look is untouched')
ok(Object.keys(NAMED_LOOKS).length === 1, 'no new named folk look')
const FOLK = Array.from({ length: 60 }, (_, k) => [`keeper:p${k}`, `clerk${k}`, `smith:${k * 7}`]).flat()   // signature taken with folk-model.tsx as on fe11e870
ok(createHash('sha1').update(JSON.stringify(FOLK.map(folkLook))).digest('hex').slice(0, 12) === '95162d8a684c', 'folk looks drawn from an id: as before')
const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
ok(!/greg-model|greg-figure|glade-blue|blue-look/.test(src('./folk-model.tsx') + src('./friend-model.tsx') + src('./open-mp.tsx') + src('../continent/door-folk-scene.tsx') + src('../../dev/folk/page.tsx')), 'the folk rig, the friends, players, door folk and the folk bench import nothing of M166')
ok(/<GregModel /.test(src('../ather/glade-greg.tsx')) && !/FolkModel/.test(src('../ather/glade-greg.tsx')), 'the Glade draws GregModel')
ok(/<GregModel /.test(src('../ather/page.tsx')) && !/folkLook\('gregory'\)/.test(src('../ather/page.tsx')), 'the plot\'s table stop draws the same Greg')
// ── Blue: colour and seam light only ─────────────────────────────────────────────────────────────────────────────────────
const hx = (c: number[]) => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
const tone = (p: 'body' | 'eyes', h: string) => hx(blueTone(p, ...hexRgb(h)))
ok(tone('eyes', DEWBEAR_SEAM.gold) === BLUE_COLOR.seam && tone('eyes', DEWBEAR_SEAM.ink) === BLUE_COLOR.seamEdge && tone('eyes', DEWBEAR_SEAM.mid) === BLUE_COLOR.seamMid, 'the seams: warm light, edge to core')
{ const [r, g2, b] = hexRgb(BLUE_COLOR.seam), [er, , eb] = hexRgb(BLUE_COLOR.seamEdge); ok(r >= g2 && g2 > b && r > 0.95 && b > 0.8, 'the seam\'s core is pale and warm'); ok(er > eb + 0.2, 'its edge warmer still, no ink') }
for (const h of ['#160802', '#8f3205', '#060201', '#0a1e2a', '#fffbec', '#db711b']) ok(tone('eyes', h) === h, `the eyes keep ${h}`)
ok(tone('body', '#6fafc2') === BLUE_COLOR.deep && tone('body', '#a9dbe1') === BLUE_COLOR.light, 'the plates: the Dewbear\'s shade range onto Blue\'s dew-blue')
{ const a = hexRgb(tone('body', '#8fc6d2')), o = hexRgb('#8fc6d2'); ok(a[2] > a[0] + 0.2 && a[1] > a[0] + 0.2 && (Math.max(...a) - Math.min(...a)) > (Math.max(...o) - Math.min(...o)), 'dew-blue: bluer and cleaner than the species\' blue-grey') }
ok(tone('body', '#fffdf4') === BLUE_COLOR.belly && tone('eyes', '#8dd5db') !== '#8dd5db' && tone('eyes', '#e7f8f8') === '#e7f8f8', 'pale belly; the lids and beads go with the skin')
ok(tone('body', '#bcc0cb') === BLUE_COLOR.blush, 'a faint blush')
{ // tint works on a copy's attribute; the source is not written
  const srcA = new THREE.BufferAttribute(new Uint8Array([0x6f, 0xaf, 0xc2, 255, 0xff, 0xd3, 0x71, 255]), 4, true), cp = srcA.clone(); blueTint('eyes', cp)
  ok(srcA.getX(0) === 0x6f / 255 && Math.abs(cp.getX(1) - 1) < 0.01 && Math.abs(cp.getZ(1) - hexRgb(BLUE_COLOR.seam)[2]) < 0.01, 'only the copy is re-toned') }
ok(/clone\(src\)/.test(src('../ather/glade-blue.tsx')) && /m\.geometry = m\.geometry\.clone\(\)/.test(src('../ather/glade-blue.tsx')), 'Blue tints a copy of the scene and of its geometry')
ok(!/blue-look|glade-blue/.test(src('../ather/spirit-model.tsx') + src('../ather/spirit-models.ts') + src('../ather/spirit-rig-body.ts')), 'the spirits\' own models never pass through Blue\'s tones')
ok(Math.abs(BLUE_AT.x) > 0.75 + 0.4, 'Blue lies off the bench\'s end, not under it')
console.log(`greg-figure: ${n} checks${process.exitCode ? ' FAIL' : ' ok'}`)
