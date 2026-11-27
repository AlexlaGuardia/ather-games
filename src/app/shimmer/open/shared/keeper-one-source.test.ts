// ONE SOURCE PER PROPORTION (BETA M216, Alex 11-26: "the chin taper is set to 0 but ... the last set of eyes came with its own
// head chin taper ... a double chin look ... make sure everything that gets added to the bench works in sync with the rest").
// The guard: a body-bench dial is the ONLY thing that sets its proportion, for EVERY face (Classic + the four sets) and the
// bench's try-on options. Run: npx tsx src/app/shimmer/open/shared/keeper-one-source.test.ts
import * as THREE from 'three'
import { DIALS, DEFAULT_PROPORTIONS, MODELS, type DialKey, type Proportions } from './keeper-proportions'
import { buildKeeper, type KeeperDress } from './keeper-figure'
import { FRIEND_LOOKS, friendProportions } from './friend-looks'
import { FRIEND_IDS } from './friend-figure'
import { APRON } from './keeper-bodies'
import { FACE_SETS } from './keeper-faces'
import { CARTOON_HEADS, CARTOON } from './keeper-heads'
import { DEFAULT_LOOK, OPT, type Look } from './keeper-look'
import { BENCH_TORSOS, benchKeeper, defaultBench } from '../../dev/keeper-body/bench-looks'
import { TORSO_SHAPES, TORSO_R, SCARF_STYLES, BELT_STYLES, SCARF, BELT } from './keeper-bodies'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const KEYS = new Set<string>(DIALS.map(d => d.key))
const FACES = OPT.face.map((_, i) => i)   // 0 = Classic, 1-4 = the sets
// M216 s2a: every look the guard walks = Classic + the four face sets + the eight cartoon heads (A-D x male / female)
const VARIANTS: readonly { tag: string; face: number; head: number }[] = [
  ...FACES.map(face => ({ tag: `face ${face}`, face, head: 0 })),
  ...CARTOON_HEADS.map((c, i) => ({ tag: `head ${c.letter}-${c.sex}`, face: 0, head: i + 1 })),
]
const PARTS: readonly string[] = ['head', 'body', 'hand-l', 'hand-r', 'foot-l', 'foot-r']

// 1. NO PART CARRIES A DIAL'S KEY: a face set is eyes + brows only (the M116 sets carried jaw + chin = the double chin)
const deepKeys = (o: unknown, out = new Set<string>()): Set<string> => {
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { out.add(k); deepKeys(v, out) }
  return out
}
FACE_SETS.forEach((f, i) => {
  const hit = [...deepKeys(f)].filter(k => KEYS.has(k) || k === 'headW' || k === 'headH')
  ok(hit.length === 0, `face set ${i + 1} carries dial-owned key(s) ${hit.join(', ')}: route them through the dial`)
})
// 1b. A CARTOON HEAD IS A SHAPE ONLY (M216 s2a): no dial key, and none of the shared place / size names (those live once in
//     keeper-heads.ts CARTOON, scaled + moved by the dials). A head that brings its own eye size or mouth height fails here.
const PLACE = new Set<string>([...Object.keys(CARTOON), 'headW', 'headH', 'size', 'scale', 'w', 'h', 'x', 'y', 'gap', 'lift', 'jawW', 'taper'])
ok(CARTOON_HEADS.length === OPT.head.length - 1, `one cartoon head per Head option (${CARTOON_HEADS.length} vs ${OPT.head.length - 1})`)
CARTOON_HEADS.forEach((c, i) => {
  const hit = [...deepKeys(c)].filter(k => KEYS.has(k) || PLACE.has(k))
  ok(hit.length === 0, `head ${i + 1} (${c.letter}-${c.sex}) carries proportion key(s) ${hit.join(', ')}: route them through a dial`)
})

// a part's world-space fingerprint (every vertex of every mesh under it), so a check sees size, shape AND placement
function partSigs(look: Look, p: Proportions, dress: KeeperDress = {}) {
  const k = buildKeeper(look, p, dress); k.group.updateMatrixWorld(true)
  const v = new THREE.Vector3(), out: Record<string, string> = {}
  for (const name of PARTS) {
    let sx = 0, sy = 0, sz = 0, n = 0
    k.group.getObjectByName(name)!.traverse(o => {
      const m = o as THREE.Mesh; if (!m.isMesh) return
      const pos = m.geometry.attributes.position
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); sx += v.x * (1 + (i % 7)) + Math.abs(v.x) * 3.1; sy += v.y * (1 + (i % 5)); sz += v.z * (1 + (i % 3)); n++ }
    })
    out[name] = `${n}|${sx.toFixed(6)}|${sy.toFixed(6)}|${sz.toFixed(6)}`
  }
  return { out, k }
}
const headMesh = (look: Look, p: Proportions) => buildKeeper(look, p).group.getObjectByName('head')!.children[0] as THREE.Mesh

// 2. CHIN TAPER 0 + CHIN LENGTH 0 = THE ROUND HEAD on every face: no taper, no extra chin, no double chin
for (const { tag, face, head } of VARIANTS) {
  const pos = headMesh({ ...DEFAULT_LOOK, face, head }, DEFAULT_PROPORTIONS).geometry.attributes.position
  let worst = 0
  for (let i = 0; i < pos.count; i++) worst = Math.max(worst, Math.abs(Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i)) - 1))
  ok(worst < 1e-6, `${tag}: chin taper 0 + chin length 0 is not the round head (off by ${worst.toFixed(4)}): a part bakes its own chin`)
}

// 3. THE HEAD IS THE DIALS', NOT THE FACE'S: the same dials give the same head geometry, size and height under every face
const tuned: Proportions = { ...DEFAULT_PROPORTIONS, headW: 0.83, headH: 0.77, jaw: 0.4, chin: 0.1, neck: 0.03 }
for (const m of MODELS) {
  const [f, t] = m.split('-'), base = { ...DEFAULT_LOOK, frame: ['small', 'medium', 'large'].indexOf(f), torso: ['broad', 'curved'].indexOf(t) }
  const ref = buildKeeper({ ...base, face: 0 }, tuned), refHead = ref.group.getObjectByName('head')!
  for (const { tag, face, head } of VARIANTS.slice(1)) {
    const k = buildKeeper({ ...base, face, head }, tuned), h = k.group.getObjectByName('head')!
    ok((h.children[0] as THREE.Mesh).geometry === (refHead.children[0] as THREE.Mesh).geometry, `${m} ${tag}: head geometry is not the dials' (a face bakes a taper / chin)`)
    ok(h.scale.equals(new THREE.Vector3(tuned.headW, tuned.headH, tuned.headW)), `${m} ${tag}: head size ${h.scale.toArray()} is not the dials'`)
    ok(k.headY === ref.headY && k.height === ref.height, `${m} ${tag}: head height differs from Classic under the same dials`)
  }
}

// 4. EVERY DIAL MOVES ITS OWN PART (and only parts it is allowed to carry), on EVERY face: a face that ignores a head dial,
//    or a dial that drags an unrelated part, fails here. Torso length / leg length carry what rides on the torso.
const OWN: Record<DialKey, readonly string[]> = {
  headW: ['head'], headH: ['head'], jaw: ['head'], chin: ['head'], eye: ['head'], ear: ['head'], eyeGap: ['head'], eyeLift: ['head'], neck: ['head'], mouthLift: ['head'],
  torsoL: ['body', 'head', 'hand-l', 'hand-r'], torsoW: ['body', 'hand-l', 'hand-r'], torsoD: ['body'], scarf: ['body'],
  hand: ['hand-l', 'hand-r'], handX: ['hand-l', 'hand-r'], handY: ['hand-l', 'hand-r'], handZ: ['hand-l', 'hand-r'],
  foot: ['foot-l', 'foot-r'], footX: ['foot-l', 'foot-r'], legs: ['body', 'head', 'hand-l', 'hand-r'],
  belt: ['body'], beltY: ['body'],
}
const MAIN: Partial<Record<DialKey, string>> = { torsoL: 'body', torsoW: 'body', legs: 'body' }
ok(DIALS.every(d => OWN[d.key]?.length), 'a dial has no OWN row in this guard: add one when you add a dial')
for (const { tag, face, head } of VARIANTS) {
  const look: Look = { ...DEFAULT_LOOK, face, head, eyes: 2 }   // Classic: Round eyes (the eye dial sizes whites + pupils)
  const at0 = partSigs(look, DEFAULT_PROPORTIONS).out
  for (const d of DIALS) {
    const v = d.def + (d.max - d.def > d.def - d.min ? (d.max - d.def) * 0.6 : -(d.def - d.min) * 0.6)
    const moved = partSigs(look, { ...DEFAULT_PROPORTIONS, [d.key]: v }).out
    const changed = PARTS.filter(n => moved[n] !== at0[n])
    const main = MAIN[d.key] ?? OWN[d.key][0]
    ok(changed.includes(main), `${tag}: dial ${d.key} did not move its own part (${main}): a part ignores the dial`)
    const stray = changed.filter(n => !OWN[d.key].includes(n))
    ok(stray.length === 0, `${tag}: dial ${d.key} also moved ${stray.join(', ')}`)
  }
}

// 5. THE BENCH LAYS NOTHING OVER THE SLIDERS: every try-on torso builds with exactly the sliders' numbers
const fem: Look = { ...DEFAULT_LOOK, torso: 1 }
for (let t = 0; t < BENCH_TORSOS.length; t++) {
  const bb = { ...defaultBench('medium-curved'), face: 2, torso: t }, b = benchKeeper(fem, tuned, bb), live = buildKeeper({ ...fem, face: 2, torso: t, scarfStyle: bb.scarf, belt: bb.belt }, tuned)
  ok(b.height === live.height && b.headY === live.headY, `bench torso ${t}: build height differs from the sliders' (an option lays dials over them)`)
  for (const n of ['hand-l', 'foot-r', 'head']) ok(b.group.getObjectByName(n)!.position.equals(live.group.getObjectByName(n)!.position), `bench torso ${t}: ${n} not where the sliders put it`)
}
for (let head = 1; head <= CARTOON_HEADS.length; head++) {
  const b = benchKeeper(fem, tuned, { ...defaultBench('medium-curved'), head }), live = buildKeeper({ ...fem, head }, tuned)
  ok(b.height === live.height && b.headY === live.headY, `bench head ${head}: build height differs from the sliders'`)
}

// 6. EVERY CARTOON HEAD'S FACE SITS ON THE ONE SHARED PLACE (M216 s2a): under the same dials the eyes and the mouth of all
//    eight heads are in the same spot, and the eye dial scales every head's eye whites by exactly its factor. A head that
//    nudges its own eyes / mouth (a baked spacing, height or size) fails here even if it hides the number under a new name.
const facePlace = (head: number, p: Proportions) => {
  const hg = buildKeeper({ ...DEFAULT_LOOK, head }, p).group.getObjectByName('head')!
  const e = hg.getObjectByName('eye-l')!, r = hg.getObjectByName('eye-r')!, mo = hg.getObjectByName('mouth')!
  const white = e.children[0] as THREE.Mesh; white.geometry.computeBoundingBox()
  const bb = white.geometry.boundingBox!
  return { eye: e.position.toArray().map(v => v.toFixed(6)).join(','), eyeR: r.position.toArray().map(v => v.toFixed(6)).join(','), mouth: mo.position.toArray().map(v => v.toFixed(6)).join(','), w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y }
}
for (const p of [DEFAULT_PROPORTIONS, tuned, { ...tuned, eyeGap: 0.02, eyeLift: -0.015, mouthLift: 0.03 }]) {
  const ref = facePlace(1, p)
  for (let head = 2; head <= CARTOON_HEADS.length; head++) {
    const f = facePlace(head, p)
    ok(f.eye === ref.eye && f.eyeR === ref.eyeR, `head ${head}: eyes at ${f.eye} not the shared place ${ref.eye} (a head bakes its own eye spacing / height)`)
    ok(f.mouth === ref.mouth, `head ${head}: mouth at ${f.mouth} not the shared line ${ref.mouth} (a head bakes its own mouth height)`)
  }
}
const H0 = 0.5 * 1.15
ok(Math.abs(Number(facePlace(1, DEFAULT_PROPORTIONS).mouth.split(',')[1]) - H0 * CARTOON.mouthY) < 1e-6, 'head mouth at dial 0 is not the shared CARTOON mouth line')
for (let head = 1; head <= CARTOON_HEADS.length; head++) {
  const a = facePlace(head, DEFAULT_PROPORTIONS), b = facePlace(head, { ...DEFAULT_PROPORTIONS, eye: 1.3 })
  ok(Math.abs(b.w / a.w - 1.3) < 1e-3 && Math.abs(b.h / a.h - 1.3) < 1e-3, `head ${head}: eye dial 1.3 scaled the white by ${(b.w / a.w).toFixed(3)} x ${(b.h / a.h).toFixed(3)}`)
}
// the shared eye size is ONE size: every head's white spans the same share of the shared box width (outlines fill the unit box)
const spans = CARTOON_HEADS.map((_, i) => facePlace(i + 1, DEFAULT_PROPORTIONS).w / (H0 * CARTOON.eyeW))
ok(spans.every(s => s > 0.88 && s < 1.08), `a head's eye outline does not fill the shared box (${spans.map(s => s.toFixed(2)).join(' ')}): a size hidden in the outline`)

// ── 7. M216 s2b: THE BODY VARIETY SET (six torsos, six scarves, five belts) BRINGS SHAPE ONLY ──
// 7a. every torso is a UNIT outline: widest point exactly 1, bottom (0, 0), top at height 1, height never turning back. A
//     torso that is wider (or taller) than the box hides a size TORSO_R / the Torso dials should own.
ok(TORSO_SHAPES.length === OPT.torso.length && SCARF_STYLES.length === OPT.scarfStyle.length && BELT_STYLES.length === OPT.belt.length, 'one shape per Torso / Scarf shape / Belt option')
TORSO_SHAPES.forEach((t, i) => {
  const rs = t.prof.map(q => q[0]), ys = t.prof.map(q => q[1])
  ok(Math.max(...rs) === 1, `torso ${i} (${t.tag}): widest point ${Math.max(...rs)} is not the unit box (a size baked into the shape)`)
  ok(ys[0] === 0 && rs[0] === 0 && ys[ys.length - 1] === 1 && ys.every((y, k) => !k || y >= ys[k - 1]), `torso ${i} (${t.tag}): outline does not run 0..1 up the box (a length baked in)`)
  ok(Object.keys(t).sort().join() === 'prof,tag', `torso ${i}: carries more than a tag + outline (${Object.keys(t).join(',')})`)
})
// 7b. a scarf / belt is words + a side: no dial or place key, and no number but -1 / 0 / 1 (a side). Every length, thickness
//     and place lives once in SCARF / BELT. A style that brings its own tail length or belt height fails here.
const leaves = (o: unknown, out: unknown[] = []): unknown[] => { if (o && typeof o === 'object') Object.values(o).forEach(v => leaves(v, out)); else out.push(o); return out }
const SHAPE_PLACE = new Set<string>([...PLACE, ...Object.keys(SCARF), ...Object.keys(BELT), 'len', 'length', 'r', 'radius', 'height', 'at', 'drop', 'angle'])
for (const [kind, list] of [['scarf', SCARF_STYLES], ['belt', BELT_STYLES]] as const) list.forEach((st, i) => {
  // a key named like a size / place is allowed only as a WORD or a side ('knot: -1', 'buckle: \'ring\''), never a number
  const named: string[] = []
  const walk = (o: unknown) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (KEYS.has(k) || (SHAPE_PLACE.has(k) && typeof v !== 'string' && v !== -1 && v !== 0 && v !== 1 && !Array.isArray(v))) named.push(k); walk(v) } }
  walk(st); const keys = named
  ok(keys.length === 0, `${kind} ${i} (${st.tag}): carries proportion key(s) ${keys.join(', ')}`)
  const nums = leaves(st).filter(v => typeof v === 'number')
  ok(nums.every(v => v === -1 || v === 0 || v === 1), `${kind} ${i} (${st.tag}): carries a number that is not a side (${nums.join(',')}): a size / place baked in`)
})
// 7c. under the same dials every torso fills the SAME box: its widest point = TORSO_R x the width scale, its height = the
//     torso length; every belt rides at the SAME height (the Belt height dial) and every scarf ring sits in the SAME place
const torsoBox = (look: Look, p: Proportions) => {
  const b = buildKeeper(look, p), body = b.group.getObjectByName('body')!, t = body.children[0] as THREE.Mesh
  t.geometry.computeBoundingBox(); const bb = t.geometry.boundingBox!
  return { w: ((bb.max.x - bb.min.x) / 2) * t.scale.x, h: (bb.max.y - bb.min.y) * t.scale.y, sx: t.scale.x, belt: body.getObjectByName('belt')!.position.y, ring: (body.children[2] as THREE.Mesh).position.toArray().join(','), ringS: (body.children[2] as THREE.Mesh).scale.toArray().join(',') }
}
for (const p of [DEFAULT_PROPORTIONS, { ...tuned, torsoW: 1.2, torsoL: 0.9, beltY: 0.05, belt: 1.3, scarf: 1.2 }]) {
  const ref = torsoBox({ ...DEFAULT_LOOK, torso: 0 }, p)
  for (let t = 0; t < TORSO_SHAPES.length; t++) for (let sc = 0; sc < SCARF_STYLES.length; sc++) for (let be = 0; be < BELT_STYLES.length; be++) {
    if (t % 2 !== (sc + be) % 2 && sc !== t) continue   // a spread of combinations, every part of each list hit
    const box = torsoBox({ ...DEFAULT_LOOK, torso: t, scarfStyle: sc, belt: be }, p)
    ok(Math.abs(box.w / box.sx - TORSO_R) < 2e-3, `torso ${t}: widest ${(box.w / box.sx).toFixed(4)} not TORSO_R ${TORSO_R} (a torso brings its own width)`)
    ok(Math.abs(box.h - ref.h) < 1e-9, `torso ${t}: height ${box.h} not the torso length dial's ${ref.h}`)
    ok(box.belt === ref.belt, `torso ${t} belt ${be}: belt at ${box.belt}, not the one Belt height ${ref.belt} (a belt / torso bakes its height)`)
    ok(box.ring === ref.ring && box.ringS === ref.ringS, `torso ${t} scarf ${sc}: scarf ring ${box.ring} x ${box.ringS} not the shared ${ref.ring} x ${ref.ringS}`)
  }
}
const bY = (p: Proportions) => torsoBox({ ...DEFAULT_LOOK }, p).belt
for (let t = 0; t < TORSO_SHAPES.length; t++) {   // the torso dials size EVERY torso by exactly their number
  const a = torsoBox({ ...DEFAULT_LOOK, torso: t }, DEFAULT_PROPORTIONS), b = torsoBox({ ...DEFAULT_LOOK, torso: t }, { ...DEFAULT_PROPORTIONS, torsoW: 1.2, torsoL: 0.9 })
  ok(Math.abs(b.w / a.w - 1.2) < 1e-6 && Math.abs(b.h / a.h - 0.9) < 1e-6, `torso ${t}: Torso width / length 1.2 / 0.9 scaled it ${(b.w / a.w).toFixed(3)} / ${(b.h / a.h).toFixed(3)} (the shape ignores a dial)`)
}
ok(Math.abs(bY({ ...DEFAULT_PROPORTIONS, beltY: 0.06 }) - bY(DEFAULT_PROPORTIONS) - 0.06) < 1e-9, 'Belt height dial does not move the belt by exactly its number')
// 7d. EVERY DIAL STILL MOVES ITS OWN PART ON EVERY NEW TORSO / SCARF / BELT (the s1 + s2a sliders and the new two)
for (let t = 0; t < TORSO_SHAPES.length; t++) for (const [sc, be] of [[t, t % BELT_STYLES.length], [(t + 3) % 6, (t + 2) % BELT_STYLES.length]]) {
  const look: Look = { ...DEFAULT_LOOK, torso: t, scarfStyle: sc, belt: be, head: t % 2 ? 4 : 0, eyes: 2 }
  const at0 = partSigs(look, DEFAULT_PROPORTIONS).out
  for (const d of DIALS) {
    const v = d.def + (d.max - d.def > d.def - d.min ? (d.max - d.def) * 0.6 : -(d.def - d.min) * 0.6)
    const moved = partSigs(look, { ...DEFAULT_PROPORTIONS, [d.key]: v }).out
    const changed = PARTS.filter(n => moved[n] !== at0[n]), main = MAIN[d.key] ?? OWN[d.key][0]
    ok(changed.includes(main), `torso ${t} scarf ${sc} belt ${be}: dial ${d.key} did not move ${main}`)
    const stray = changed.filter(n => !OWN[d.key].includes(n))
    ok(stray.length === 0, `torso ${t} scarf ${sc} belt ${be}: dial ${d.key} also moved ${stray.join(', ')}`)
  }
}
// 7e. the bench's Torso picker IS the creator's row (one list), and every scarf / belt keeps the pouch + loop count
ok(BENCH_TORSOS === OPT.torso, 'bench torso list is not the creator\'s')

// ── 8. M154: THE FRIENDS' DRESS (exact colours + hood / goggles / apron / Coily hair) BRINGS NO SIZE AND NO PLACE ──
// 8a. dressed or not, the same look + dials stand the same: crown, head, hands, feet, torso all where the dials put them
const box = (o: THREE.Object3D) => { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o) }
for (const id of FRIEND_IDS) {
  const f = FRIEND_LOOKS[id], p = friendProportions(id), bare = buildKeeper(f.look, p), worn = buildKeeper(f.look, p, f.dress)
  ok(bare.height === worn.height && bare.headY === worn.headY, `${id}: the dress moved the crown / head (${worn.height} vs ${bare.height})`)
  for (const n of ['head', 'hand-l', 'hand-r', 'foot-l', 'foot-r']) ok(bare.group.getObjectByName(n)!.position.equals(worn.group.getObjectByName(n)!.position), `${id}: the dress moved ${n}`)
  const hd = worn.group.getObjectByName('head')!
  for (const n of ['hood', 'goggles']) { const o = worn.group.getObjectByName(n); if (o) ok(o.parent === hd, `${id}: ${n} is not on the head group (the head dials would not size it)`) }
  // 8b. the apron is the torso's own outline: every torso dial scales it exactly as it scales the torso
  if (f.dress.apron) for (const q of [p, { ...p, torsoW: 1.2, torsoL: 0.9, torsoD: 1.3 }]) {
    const k = buildKeeper(f.look, q, f.dress), torso = k.group.getObjectByName('body')!.children[0] as THREE.Mesh, ap = k.group.getObjectByName('apron')!.children[0] as THREE.Mesh
    ok(ap.scale.equals(torso.scale) && k.group.getObjectByName('apron')!.position.equals(torso.position), `${id}: apron scale ${ap.scale.toArray()} / place not the torso's ${torso.scale.toArray()}`)
    const ta = box(torso), aa = box(ap)
    ok(Math.abs((aa.max.x - aa.min.x) / (ta.max.x - ta.min.x) - Math.sin(APRON.arc) * APRON.proud) < 0.03 && aa.max.y <= ta.max.y, `${id}: apron does not hug the torso (${(aa.max.x - aa.min.x).toFixed(3)} vs ${(ta.max.x - ta.min.x).toFixed(3)})`)
  }
  // 8c. every dial still moves its own part (and only its own) on each friend, dressed
  const at0 = partSigs(f.look, DEFAULT_PROPORTIONS, f.dress).out
  for (const d of DIALS) {
    const v = d.def + (d.max - d.def > d.def - d.min ? (d.max - d.def) * 0.6 : -(d.def - d.min) * 0.6)
    const moved = partSigs(f.look, { ...DEFAULT_PROPORTIONS, [d.key]: v }, f.dress).out
    const changed = PARTS.filter(n => moved[n] !== at0[n]), main = MAIN[d.key] ?? OWN[d.key][0]
    if (d.key === 'scarf' && f.dress.scarf === null) { ok(changed.length === 0, `${id} wears no scarf, yet the Scarf dial moved ${changed.join(', ')}`); continue }   // Bonn: no scarf, nothing for it to size
    ok(changed.includes(main), `${id} dressed: dial ${d.key} did not move ${main}`)
    const stray = changed.filter(n => !OWN[d.key].includes(n))
    ok(stray.length === 0, `${id} dressed: dial ${d.key} also moved ${stray.join(', ')}`)
  }
  // 8d. a friend's look is the keeper's look: a Look the creator could hold, dials inside every dial's range
  for (const [k, v] of Object.entries(p)) { const d = DIALS.find(x => x.key === k)!; ok(v >= d.min && v <= d.max, `${id}: dial ${k} ${v} outside ${d.min}..${d.max}`) }
}

console.log(`keeper-one-source: ${pass} pass, ${fails.length} fail`)
if (fails.length) { console.log(fails.join('\n')); process.exit(1) }
