// M116c body-bench try-on options. Run: npx tsx src/app/shimmer/dev/keeper-body/bench-looks.test.ts
import * as THREE from 'three'
import { readFileSync } from 'fs'
import { BENCH_MOUTHS, BENCH_TORSOS, DEFAULT_BENCH, benchKeeper, benchDials, parseBench, parseBenchFile, isDefaultBench } from './bench-looks'
import { buildKeeper } from '../../open/shared/keeper-figure'
import { DEFAULT_LOOK, OPT, type Look } from '../../open/shared/keeper-look'
import { MODELS, proportionsFor } from '../../open/shared/keeper-proportions'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const stats = (g: THREE.Object3D) => { let n = 0, mouth = 0; g.traverse(o => { if ((o as THREE.Mesh).isMesh) { n++; if (o.userData.mouth) mouth++ } }); return { n, mouth } }
const torsoGeoOf = (g: THREE.Object3D) => (g.getObjectByName('body')!.children[0] as THREE.Mesh).geometry
const ink = (g: THREE.Object3D) => (g.getObjectByName('body')!.children[1] as THREE.Mesh).geometry

ok(BENCH_MOUTHS.length === 6 && BENCH_MOUTHS[0] === 'Today', 'mouths: Today + the sheet\'s 5')
ok(BENCH_TORSOS.length === 4 && BENCH_TORSOS[0].prof === null && BENCH_TORSOS.slice(1).every(t => t.prof), 'torsos: Today + T1-T3')
ok(/T1/.test(BENCH_TORSOS[1].label) && /T2/.test(BENCH_TORSOS[2].label) && /T3/.test(BENCH_TORSOS[3].label), 'torso labels T1-T3 in order')
// the proto torso.ts numbers, copied: profiles + dials must match the sheet Alex looks at
const proto = readFileSync('docs/looks/keeper-heads-2026-11-23/torso.ts', 'utf-8')
for (const [i, key] of [[1, 'T1'], [2, 'T2'], [3, 'T3']] as const) {
  const line = proto.split('\n').slice(proto.split('\n').findIndex(l => l.includes(`key: '${key}'`))).slice(0, 2).join(' ')
  ok(line.includes(JSON.stringify(BENCH_TORSOS[i].prof).replace(/,/g, ', ')), `${key}: lathe profile differs from the proto`)
  const pd = Object.fromEntries([...(/dials: \{([^}]*)\}/.exec(line)?.[1] ?? '').matchAll(/(\w+): (-?[\d.]+)/g)].map(m => [m[1], Number(m[2])]))
  ok(JSON.stringify(pd) === JSON.stringify(BENCH_TORSOS[i].dials) && Object.keys(pd).length > 0, `${key}: dials differ from the proto (${JSON.stringify(pd)})`)
}

// parse: clamp, unknown -> default, a Broad model never carries a torso
ok(JSON.stringify(parseBench('medium-curved', { face: 2, mouth: 3, torso: 3 })) === '{"face":2,"mouth":3,"torso":3}', 'parse keeps a good choice')
ok(parseBench('medium-broad', { torso: 2 }).torso === 0, 'Broad model got a torso option')
ok(isDefaultBench(parseBench('small-curved', { face: 9, mouth: -1, torso: 1.5 })), 'bad values not clamped to default')
ok(isDefaultBench(parseBench('small-curved', 'junk')), 'junk not default')
ok(Object.keys(parseBenchFile(null)).length === MODELS.length, 'file parse lacks a model')

// the default bench choice is today's keeper exactly (the bench shows what ships)
for (const m of MODELS) {
  const [f, t] = m.split('-'), look: Look = { ...DEFAULT_LOOK, frame: ['small', 'medium', 'large'].indexOf(f), torso: ['broad', 'curved'].indexOf(t) }
  const p = proportionsFor(look), a = buildKeeper(look, p), b = benchKeeper(look, p, DEFAULT_BENCH)
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
  const k = benchKeeper(fem, pf, { face, mouth: m, torso: 0 }), head = k.group.getObjectByName('head')!
  const mouth = head.children.filter(c => c.userData.mouth)
  ok(mouth.length >= 1 && mouth.every(c => (c as THREE.Mesh).material instanceof THREE.MeshBasicMaterial && ((c as THREE.Mesh).material as THREE.Material).side === THREE.DoubleSide), `mouth ${m} face ${face}: not drawn as DoubleSide decals`)
  ok(mouth.every(c => c.position.z > 0.2), `mouth ${m} face ${face}: not on the face front`)
  if (face === 0) mSigs.add(mouthSig({ face: 0, mouth: m, torso: 0 }))
}
mSigs.add(mouthSig(DEFAULT_BENCH))
ok(mSigs.size === 6, `mouths not all distinct (${mSigs.size})`)

// each torso option swaps the lathe (mesh + ink hull) and lays its dials over the sliders; Broad ignores it
const torsoes = new Set<string>()
for (let t = 0; t <= 3; t++) {
  const k = benchKeeper(fem, pf, { face: 0, mouth: 0, torso: t })
  ok(torsoGeoOf(k.group) === ink(k.group), `torso ${t}: ink hull not swapped with the mesh`)
  torsoes.add(torsoGeoOf(k.group).uuid)
  const d = benchDials(pf, { face: 0, mouth: 0, torso: t })
  for (const [key, v] of Object.entries(BENCH_TORSOS[t].dials)) ok(d[key as keyof typeof d] === v, `torso ${t}: dial ${key} not laid over`)
}
ok(torsoes.size === 4, 'torso options do not each give a distinct shape')
const t3 = torsoGeoOf(benchKeeper(fem, pf, { face: 0, mouth: 0, torso: 3 }).group).attributes.position, t1 = torsoGeoOf(benchKeeper(fem, pf, { face: 0, mouth: 0, torso: 1 }).group).attributes.position
let front = 0; for (let i = 0; i < t3.count; i++) if (t3.getZ(i) > 0 && t3.getY(i) > 0.6 && t3.getY(i) < 0.7) front = Math.max(front, t3.getZ(i) - t1.getZ(i))
ok(front > 0.01, `T3: chest not bent forward of T1 (${front})`)
const broad = benchKeeper(DEFAULT_LOOK, proportionsFor(DEFAULT_LOOK), { face: 0, mouth: 0, torso: 2 })
ok(torsoGeoOf(broad.group) === torsoGeoOf(buildKeeper(DEFAULT_LOOK).group), 'Broad keeper took a female torso lathe')
// the bench never touches the shared caches: a later live build is unchanged
ok(torsoGeoOf(buildKeeper(fem).group) !== torsoGeoOf(benchKeeper(fem, pf, { face: 0, mouth: 0, torso: 1 }).group), 'bench lathe leaked into the live build')
ok(stats(buildKeeper(fem).group).mouth === stats(buildKeeper(fem).group).mouth && stats(benchKeeper(fem, pf, { face: 0, mouth: 3, torso: 0 }).group).mouth === 3, 'mouth 3 should be 3 meshes')

// nothing in the game imports the bench options
import { execSync } from 'child_process'
const users = execSync("grep -rl \"bench-looks\" src --include=*.ts --include=*.tsx || true").toString().trim().split('\n').filter(Boolean).sort()
ok(JSON.stringify(users) === JSON.stringify(['src/app/shimmer/dev/keeper-body/bench-looks.test.ts', 'src/app/shimmer/dev/keeper-body/page.tsx', 'src/app/shimmer/save-keeper-bench/route.ts']), `bench-looks imported outside the bench: ${users.join(', ')}`)

console.log(`bench-looks: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
