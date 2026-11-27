// M116c body-bench try-on options. Run: npx tsx src/app/shimmer/dev/keeper-body/bench-looks.test.ts
import * as THREE from 'three'
import { readFileSync } from 'fs'
import { BENCH_MOUTHS, BENCH_TORSOS, DEFAULT_BENCH, HEAD_STARTS, benchKeeper, defaultBench, pickHead, pickTorso, parseBench, parseBenchFile, isDefaultBench } from './bench-looks'
import { TORSO_STARTS } from '../../open/shared/keeper-bodies'
import { buildKeeper } from '../../open/shared/keeper-figure'
import { DEFAULT_LOOK, OPT, type Look } from '../../open/shared/keeper-look'
import { DEFAULT_PROPORTIONS, MODELS, proportionsFor } from '../../open/shared/keeper-proportions'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const stats = (g: THREE.Object3D) => { let n = 0, mouth = 0; g.traverse(o => { if ((o as THREE.Mesh).isMesh) { n++; if (o.userData.mouth) mouth++ } }); return { n, mouth } }
const torsoGeoOf = (g: THREE.Object3D) => (g.getObjectByName('body')!.children[0] as THREE.Mesh).geometry
const ink = (g: THREE.Object3D) => (g.getObjectByName('body')!.children[1] as THREE.Mesh).geometry

ok(BENCH_MOUTHS.length === 6 && BENCH_MOUTHS[0] === 'Today', 'mouths: Today + the sheet\'s 5')
// M216 s2b: the T1-T3 try-on is retired; the Torso picker is the six LOCKED torso shapes (keeper-bodies.ts)
ok(BENCH_TORSOS.length === 6 && BENCH_TORSOS === OPT.torso, 'torsos: the six locked shapes, the creator\'s own row')
ok(TORSO_STARTS.length === 6, 'torso starts: one per torso')

// parse: clamp, unknown -> default, a Broad model never carries a torso
ok(JSON.stringify(parseBench('medium-curved', { face: 2, mouth: 3, torso: 3, head: 4, scarf: 5, belt: 4 })) === '{"face":2,"mouth":3,"torso":3,"head":4,"scarf":5,"belt":4}', 'parse keeps a good choice')
// a pre-s2b file (torso = a retired T1-T3 option, no scarf / belt) lands on the model's own default body
ok(JSON.stringify(parseBench('medium-curved', { torso: 3, mouth: 2 })) === JSON.stringify({ ...defaultBench('medium-curved'), mouth: 2 }), 'parse: an old T option did not land on the default body')
ok(parseBench('medium-broad', { torso: 3, scarf: 0 }).torso === 3, 'parse: an s2b torso pick on a Broad model is kept (any torso on any model)')
ok(parseBench('medium-broad', { head: 9 }).head === 0 && parseBench('medium-broad', {}).head === 0, 'parse: a bad / missing head is Classic')
// M216 s2a: picking a head COPIES its starting dials onto the sliders (like a torso), and the build lays nothing over them
ok(HEAD_STARTS.length === OPT.head.length && Object.keys(HEAD_STARTS[0]).length === 0, 'head starts: one per head, Classic none')
ok(pickHead(DEFAULT_PROPORTIONS, 3).jaw === HEAD_STARTS[3].jaw && pickHead(DEFAULT_PROPORTIONS, 0).jaw === DEFAULT_PROPORTIONS.jaw, 'pickHead: B male copies its start, Classic leaves the sliders')
// M225 (Alex 11-27): every cartoon head starts on the CLASSIC head shape: chin taper 0 + chin length 0, whatever was dialled
{ const tapered = { ...DEFAULT_PROPORTIONS, jaw: 0.6, chin: 0.2 }
  for (let h = 1; h < OPT.head.length; h++) { const q = pickHead(tapered, h); ok(q.jaw === 0 && q.chin === 0, `M225: head ${h} picked lands on chin taper 0 / chin length 0 (got ${q.jaw} / ${q.chin})`) }
  ok(pickHead(tapered, 0).jaw === 0.6, 'M225: Classic leaves a dialled taper alone') }
ok(isDefaultBench(parseBench('small-curved', { face: 9, mouth: -1, torso: 1.5, head: 0, scarf: 9, belt: -1 }), 'small-curved'), 'bad values not clamped to default')
ok(isDefaultBench(parseBench('small-curved', 'junk'), 'small-curved'), 'junk not default')
ok(defaultBench('small-curved').torso === 1 && defaultBench('large-broad').torso === 0, 'default body: Curved = A female, Broad = A male')
ok(Object.keys(parseBenchFile(null)).length === MODELS.length, 'file parse lacks a model')

// the default bench choice is today's keeper exactly (the bench shows what ships)
for (const m of MODELS) {
  const [f, t] = m.split('-'), look: Look = { ...DEFAULT_LOOK, frame: ['small', 'medium', 'large'].indexOf(f), torso: ['broad', 'curved'].indexOf(t) }
  const p = proportionsFor(look), a = buildKeeper(look, p), b = benchKeeper(look, p, defaultBench(m))
  ok(stats(a.group).n === stats(b.group).n && a.height === b.height && torsoGeoOf(a.group) === torsoGeoOf(b.group), `${m}: default bench differs from today`)
  ok(stats(a.group).mouth > 0, `${m}: live Mouth row meshes not tagged`)
}
// the tag is the ONLY change to the live builder: every Mouth-row option still tags something, and the eyes are never tagged
for (let mo = 0; mo < OPT.mouth.length; mo++) for (const face of [0, 2]) {
  const k = buildKeeper({ ...DEFAULT_LOOK, mouth: mo, face })
  const tagged: THREE.Object3D[] = []; k.group.traverse(o => { if (o.userData.mouth) tagged.push(o) })
  ok(tagged.length > 0 && tagged.length <= 3, `Mouth ${OPT.mouth[mo]} face ${face}: tagged ${tagged.length}`)
  ok(tagged.every(o => o.parent?.name === 'head'), 'a tagged mesh is not on the head')
}

// each mouth replaces today's mouth, and each differs from the others
const fem: Look = { ...DEFAULT_LOOK, torso: 1 }, pf = proportionsFor(fem)
const mouthSig = (b: typeof DEFAULT_BENCH) => { const h = benchKeeper(fem, pf, b).group.getObjectByName('head')!; return h.children.filter(c => c.userData.mouth).map(c => `${(c as THREE.Mesh).geometry.uuid}${c.position.x.toFixed(4)}`).join(',') }
const mSigs = new Set<string>()
for (let m = 1; m <= 5; m++) for (const face of [0, 1, 4]) {
  const k = benchKeeper(fem, pf, { ...defaultBench('medium-curved'), face, mouth: m }), head = k.group.getObjectByName('head')!
  const mouth = head.children.filter(c => c.userData.mouth)
  ok(mouth.length >= 1 && mouth.every(c => (c as THREE.Mesh).material instanceof THREE.MeshBasicMaterial && ((c as THREE.Mesh).material as THREE.Material).side === THREE.DoubleSide), `mouth ${m} face ${face}: not drawn as DoubleSide decals`)
  ok(mouth.every(c => c.position.z > 0.2), `mouth ${m} face ${face}: not on the face front`)
  if (face === 0) mSigs.add(mouthSig({ ...defaultBench('medium-curved'), mouth: m }))
}
mSigs.add(mouthSig(defaultBench('medium-curved')))
ok(mSigs.size === 6, `mouths not all distinct (${mSigs.size})`)

// M216 s2b: each torso pick builds its own lathe (mesh + ink hull) and its starts are COPIED onto the sliders at pick,
// never laid over; each scarf and belt pick changes the body; the bench's pick = the creator's Look exactly
const torsoes = new Set<string>()
for (let t = 0; t < 6; t++) {
  const k = benchKeeper(fem, pf, { ...defaultBench('medium-curved'), torso: t })
  ok(torsoGeoOf(k.group) === ink(k.group), `torso ${t}: ink hull not the mesh's shape`)
  torsoes.add(torsoGeoOf(k.group).uuid)
  const d = pickTorso(pf, t)
  for (const [key, v] of Object.entries(TORSO_STARTS[t])) ok(d[key as keyof typeof d] === v, `torso ${t}: pick did not copy ${key} onto the sliders`)
  ok(k.height === buildKeeper({ ...fem }, pf).height, `torso ${t}: the build laid its dials over the sliders (height moved)`)
  ok(torsoGeoOf(k.group) === torsoGeoOf(buildKeeper({ ...fem, torso: t }, pf).group), `torso ${t}: bench shape is not the creator's`)
}
ok(torsoes.size === 6, 'torso options do not each give a distinct shape')
const bodySig = (b: typeof DEFAULT_BENCH) => { const g = benchKeeper(fem, pf, b).group; g.updateMatrixWorld(true); const v = new THREE.Vector3(); let s = 0, n = 0
  g.getObjectByName('body')!.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const pos = m.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); s += v.x * 1.3 + v.y * 0.7 + v.z * 2.9; n++ } }); return `${n}|${s.toFixed(5)}` }
const scs = new Set<string>(), bes = new Set<string>()
for (let i = 0; i < OPT.scarfStyle.length; i++) scs.add(bodySig({ ...defaultBench('medium-curved'), scarf: i }))
for (let i = 0; i < OPT.belt.length; i++) bes.add(bodySig({ ...defaultBench('medium-curved'), belt: i }))
ok(scs.size === 6, `scarf picks not all distinct (${scs.size})`)
ok(bes.size === 5, `belt picks not all distinct (${bes.size})`)
ok(stats(buildKeeper(fem).group).mouth === stats(buildKeeper(fem).group).mouth && stats(benchKeeper(fem, pf, { ...defaultBench('medium-curved'), mouth: 3 }).group).mouth === 3, 'mouth 3 should be 3 meshes')

// M225: the Hair size / height / forward dials move EVERY hair piece (cap + locks) as one, on every head, and nothing else
{ const wp = (k: ReturnType<typeof buildKeeper>, name: string) => { k.group.updateMatrixWorld(true); const v: number[] = []; k.group.getObjectByName(name)!.traverse(o => { if ((o as THREE.Mesh).isMesh) { const w = new THREE.Vector3(); (o as THREE.Mesh).getWorldPosition(w); const s = new THREE.Vector3(); o.getWorldScale(s); v.push(w.x, w.y, w.z, s.x, s.y) } }); return v }
  const faceOnly = (k: ReturnType<typeof buildKeeper>) => { const v: number[] = []; k.group.updateMatrixWorld(true); k.group.getObjectByName('head')!.traverse(o => { if ((o as THREE.Mesh).isMesh && o.parent?.name !== 'hair') { const w = new THREE.Vector3(); (o as THREE.Mesh).getWorldPosition(w); v.push(w.x, w.y, w.z) } }); return v.map(n => n.toFixed(5)).join(',') }
  for (const head of [0, 1, 4, 8]) {
    const look = { ...DEFAULT_LOOK, head }, p = proportionsFor(look), a = buildKeeper(look, p)
    const hair = a.group.getObjectByName('hair')
    ok(!!hair && hair.children.length > 4, `M225 head ${head}: the hair pieces ride one 'hair' group (${hair?.children.length})`)
    const hairC = new THREE.Color(OPT.hair[look.hair]); let stray = 0
    a.group.getObjectByName('head')!.traverse(o => { const m = o as THREE.Mesh, mat = m.material as THREE.MeshToonMaterial; if (m.isMesh && mat?.isMeshToonMaterial && mat.color.equals(hairC) && o.parent !== hair) stray++ })
    ok(stray === 0, `M225 head ${head}: every hair-coloured piece is in the hair group (${stray} outside)`)
    const hairGeos = new Set<string>(); hair?.children.forEach(o => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.MeshToonMaterial).isMeshToonMaterial) hairGeos.add(m.geometry.uuid) })
    let strayInk = 0; a.group.getObjectByName('head')!.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && hairGeos.has(m.geometry.uuid) && o.parent !== hair) strayInk++ })
    ok(strayInk === 0, `M225 head ${head}: every hair piece's ink outline rides the hair group too (${strayInk} outside)`)
    for (const [k, v] of [['hairSize', 1.2], ['hairY', 0.04], ['hairZ', -0.03]] as const) {
      const b = buildKeeper(look, { ...p, [k]: v })
      const ha = wp(a, 'hair'), hb = wp(b, 'hair')
      ok(ha.length === hb.length && ha.some((n, i) => Math.abs(n - hb[i]) > 1e-4), `M225 head ${head}: ${k} moves the hair`)
      ok(faceOnly(a) === faceOnly(b) && a.height === b.height, `M225 head ${head}: ${k} moves nothing but the hair`)
    }
  }
}
// nothing in the game imports the bench options
import { execSync } from 'child_process'
const users = execSync("grep -rl \"bench-looks\" src --include=*.ts --include=*.tsx || true").toString().trim().split('\n').filter(Boolean).sort()
ok(JSON.stringify(users) === JSON.stringify(['src/app/shimmer/dev/keeper-body/bench-looks.test.ts', 'src/app/shimmer/dev/keeper-body/page.tsx', 'src/app/shimmer/open/shared/keeper-one-source.test.ts', 'src/app/shimmer/save-keeper-bench/route.ts']), `bench-looks imported outside the bench: ${users.join(', ')}`)

console.log(`bench-looks: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
