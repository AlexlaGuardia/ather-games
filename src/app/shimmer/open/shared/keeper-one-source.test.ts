// ONE SOURCE PER PROPORTION (BETA M216, Alex 11-26: "the chin taper is set to 0 but ... the last set of eyes came with its own
// head chin taper ... a double chin look ... make sure everything that gets added to the bench works in sync with the rest").
// The guard: a body-bench dial is the ONLY thing that sets its proportion, for EVERY face (Classic + the four sets) and the
// bench's try-on options. Run: npx tsx src/app/shimmer/open/shared/keeper-one-source.test.ts
import * as THREE from 'three'
import { DIALS, DEFAULT_PROPORTIONS, MODELS, type DialKey, type Proportions } from './keeper-proportions'
import { buildKeeper } from './keeper-figure'
import { FACE_SETS } from './keeper-faces'
import { DEFAULT_LOOK, OPT, type Look } from './keeper-look'
import { BENCH_TORSOS, benchKeeper } from '../../dev/keeper-body/bench-looks'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const KEYS = new Set<string>(DIALS.map(d => d.key))
const FACES = OPT.face.map((_, i) => i)   // 0 = Classic, 1-4 = the sets
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

// a part's world-space fingerprint (every vertex of every mesh under it), so a check sees size, shape AND placement
function partSigs(look: Look, p: Proportions) {
  const k = buildKeeper(look, p); k.group.updateMatrixWorld(true)
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
for (const face of FACES) {
  const pos = headMesh({ ...DEFAULT_LOOK, face }, DEFAULT_PROPORTIONS).geometry.attributes.position
  let worst = 0
  for (let i = 0; i < pos.count; i++) worst = Math.max(worst, Math.abs(Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i)) - 1))
  ok(worst < 1e-6, `face ${face}: chin taper 0 + chin length 0 is not the round head (off by ${worst.toFixed(4)}): a part bakes its own chin`)
}

// 3. THE HEAD IS THE DIALS', NOT THE FACE'S: the same dials give the same head geometry, size and height under every face
const tuned: Proportions = { ...DEFAULT_PROPORTIONS, headW: 0.83, headH: 0.77, jaw: 0.4, chin: 0.1, neck: 0.03 }
for (const m of MODELS) {
  const [f, t] = m.split('-'), base = { ...DEFAULT_LOOK, frame: ['small', 'medium', 'large'].indexOf(f), torso: ['broad', 'curved'].indexOf(t) }
  const ref = buildKeeper({ ...base, face: 0 }, tuned), refHead = ref.group.getObjectByName('head')!
  for (const face of FACES.slice(1)) {
    const k = buildKeeper({ ...base, face }, tuned), h = k.group.getObjectByName('head')!
    ok((h.children[0] as THREE.Mesh).geometry === (refHead.children[0] as THREE.Mesh).geometry, `${m} face ${face}: head geometry is not the dials' (a face bakes a taper / chin)`)
    ok(h.scale.equals(new THREE.Vector3(tuned.headW, tuned.headH, tuned.headW)), `${m} face ${face}: head size ${h.scale.toArray()} is not the dials'`)
    ok(k.headY === ref.headY && k.height === ref.height, `${m} face ${face}: head height differs from Classic under the same dials`)
  }
}

// 4. EVERY DIAL MOVES ITS OWN PART (and only parts it is allowed to carry), on EVERY face: a face that ignores a head dial,
//    or a dial that drags an unrelated part, fails here. Torso length / leg length carry what rides on the torso.
const OWN: Record<DialKey, readonly string[]> = {
  headW: ['head'], headH: ['head'], jaw: ['head'], chin: ['head'], eye: ['head'], ear: ['head'], eyeGap: ['head'], eyeLift: ['head'], neck: ['head'],
  torsoL: ['body', 'head', 'hand-l', 'hand-r'], torsoW: ['body', 'hand-l', 'hand-r'], torsoD: ['body'], scarf: ['body'],
  hand: ['hand-l', 'hand-r'], handX: ['hand-l', 'hand-r'], handY: ['hand-l', 'hand-r'], handZ: ['hand-l', 'hand-r'],
  foot: ['foot-l', 'foot-r'], footX: ['foot-l', 'foot-r'], legs: ['body', 'head', 'hand-l', 'hand-r'],
}
const MAIN: Partial<Record<DialKey, string>> = { torsoL: 'body', torsoW: 'body', legs: 'body' }
ok(DIALS.every(d => OWN[d.key]?.length), 'a dial has no OWN row in this guard: add one when you add a dial')
for (const face of FACES) {
  const look: Look = { ...DEFAULT_LOOK, face, eyes: 2 }   // Classic: Round eyes (the eye dial sizes whites + pupils)
  const at0 = partSigs(look, DEFAULT_PROPORTIONS).out
  for (const d of DIALS) {
    const v = d.def + (d.max - d.def > d.def - d.min ? (d.max - d.def) * 0.6 : -(d.def - d.min) * 0.6)
    const moved = partSigs(look, { ...DEFAULT_PROPORTIONS, [d.key]: v }).out
    const changed = PARTS.filter(n => moved[n] !== at0[n])
    const main = MAIN[d.key] ?? OWN[d.key][0]
    ok(changed.includes(main), `face ${face}: dial ${d.key} did not move its own part (${main}): a part ignores the dial`)
    const stray = changed.filter(n => !OWN[d.key].includes(n))
    ok(stray.length === 0, `face ${face}: dial ${d.key} also moved ${stray.join(', ')}`)
  }
}

// 5. THE BENCH LAYS NOTHING OVER THE SLIDERS: every try-on torso builds with exactly the sliders' numbers
const fem: Look = { ...DEFAULT_LOOK, torso: 1 }
for (let t = 0; t < BENCH_TORSOS.length; t++) {
  const b = benchKeeper(fem, tuned, { face: 2, mouth: 0, torso: t }), live = buildKeeper({ ...fem, face: 2 }, tuned)
  ok(b.height === live.height && b.headY === live.headY, `bench torso ${t}: build height differs from the sliders' (an option lays dials over them)`)
  for (const n of ['hand-l', 'foot-r', 'head']) ok(b.group.getObjectByName(n)!.position.equals(live.group.getObjectByName(n)!.position), `bench torso ${t}: ${n} not where the sliders put it`)
}

console.log(`keeper-one-source: ${pass} pass, ${fails.length} fail`)
if (fails.length) { console.log(fails.join('\n')); process.exit(1) }
