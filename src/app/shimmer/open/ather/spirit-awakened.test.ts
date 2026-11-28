// BETA M244 sheet 1: the four awakened Vulnara forms (owner preview). Run: npx tsx src/app/shimmer/open/ather/spirit-awakened.test.ts
import { existsSync, readFileSync } from 'node:fs'
import { AWAKENED_FORMS, AWAKEN_GROW, AWAKEN_LEN, SECOND_FORMS, formGrow } from './spirit-models'
import { AWAKENED_BRANCHES, AWAKENED_NAMES } from '../../spirits/spirit'
import { PUBLIC_FORMS } from './spirit-public'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const names = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.vulnara![b].toLowerCase())
ok(names.join() === 'vulnarok,vulnalys,vulnavex,vulnamyr', `the four names in branch order (${names})`)
// M244 sheet 2: Vulnarc's (Storm) four, canon-named a00621e
const stormNames = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.vulnarc![b].toLowerCase())
ok(stormNames.join() === 'vulnarkor,vulnarcelle,arcvex,vulnarceth', `Vulnarc's four in branch order (${stormNames})`)
// M244 sheet 3: Vulnore's (Earth) four, canon-named (Alex 11-27), art LOCKED-AFK athernyx 3501ec6
const earthNames = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.vulnore![b].toLowerCase())
ok(earthNames.join() === 'orethar,vulnoraya,vulnoris,vulnorun', `Vulnore's four in branch order (${earthNames})`)
// M244 sheet 4: Vulnix's (Water) four, canon-named (Alex 11-27), art LOCKED-AFK athernyx 3501ec6
const waterNames = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.vulnix![b].toLowerCase())
ok(waterNames.join() === 'vulnitar,marelle,vulnisk,vulnixeth', `Vulnix's four in branch order (${waterNames})`)
// M244 sheet 5: Luminel's (Mana) four, canon-named (Alex 11-28), art LOCKED-AFK athernyx #017-020: HOVERERS on the base Luminara's hover rig
const lumNames = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.luminel![b].toLowerCase())
ok(lumNames.join() === 'luminok,lumilys,lumivex,elhae', `Luminel's four in branch order (${lumNames})`)
// M244 sheet 6: Luminarc's (Storm) four, canon-named (Alex 11-28), art LOCKED-AFK athernyx #021-024: hoverers, same tools off the live Luminarc
const arcNames = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.luminarc![b].toLowerCase())
ok(arcNames.join() === 'luminthar,lumicelle,arcet,lumiceth', `Luminarc's four in branch order (${arcNames})`)
// M244 sheet 7: Luminore's (Earth) four, canon-named (spirits-species.md 'Named, the Luminara line'), art LOCKED athernyx #029-032: the egg's BREAK-OUT
const oreNames = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.luminore![b].toLowerCase())
ok(oreNames.join() === 'orebrak,lumoraya,lumorvex,lumorun', `Luminore's four in branch order (${oreNames})`)
// M244 sheet 9: Luminix's (Water) four, canon-named (spirits-species.md 'Named, the Luminara line'), art LOCKED athernyx #045-048: the egg's BREAK-OUT
const mixNames = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.luminix![b].toLowerCase())
ok(mixNames.join() === 'lumixok,marisse,lumixis,lumixeth', `Luminix's four in branch order (${mixNames})`)
// M244 sheet 8: Mystowl's (Mana) four (art LOCKED-AFK athernyx #053-056)
const mysNames = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.mystowl![b].toLowerCase())
ok(mysNames.join() === 'mystowk,mystowelle,mystowis,mysteth', `Mystowl's four in branch order (${mysNames})`)
ok(Object.keys(AWAKENED_FORMS).sort().join() === [...names, ...stormNames, ...earthNames, ...waterNames, ...lumNames, ...arcNames, ...oreNames, ...mixNames, ...mysNames].sort().join(), 'one look per name, no more')
for (const [el, list] of [['mana', names], ['storm', stormNames], ['earth', earthNames], ['water', waterNames]] as const) for (const n of list) {
  const vulnara = SECOND_FORMS.fox![el]!, parent = el === 'mana' ? 'vulnara' : el === 'storm' ? 'vulnarc' : el === 'earth' ? 'vulnore' : 'vulnix'
  const L = AWAKENED_FORMS[n]
  ok(L.name === n && L.url === `/open/spirits/${n}-rigged.glb` && L.form === el, `${n}: her own glb + a form look (rigLook keeps it)`)
  ok(AWAKEN_GROW[n] > formGrow(parent) && L.h > vulnara.h * 1.15, `${n}: grown past ${parent} (dial ${AWAKEN_GROW[n]} vs ${formGrow(parent)}, h ${L.h.toFixed(3)} vs ${vulnara.h.toFixed(3)})`)
  ok(L.glow?.part === 'aura', `${n}: her aura part drawn as the glow part`)
  const f = `public${L.url}`; ok(existsSync(f), `${f} exists`)
  if (existsSync(f)) {
    const b = readFileSync(f), jl = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + jl).toString('utf8'))
    const nodes = (j.nodes as { name?: string }[]).map(x => x.name), clips = (j.animations as { name: string }[]).map(a => a.name)
    ok(['body', 'eyes', 'aura', 'b_head', 'b_root'].every(x => nodes.includes(x)), `${n}: glb nodes body / eyes / aura / bones`)
    ok(['idle', 'walk', 'run', 'sit', 'lie'].every(c => clips.includes(c)), `${n}: clips ${clips}`)
    ok(f !== `public${vulnara.url}` && readFileSync(f).length !== readFileSync(`public${vulnara.url}`).length, `${n}: not Vulnara's file`)
  }
  ok(!PUBLIC_FORMS.has(n), `${n}: not in PUBLIC_FORMS (owner preview only)`)
}
// M244 s1b: Vulnarok's biped rig (two leg chains, two arms, her echoes on their own bones); Vulnavex's copies move + fade in the run
const glbJson = (n: string) => { const b = readFileSync(`public/open/spirits/${n}-rigged.glb`), jl = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + jl).toString('utf8')) }
const glbBin = (n: string) => { const b = readFileSync(`public/open/spirits/${n}-rigged.glb`), jl = b.readUInt32LE(12); return b.subarray(28 + jl) }   // the BIN chunk's bytes
{
  const j = glbJson('vulnarok'), nodes: string[] = j.nodes.map((x: { name?: string }) => x.name)
  for (const s of ['l', 'r']) ok(['up', 'lo', 'mt', 'paw'].every(b => nodes.includes(`b_leg_${s}_${b}`)) && ['arm_' + s + '_up', 'arm_' + s + '_lo', 'hand_' + s].every(b => nodes.includes('b_' + b)), `vulnarok: ${s} leg chain (hip, knee, hock, paw) + ${s} arm`)
  ok(!nodes.some(x => /^b_(fl|fr|hl|hr)_/.test(x)), 'vulnarok: no quadruped legs left')
  ok([0, 1, 2, 3].every(k => nodes.includes(`b_e${k}_head`)), 'vulnarok: four echoes, each on its own skeleton')
  const walk = j.animations.find((a: { name: string }) => a.name === 'walk'), idx = (n: string) => nodes.indexOf(n)
  ok(walk.channels.some((c: { target: { node: number } }) => c.target.node === idx('b_e0_leg_l_up')), 'vulnarok: an echo walks (its leg bone has a track)')
}
{
  const j = glbJson('vulnavex'), nodes: string[] = j.nodes.map((x: { name?: string }) => x.name), run = j.animations.find((a: { name: string }) => a.name === 'run')
  const sc = run.channels.find((c: { target: { node: number; path: string } }) => c.target.node === nodes.indexOf('b_e0_root') && c.target.path === 'scale')
  ok(!!sc && run.channels.some((c: { target: { node: number; path: string } }) => c.target.node === nodes.indexOf('b_e0_root') && c.target.path === 'translation'), 'vulnavex: copy 0 drifts + fades in the run (translation + scale tracks)')
  ok(run.channels.some((c: { target: { node: number } }) => c.target.node === nodes.indexOf('b_e1_fl_up')), 'vulnavex: copy 1 runs (its foreleg has a track)')
}
// M244 s1c: Vulnamyr's eight tails (each its own chain, each moving), Vulnalys the dire-wolf build (still four-legged, bigger than Vulnara)
const body = (n: string) => {   // the 'body' mesh's rest positions + skin, read off the glb (accessor min/max are not enough: the brush counts)
  const b = readFileSync(`public/open/spirits/${n}-rigged.glb`), jl = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + jl).toString('utf8')), bin = 20 + jl + 8
  const acc = (i: number) => {
    const a = j.accessors[i], v = j.bufferViews[a.bufferView], k = ({ SCALAR: 1, VEC3: 3, VEC4: 4 } as Record<string, number>)[a.type], sz = ({ 5121: 1, 5123: 2, 5126: 4 } as Record<number, number>)[a.componentType]
    const st = v.byteStride ?? k * sz, o = bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0), out: number[][] = []
    for (let e = 0; e < a.count; e++) { const r: number[] = []; for (let c = 0; c < k; c++) { const p = o + e * st + c * sz; r.push(sz === 4 ? b.readFloatLE(p) : sz === 2 ? b.readUInt16LE(p) / (a.normalized ? 65535 : 1) : b.readUInt8(p) / (a.normalized ? 255 : 1)) } out.push(r) }
    return out
  }
  const mesh = j.meshes[j.nodes.find((x: { name?: string; mesh?: number }) => x.name === 'body').mesh].primitives[0].attributes, skin = j.skins[0]
  const bone = (ji: number) => j.nodes[skin.joints[ji]].name as string, P = acc(mesh.POSITION), J = acc(mesh.JOINTS_0), Wt = acc(mesh.WEIGHTS_0)
  const keep = P.filter((_, i) => J[i].reduce((s, ji, c) => s + (bone(ji).startsWith('b_tail') ? Wt[i][c] : 0), 0) < 0.5)   // her body without the tail(s)
  return { len: Math.max(...keep.map(p => p[2])) - Math.min(...keep.map(p => p[2])), tall: Math.max(...keep.map(p => p[1])) }
}
{
  const j = glbJson('vulnamyr'), nodes: string[] = j.nodes.map((x: { name?: string }) => x.name)
  const chains = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(k => [1, 2, 3].every(i => nodes.includes(`b_tail_${k}_${i}`)))
  ok(chains.length === 8, `vulnamyr: EIGHT tail chains of three bones (${chains.length})`)
  for (const c of ['idle', 'walk', 'sit']) {
    const a = j.animations.find((x: { name: string }) => x.name === c)
    ok(chains.every(k => a.channels.some((ch: { target: { node: number } }) => ch.target.node === nodes.indexOf(`b_tail_${k}_3`))), `vulnamyr: every tail moves on its own in ${c} (each tip bone has a track)`)
  }
  const m = JSON.parse(readFileSync('docs/looks/m244-vulnara-2026-11-27/vulnamyr-metrics.json', 'utf8'))
  for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) ok(m[c].lowest_m >= -0.0015, `vulnamyr: ${c} lowest point ${m[c].lowest_m} m (tails clear the ground)`)
}
{
  const j = glbJson('vulnalys'), nodes: string[] = j.nodes.map((x: { name?: string }) => x.name)
  ok(['fl', 'fr', 'hl', 'hr'].every(l => ['up', 'lo', 'paw'].every(b => nodes.includes(`b_${l}_${b}`))) && !nodes.some(x => /^b_leg_/.test(x)), 'vulnalys: four-legged (fox rig, four leg chains)')
  const L = body('vulnalys'), V = body('vulnara'), k = AWAKEN_GROW.vulnalys / formGrow('vulnara')
  ok(L.len * k >= 1.25 * V.len && L.tall * k >= 1.25 * V.tall, `vulnalys: dire-wolf size vs Vulnara as drawn: body length x${(L.len * k / V.len).toFixed(2)}, height x${(L.tall * k / V.tall).toFixed(2)} (>= 1.25)`)
}
// M244 sheet 2: Vulnarkor on the biped rig (no echoes), Arcvex's copies run, Vulnarceth's cloud on its own bone, every clip clear of the ground
{
  const j = glbJson('vulnarkor'), nodes: string[] = j.nodes.map((x: { name?: string }) => x.name)
  for (const s of ['l', 'r']) ok(['up', 'lo', 'mt', 'paw'].every(b => nodes.includes(`b_leg_${s}_${b}`)) && ['arm_' + s + '_up', 'arm_' + s + '_lo', 'hand_' + s].every(b => nodes.includes('b_' + b)), `vulnarkor: ${s} leg chain + ${s} arm (upright, the biped rig)`)
  ok(!nodes.some(x => /^b_(fl|fr|hl|hr)_/.test(x)) && !nodes.some(x => /^b_e\d_/.test(x)), 'vulnarkor: no quadruped legs, no echoes (that is Vulnarok)')
}
{
  const j = glbJson('arcvex'), nodes: string[] = j.nodes.map((x: { name?: string }) => x.name), run = j.animations.find((a: { name: string }) => a.name === 'run')
  ok(run.channels.some((c: { target: { node: number; path: string } }) => c.target.node === nodes.indexOf('b_e0_root') && c.target.path === 'scale') && run.channels.some((c: { target: { node: number } }) => c.target.node === nodes.indexOf('b_e1_fl_up')), 'arcvex: two copies that run, drift + fade (as the pure Ace)')
}
for (const n of ['vulnarcelle', 'vulnarceth', 'arcvex']) {
  const nodes: string[] = glbJson(n).nodes.map((x: { name?: string }) => x.name)
  ok(['fl', 'fr', 'hl', 'hr'].every(l => nodes.includes(`b_${l}_paw`)) && !nodes.some(x => /^b_leg_/.test(x)), `${n}: four-legged (the art is not upright)`)
}
{
  const j = glbJson('vulnarceth'), nodes: string[] = j.nodes.map((x: { name?: string }) => x.name), lie = j.animations.find((a: { name: string }) => a.name === 'lie')
  ok(nodes.includes('b_cloud') && lie.channels.some((c: { target: { node: number; path: string } }) => c.target.node === nodes.indexOf('b_cloud') && c.target.path === 'translation'), 'vulnarceth: her cloud + discs ride their own bone, held on the ground (a track in the lie)')
}
for (const n of stormNames) {
  const m = JSON.parse(readFileSync(`docs/looks/m244-vulnarc-2026-11-27/${n}-metrics.json`, 'utf8'))
  for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) ok(m[c].lowest_m >= -0.0015, `${n}: ${c} lowest point ${m[c].lowest_m} m (clears the ground)`)
  const L = body(n), V = body('vulnarc'), k = AWAKEN_GROW[n] / formGrow('vulnarc')
  ok(L.tall * k >= 1.2 * V.tall, `${n}: bigger than Vulnarc as drawn (height x${(L.tall * k / V.tall).toFixed(2)})`)
}
// M244 sheet 3: Orethar upright on the biped rig (no echoes), Vulnoris's copies run, the three others four-legged; every clip clear;
// the 11-28 quality standard: ears + tail ride baked springs (every clip moves the ear bones), Orethar's chest projected from the art
{
  const j = glbJson('orethar'), nodes: string[] = j.nodes.map((x: { name?: string }) => x.name)
  for (const s of ['l', 'r']) ok(['up', 'lo', 'mt', 'paw'].every(b => nodes.includes(`b_leg_${s}_${b}`)) && ['arm_' + s + '_up', 'arm_' + s + '_lo', 'hand_' + s].every(b => nodes.includes('b_' + b)), `orethar: ${s} leg chain + ${s} arm (upright hulk, the biped rig)`)
  ok(!nodes.some(x => /^b_(fl|fr|hl|hr)_/.test(x)) && !nodes.some(x => /^b_e\d_/.test(x)), 'orethar: no quadruped legs, no echoes')
  const run = glbJson('vulnoris').animations.find((a: { name: string }) => a.name === 'run'), vn: string[] = glbJson('vulnoris').nodes.map((x: { name?: string }) => x.name)
  ok(run.channels.some((c: { target: { node: number; path: string } }) => c.target.node === vn.indexOf('b_e0_root') && c.target.path === 'scale') && run.channels.some((c: { target: { node: number } }) => c.target.node === vn.indexOf('b_e1_fl_up')), 'vulnoris: two whole copies that run, drift + fade (as Vulnavex / Arcvex)')
}
for (const n of ['vulnoraya', 'vulnoris', 'vulnorun']) {
  const nodes: string[] = glbJson(n).nodes.map((x: { name?: string }) => x.name)
  ok(['fl', 'fr', 'hl', 'hr'].every(l => nodes.includes(`b_${l}_paw`)) && !nodes.some(x => /^b_leg_/.test(x)), `${n}: four-legged (the art is not upright)`)
}
for (const n of earthNames) {
  const m = JSON.parse(readFileSync(`docs/looks/m244-vulnore-2026-11-28/${n}-metrics.json`, 'utf8'))
  for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) ok(m[c].lowest_m >= -0.0015, `${n}: ${c} lowest point ${m[c].lowest_m} m (clears the ground)`)
  ok(Object.keys(m.quality?.spring?.peak_rad ?? {}).filter(k => k.startsWith('walk:')).length >= 3, `${n}: built with the spring pass (ears + tail peaks in the walk)`)
  const L = body(n), V = body('vulnore'), k = AWAKEN_GROW[n] / formGrow('vulnore')
  ok(L.tall * k >= 1.2 * V.tall, `${n}: bigger than Vulnore as drawn (height x${(L.tall * k / V.tall).toFixed(2)})`)
  const j = glbJson(n), nodes: string[] = j.nodes.map((x: { name?: string }) => x.name), idle = j.animations.find((a: { name: string }) => a.name === 'walk')
  ok(['b_ear_l', 'b_ear_r', 'b_tail4'].every(b => idle.channels.some((c: { target: { node: number; path: string } }) => c.target.node === nodes.indexOf(b) && c.target.path === 'rotation')), `${n}: ears + tail tip carry rotation tracks in the walk (springs)`)
}
ok(JSON.parse(readFileSync('docs/looks/m244-vulnore-2026-11-28/orethar-metrics.json', 'utf8')).quality?.project?.gold > 20, "orethar: her chest gold projected from the locked art")
// M244 v2 SILHOUETTE (11-28, hub: 'the parent fox with props stuck on'): each built with a per-form PROP + MOTIF spec (sculpt_awaken.py),
// measured off the rest mesh in her file: Orethar a hulk (v1 shoulders 1.95x the eyes' spread), Vulnoris leaner than v1 (1.005)
{
  const sil = (n: string) => JSON.parse(readFileSync(`docs/looks/m244-vulnore-2026-11-28/${n}-metrics.json`, 'utf8')).silhouette
  for (const n of earthNames) ok(!!sil(n) && Object.keys(sil(n).prop).length > 0 && Object.keys(sil(n).motif).length > 0, `${n}: built with a v2 PROP + MOTIF spec`)
  ok(sil('orethar')?.shoulder_over_eyes >= 3 && sil('orethar')?.prop?.head < 1, `orethar: a hulk, shoulders ${sil('orethar')?.shoulder_over_eyes}x the eyes' spread (v1 1.95), a smaller head`)
  ok(sil('vulnoris')?.shoulder_over_eyes < 0.97, `vulnoris: leaner than v1 (shoulders ${sil('vulnoris')?.shoulder_over_eyes}x the eyes, v1 1.005)`)
  ok(sil('vulnoraya')?.motif?.crown >= 2 && sil('vulnorun')?.motif?.tree > 1 && sil('vulnorun')?.motif?.trunk > 1, 'vulnoraya: crown grown; vulnorun: tree taller + trunk thicker')
}
// M244 sheet 4: Vulnix's four, all quadrupeds, built to the 11-28 quality standard, every clip clear of the ground
for (const n of waterNames) {
  const nodes: string[] = glbJson(n).nodes.map((x: { name?: string }) => x.name)
  ok(['fl', 'fr', 'hl', 'hr'].every(l => nodes.includes(`b_${l}_paw`)) && !nodes.some(x => /^b_leg_/.test(x)), `${n}: four-legged (the art is not upright)`)
  const m = JSON.parse(readFileSync(`docs/looks/m244-vulnix-2026-11-28/${n}-metrics.json`, 'utf8'))
  for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) ok(m[c].lowest_m >= -0.0015, `${n}: ${c} lowest point ${m[c].lowest_m} m (clears the ground)`)
  ok(Object.keys(m.quality?.spring?.peak_rad ?? {}).filter(k => k.startsWith('walk:')).length >= 3, `${n}: built with the spring pass (ears + tail peaks in the walk)`)
  const L = body(n), V = body('vulnix'), k = AWAKEN_GROW[n] / formGrow('vulnix')
  ok(L.tall * k >= 1.2 * V.tall, `${n}: bigger than Vulnix as drawn (height x${(L.tall * k / V.tall).toFixed(2)})`)
  const walk = glbJson(n).animations.find((a: { name: string }) => a.name === 'walk')
  ok(['b_ear_l', 'b_ear_r', 'b_tail4'].every(b => walk.channels.some((c: { target: { node: number; path: string } }) => c.target.node === nodes.indexOf(b) && c.target.path === 'rotation')), `${n}: ears + tail tip carry rotation tracks in the walk`)
}
// M244 Vulnix v2 (hub 11-28 on the v1 sheet): each built with a PROP + MOTIF spec, receipts read off her rest mesh (rig_q.py silhouette)
{
  const sil = (n: string) => JSON.parse(readFileSync(`docs/looks/m244-vulnix-2026-11-28/${n}-metrics.json`, 'utf8')).silhouette
  for (const n of waterNames) ok(!!sil(n) && Object.keys(sil(n).prop).length > 0 && Object.keys(sil(n).motif).length > 0, `${n}: built with a v2 PROP + MOTIF spec`)
  ok(sil('vulnitar')?.prop?.chest > 1.15 && sil('vulnitar')?.prop?.fore > 1.2 && sil('vulnitar')?.motif?.splash > 1 && sil('vulnitar')?.aura_r >= 0.7, `vulnitar: heavier build + a splash crown out to ${sil('vulnitar')?.aura_r} glb (v1 ring 0.663)`)
  ok(sil('marelle')?.motif?.ear >= 1.3, `marelle: her jester ears lengthened x${sil('marelle')?.motif?.ear}`)
  ok(sil('vulnisk')?.prop?.lean < 0.9, `vulnisk: the lean wave-rider (trunk x${sil('vulnisk')?.prop?.lean})`)
  ok(sil('vulnixeth')?.prop?.tall > 1.2 && sil('vulnixeth')?.eyes_y >= 0.74 && sil('vulnixeth')?.aura_r >= 1.0, `vulnixeth: taller (eyes at ${sil('vulnixeth')?.eyes_y} glb, v1 0.655) + a wider pool (${sil('vulnixeth')?.aura_r} glb, v1 0.751)`)
}
{ // Marelle's hanging jester ears are the springs' showcase: a bigger swing than the upright-eared forms, and they hang (tip below the root)
  const m = JSON.parse(readFileSync('docs/looks/m244-vulnix-2026-11-28/marelle-metrics.json', 'utf8')), o = JSON.parse(readFileSync('docs/looks/m244-vulnix-2026-11-28/vulnitar-metrics.json', 'utf8'))
  ok(m.quality.spring.peak_rad['walk:ear_l'] >= 1.5 * o.quality.spring.peak_rad['walk:ear_l'], `marelle: her ears swing wider in the walk (${m.quality.spring.peak_rad['walk:ear_l']} vs Vulnitar ${o.quality.spring.peak_rad['walk:ear_l']} rad)`)
  const vul = glbJson('vulnitar'); ok(vul.nodes.some((x: { name?: string }) => x.name === 'b_cloud') && glbJson('vulnixeth').nodes.some((x: { name?: string }) => x.name === 'b_cloud'), 'vulnitar + vulnixeth: ring / pool on their own cloud bone')
  const rv: string[] = glbJson('vulnisk').nodes.map((x: { name?: string }) => x.name); ok([0, 1].every(k => rv.includes(`b_e${k}_head`)), 'vulnisk: two water copies on their own skeletons')
}
// M244 sheet 5: Luminel's four hover like her (the hover rig: b_hover unkeyed, every clip in the air), each her own silhouette + motif on the aura
{
  const parent = SECOND_FORMS.firefly!.mana!, pj = glbJson('luminel'), pb = (pj.nodes as { name?: string }[]).filter(x => x.name?.startsWith('b_')).length
  const lens: number[] = []
  for (const n of lumNames) {
    const L = AWAKENED_FORMS[n], f = `public${L.url}`
    ok(L.name === n && L.form === 'mana' && L.url === `/open/spirits/${n}-rigged.glb` && L.glow?.part === 'aura', `${n}: her own glb, a mana form look, aura = glow part`)
    ok(AWAKEN_GROW[n] > formGrow('luminel') && L.h > parent.h * 1.15, `${n}: grown past Luminel (dial ${AWAKEN_GROW[n]} vs ${formGrow('luminel')})`)
    ok(!!L.rig?.hover && !!L.rig?.cull && L.rig.hover.low > 1 && L.rig.hover.top > L.rig.hover.low, `${n}: hover rig fields (low ${L.rig?.hover?.low}, top ${L.rig?.hover?.top}) + own culling`)
    ok(!PUBLIC_FORMS.has(n), `${n}: owner preview only`)
    if (!existsSync(f)) { ok(false, `${f} exists`); continue }
    const j = glbJson(n), nodes: string[] = j.nodes.map((x: { name?: string }) => x.name), bones = nodes.filter(x => x?.startsWith('b_'))
    ok(['body', 'eyes', 'aura', 'b_hover', 'b_head', 'b_fw_l', 'b_hw_r'].every(x => nodes.includes(x)) && bones.length === pb, `${n}: body / eyes / aura + the hover rig's ${pb} bones (${bones.length})`)
    const hov = nodes.indexOf('b_hover'), keyed = (j.animations as { channels: { target: { node: number } }[] }[]).some(a => a.channels.some(c => c.target.node === hov))
    ok(!keyed && (j.animations as { name: string }[]).map(a => a.name).sort().join() === 'idle,lie,run,sit,walk', `${n}: five clips, b_hover unkeyed`)
    const met = JSON.parse(readFileSync(`docs/looks/m244-luminel-2026-11-28/${n}-metrics.json`, 'utf8'))
    ok(met.all_lowest_with_aura_glb > 1 && Math.abs(met.hover_low - L.rig!.hover!.low) < 1e-3 && Math.abs(met.glb_long - AWAKEN_LEN[n]) < 1e-3, `${n}: wired numbers = her metrics; every clip (aura too) in the air (lowest ${met.all_lowest_with_aura_glb} glb)`)
    ok(Math.abs(met.hover_m * AWAKEN_GROW[n] - 1.35) < 0.01, `${n}: hangs at Luminel's ~1.35 m grown (${met.hover_m} m x ${AWAKEN_GROW[n]})`)
    lens.push(met.glb_long)
  }
  // silhouette, not a reskin: Lumivex the long racer, the others as long as Luminel; Luminok wide (her span), Elhae's roots spread past her wings
  const met = (n: string) => JSON.parse(readFileSync(`docs/looks/m244-luminel-2026-11-28/${n}-metrics.json`, 'utf8'))
  ok(met('lumivex').glb_long > 1.6 * met('lumilys').glb_long, `lumivex: a long low racer (glb_long ${met('lumivex').glb_long} vs lumilys ${met('lumilys').glb_long})`)
  ok(met('lumilys').body_mean_top > met('luminok').body_mean_top && met('lumivex').body_mean_top < 0.75 * met('luminok').body_mean_top, `tall slender Lumilys (${met('lumilys').body_mean_top}) vs low Lumivex (${met('lumivex').body_mean_top})`)
}
// M244 sheet 6: Luminarc's four hover like her (same contract as sheet 5), each her own silhouette + motif
{
  const parent = SECOND_FORMS.firefly!.storm!, pb = (glbJson('luminarc').nodes as { name?: string }[]).filter(x => x.name?.startsWith('b_')).length
  const met = (n: string) => JSON.parse(readFileSync(`docs/looks/m244-luminarc-2026-11-28/${n}-metrics.json`, 'utf8'))
  for (const n of arcNames) {
    const L = AWAKENED_FORMS[n], f = `public${L.url}`
    ok(L.name === n && L.form === 'storm' && L.url === `/open/spirits/${n}-rigged.glb` && L.glow?.part === 'aura' && L.skin?.emissive === parent.skin?.emissive, `${n}: her own glb, a storm form look off Luminarc, aura = glow part`)
    ok(AWAKEN_GROW[n] > formGrow('luminarc') && L.h > parent.h * 1.15, `${n}: grown past Luminarc (dial ${AWAKEN_GROW[n]} vs ${formGrow('luminarc')})`)
    ok(!!L.rig?.hover && !!L.rig?.cull && L.rig.hover.low > 1 && L.rig.hover.top > L.rig.hover.low, `${n}: hover rig fields (low ${L.rig?.hover?.low}, top ${L.rig?.hover?.top}) + own culling`)
    ok(!PUBLIC_FORMS.has(n), `${n}: owner preview only`)
    if (!existsSync(f)) { ok(false, `${f} exists`); continue }
    const j = glbJson(n), nodes: string[] = j.nodes.map((x: { name?: string }) => x.name), bones = nodes.filter(x => x?.startsWith('b_'))
    ok(['body', 'eyes', 'aura', 'b_hover', 'b_head', 'b_fw_l', 'b_hw_r'].every(x => nodes.includes(x)) && bones.length === pb, `${n}: body / eyes / aura + the hover rig's ${pb} bones (${bones.length})`)
    const hov = nodes.indexOf('b_hover'), keyed = (j.animations as { channels: { target: { node: number } }[] }[]).some(a => a.channels.some(c => c.target.node === hov))
    ok(!keyed && (j.animations as { name: string }[]).map(a => a.name).sort().join() === 'idle,lie,run,sit,walk', `${n}: five clips, b_hover unkeyed`)
    const m = met(n)
    ok(m.all_lowest_with_aura_glb > 1 && Math.abs(m.hover_low - L.rig!.hover!.low) < 1e-3 && Math.abs(m.hover_top - L.rig!.hover!.top) < 1e-3 && Math.abs(m.glb_long - AWAKEN_LEN[n]) < 1e-3, `${n}: wired numbers = her metrics; every clip (aura too) in the air (lowest ${m.all_lowest_with_aura_glb} glb)`)
    ok(['min', 'max'].every(k => (m.cull[k] as number[]).every((x, i) => Math.abs(x - (L.rig!.cull as unknown as Record<string, number[]>)[k][i]) < 1e-6)) && Math.abs(m.cull.r - L.rig!.cull!.r) < 1e-6, `${n}: culling = her metrics (r ${m.cull.r})`)
    ok(Math.abs(m.hover_m * AWAKEN_GROW[n] - 1.35) < 0.01, `${n}: hangs at Luminarc's family ~1.35 m grown (${m.hover_m} m x ${AWAKEN_GROW[n]})`)
  }
  // silhouette, not a reskin, read off the files: the rest-pose extents of a mesh (accessor min / max)
  const ext = (n: string, mesh: string) => { const j = glbJson(n), mi = j.nodes.find((x: { name?: string }) => x.name === mesh).mesh, a = j.accessors[j.meshes[mi].primitives[0].attributes.POSITION]; return { min: a.min as number[], max: a.max as number[] } }
  const span = (n: string, mesh: string, k: number) => { const e = ext(n, mesh); return e.max[k] - e.min[k] }
  ok(span('luminthar', 'eyes', 0) > 1.3 * span('luminarc', 'eyes', 0), `luminthar: big wings (eyes-part span ${span('luminthar', 'eyes', 0).toFixed(2)} vs Luminarc ${span('luminarc', 'eyes', 0).toFixed(2)})`)
  ok(span('lumicelle', 'aura', 0) > 1.4 && span('lumicelle', 'aura', 1) > 1.4, `lumicelle: her ring of orbs round her (aura ${span('lumicelle', 'aura', 0).toFixed(2)} x ${span('lumicelle', 'aura', 1).toFixed(2)} glb)`)
  ok(ext('arcet', 'aura').min[2] < -2.0 && span('arcet', 'aura', 2) > 2.4 * span('arcet', 'body', 2), `arcet: two copies streaming behind (aura from z ${ext('arcet', 'aura').min[2].toFixed(2)}, ${(span('arcet', 'aura', 2) / span('arcet', 'body', 2)).toFixed(1)}x her length)`)
  ok(span('lumiceth', 'body', 1) > 1.1 * span('luminarc', 'body', 1) && ext('lumiceth', 'body').min[1] < ext('luminarc', 'body').min[1] - 0.15, `lumiceth: a cloak past her feet (body ${span('lumiceth', 'body', 1).toFixed(2)} tall vs Luminarc ${span('luminarc', 'body', 1).toFixed(2)})`)
  ok(met('arcet').cull.min[2] < -2 && met('luminthar').cull.max[0] > 1 && met('lumiceth').body_mean_top > met('luminthar').body_mean_top, 'culling holds the motifs (Arcet copies, Luminthar span); Lumiceth stands tallest in her cloak')
}
// M244 sheet 7: Luminore's four BROKE OUT of the egg: grounded like her (no hover), but up on legs with arms, taller, the shell at her feet
{
  const parent = SECOND_FORMS.firefly!.earth!, met = (n: string) => JSON.parse(readFileSync(`docs/looks/m244-luminore-2026-11-28/${n}-metrics.json`, 'utf8'))
  const egg = JSON.parse(readFileSync('docs/looks/m202-luminara-line-2026-11-27/luminore-metrics.json', 'utf8'))
  for (const n of oreNames) {
    const L = AWAKENED_FORMS[n], f = `public${L.url}`, m = met(n)
    ok(L.name === n && L.form === 'earth' && L.url === `/open/spirits/${n}-rigged.glb` && L.glow?.part === 'aura' && L.skin?.emissive === parent.skin?.emissive, `${n}: her own glb, an earth form look off Luminore, aura = glow part`)
    ok(AWAKEN_GROW[n] > formGrow('luminore') && L.h > parent.h * 1.15 && m.dial === AWAKEN_GROW[n], `${n}: grown past Luminore (dial ${AWAKEN_GROW[n]} vs ${formGrow('luminore')}; rig dial ${m.dial})`)
    ok(!L.rig?.hover && !L.rig?.cull && !PUBLIC_FORMS.has(n), `${n}: grounded (no hover, no own culling), owner preview only`)
    ok(Math.abs(m.glb_long - AWAKEN_LEN[n]) < 1e-3 && Math.abs(L.rig!.clipV!.walk / L.rig!.clipV!.run - m.walk.plays_1to1_at_mps / m.run.plays_1to1_at_mps) < 1e-3, `${n}: wired numbers = her metrics (glbLen ${m.glb_long}, walk / run ${m.walk.plays_1to1_at_mps} / ${m.run.plays_1to1_at_mps} m/s)`)
    for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) ok(m[c].lowest_glb > -0.0015 && m[c].body_lowest_glb < 0.002, `${n} ${c}: on the ground, nothing under it (lowest ${m[c].lowest_glb}, body ${m[c].body_lowest_glb} glb)`)
    ok(m.body_mean_top > 1.2 * egg.body_mean_top, `${n}: taller than the egg (${m.body_mean_top} vs ${egg.body_mean_top} glb)`)
    if (!existsSync(f)) { ok(false, `${f} exists`); continue }
    const j = glbJson(n), nodes: string[] = j.nodes.map((x: { name?: string }) => x.name)
    const am = j.nodes.find((x: { name?: string }) => x.name === 'aura').mesh, amin = j.accessors[j.meshes[am].primitives[0].attributes.POSITION].min[1]
    if (n !== 'lumorvex') ok(amin > 0 && amin < 0.01, `${n}: the broken shell rests ON the ground in the bind pose (aura lowest ${amin.toFixed(4)} glb)`)   // Lumorvex's shards fly
    ok(['body', 'eyes', 'lamp', 'aura', 'b_root', 'b_hips', 'b_head', 'b_leg_l', 'b_shin_r', 'b_arm_l', 'b_farm_r'].every(x => nodes.includes(x)) && !nodes.includes('b_hover') && !nodes.some(x => /^b_(fw|hw)_/.test(x ?? '')), `${n}: the ground biped (legs + arms, no hover, no wings)`)
    const root = nodes.indexOf('b_root'), anims = j.animations as { name: string; channels: { target: { node: number; path: string } }[] }[]
    ok(anims.map(a => a.name).sort().join() === 'idle,lie,run,sit,walk' && !anims.some(a => a.channels.some(c => c.target.node === root && c.target.path === 'translation')), `${n}: five clips; the root never moves (her shell stays on the ground)`)
  }
  // a new silhouette vs the egg, read off the files: arms out past her body, legs under it
  const ext = (n: string, mesh: string, _d: 'luminore' | 'mine') => { const j = glbJson(n), mi = j.nodes.find((x: { name?: string }) => x.name === mesh).mesh, a = j.accessors[j.meshes[mi].primitives[0].attributes.POSITION]; return { min: a.min as number[], max: a.max as number[] } }
  const eggB = ext('luminore', 'body', 'luminore'), eggW = eggB.max[0] - eggB.min[0], eggH = eggB.max[1] - eggB.min[1]
  for (const n of oreNames) { const b = ext(n, 'body', 'mine'); ok(b.max[0] - b.min[0] > 1.15 * eggW && b.max[1] - b.min[1] > 1.2 * eggH, `${n}: arms + legs (body ${(b.max[0] - b.min[0]).toFixed(2)} wide x ${(b.max[1] - b.min[1]).toFixed(2)} tall vs the egg ${eggW.toFixed(2)} x ${eggH.toFixed(2)})`) }
  ok(ext('lumoraya', 'body', 'mine').max[0] > ext('lumorun', 'body', 'mine').max[0] + .15 && ext('orebrak', 'body', 'mine').max[0] > ext('lumorun', 'body', 'mine').max[0] + .08, 'lumoraya: her arms flung out; orebrak: the broad brute (both wider than hushed Lumorun, arms at her sides)')
  ok(ext('lumoraya', 'aura', 'mine').max[1] - ext('lumoraya', 'aura', 'mine').min[1] > 1.4 && ext('lumorvex', 'aura', 'mine').max[2] > 1.0 && ext('orebrak', 'aura', 'mine').max[0] > 0.7, 'motifs: Lumoraya\'s rays tower behind her, Lumorvex\'s beam reaches ahead, Orebrak\'s prism fans out to her side')
}
// M244 sheet 9: Luminix's four BROKE OUT of the water egg: grounded (no hover), legs + arms, taller than Luminore's four, the shell / wave on
// a GROUND bone that folds away while she walks / runs (it stays where she hatched), each a new silhouette (Lumixis lean, not an egg)
{
  const parent = SECOND_FORMS.firefly!.water!, met = (n: string) => JSON.parse(readFileSync(`docs/looks/m244-luminix-2026-11-28/${n}-metrics.json`, 'utf8'))
  const egg = JSON.parse(readFileSync('docs/looks/m202-luminara-line-2026-11-27/luminix-metrics.json', 'utf8'))
  for (const n of mixNames) {
    const L = AWAKENED_FORMS[n], f = `public${L.url}`, m = met(n)
    ok(L.name === n && L.form === 'water' && L.url === `/open/spirits/${n}-rigged.glb` && L.glow?.part === 'aura' && L.skin?.emissive === parent.skin?.emissive, `${n}: her own glb, a water form look off Luminix, aura = glow part`)
    ok(AWAKEN_GROW[n] > formGrow('luminix') && AWAKEN_GROW[n] > AWAKEN_GROW.orebrak && m.dial === AWAKEN_GROW[n], `${n}: grown past Luminix and past Luminore's four (dial ${AWAKEN_GROW[n]}; rig dial ${m.dial})`)
    ok(!L.rig?.hover && !L.rig?.cull && !PUBLIC_FORMS.has(n), `${n}: grounded (no hover, no own culling), owner preview only`)
    ok(Math.abs(m.glb_long - AWAKEN_LEN[n]) < 1e-3 && Math.abs(L.rig!.clipV!.walk / L.rig!.clipV!.run - m.walk.plays_1to1_at_mps / m.run.plays_1to1_at_mps) < 1e-3, `${n}: wired numbers = her metrics (glbLen ${m.glb_long}, walk / run ${m.walk.plays_1to1_at_mps} / ${m.run.plays_1to1_at_mps} m/s)`)
    for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) ok(m[c].lowest_glb > -0.0015 && m[c].body_lowest_glb < 0.005, `${n} ${c}: on the ground, nothing under it (lowest ${m[c].lowest_glb}, body ${m[c].body_lowest_glb} glb)`)
    ok(m.body_mean_top > 1.2 * egg.body_mean_top, `${n}: taller than the egg (${m.body_mean_top} vs ${egg.body_mean_top} glb)`)
    if (!existsSync(f)) { ok(false, `${f} exists`); continue }
    const j = glbJson(n), nodes: string[] = j.nodes.map((x: { name?: string }) => x.name)
    const am = j.nodes.find((x: { name?: string }) => x.name === 'aura').mesh, amin = j.accessors[j.meshes[am].primitives[0].attributes.POSITION].min[1]
    if (n !== 'lumixeth') ok(amin > 0 && amin < 0.01, `${n}: what lies at her feet rests ON the ground in the bind pose (aura lowest ${amin.toFixed(4)} glb)`)
    ok(['body', 'eyes', 'lamp', 'aura', 'b_root', 'b_ground', 'b_hips', 'b_head', 'b_leg_l', 'b_shin_r', 'b_arm_l', 'b_farm_r'].every(x => nodes.includes(x)) && !nodes.includes('b_hover') && !nodes.some(x => /^b_(fw|hw)_/.test(x ?? '')), `${n}: the ground biped (legs + arms + a ground bone, no hover, no wings)`)
    const root = nodes.indexOf('b_root'), gr = nodes.indexOf('b_ground'), anims = j.animations as { name: string; channels: { target: { node: number; path: string }; sampler: number }[]; samplers: { output: number }[] }[]
    ok(anims.map(a => a.name).sort().join() === 'idle,lie,run,sit,walk' && !anims.some(a => a.channels.some(c => c.target.node === root && c.target.path === 'translation')), `${n}: five clips; the root never moves`)
    // the ground bone folds in walk + run only: read its scale track's first key out of the glb binary
    const sc = (clip: string) => { const a = anims.find(x => x.name === clip)!, ch = a.channels.find(c => c.target.node === gr && c.target.path === 'scale'); if (!ch) return 1; const acc = j.accessors[a.samplers[ch.sampler].output], bv = j.bufferViews[acc.bufferView]; return glbBin(n).readFloatLE((bv.byteOffset ?? 0) + (acc.byteOffset ?? 0)) }
    ok(sc('walk') < 0.05 && sc('run') < 0.05 && sc('idle') > 0.99 && sc('sit') > 0.99 && sc('lie') > 0.99, `${n}: the shell / wave stays where she hatched (ground bone scale walk ${sc('walk').toFixed(2)} run ${sc('run').toFixed(2)}, idle ${sc('idle').toFixed(2)} sit ${sc('sit').toFixed(2)} lie ${sc('lie').toFixed(2)})`)
  }
  const ext = (n: string, mesh: string) => { const j = glbJson(n), mi = j.nodes.find((x: { name?: string }) => x.name === mesh).mesh, a = j.accessors[j.meshes[mi].primitives[0].attributes.POSITION]; return { min: a.min as number[], max: a.max as number[] } }
  const eggB = ext('luminix', 'body'), eggH = eggB.max[1] - eggB.min[1], wd = (n: string) => ext(n, 'body').max[0] - ext(n, 'body').min[0], dp = (n: string) => ext(n, 'body').max[2] - ext(n, 'body').min[2]
  for (const n of mixNames) { const b = ext(n, 'body'); ok(b.max[1] - b.min[1] > 1.2 * eggH, `${n}: up on legs (body ${(b.max[1] - b.min[1]).toFixed(2)} tall vs the egg ${eggH.toFixed(2)})`) }
  ok(wd('lumixis') < 0.85 * wd('lumixok') && dp('lumixis') > dp('marisse') + 0.25, `lumixis: lean (body ${wd('lumixis').toFixed(2)} wide vs Lumixok ${wd('lumixok').toFixed(2)}) with a tail (${dp('lumixis').toFixed(2)} deep vs Marisse ${dp('marisse').toFixed(2)})`)
  ok(wd('lumixok') > wd('lumixeth') + 0.15 && wd('marisse') > wd('lumixeth') + 0.08, 'lumixok: the broad brute; marisse: a flipper flung out (both wider than Lumixeth, flippers at her sides)')
  ok(ext('lumixok', 'aura').max[1] - ext('lumixok', 'aura').min[1] > 0.9 && ext('lumixeth', 'aura').max[1] - ext('lumixeth', 'aura').min[1] > 0.9, 'motifs: Lumixok\'s wave + spray rise round her, Lumixeth\'s tendrils fall from her crown to the ground')
}
// M244 sheet 8: Mystowl's (Mana) four, canon-named (spirits-species.md 'Named, the Athowl line'), art LOCKED-AFK athernyx #053-056: owls on the
// live owl rig (rig_owl.py: 25 bones, six clips, run = flight), each the live Mystowl's sculpt re-shaped by name + her motif on an aura part
{
  const parent = SECOND_FORMS.owl!.mana!, met = (n: string) => JSON.parse(readFileSync(`docs/looks/m244-mystowl-2026-11-28/${n}-metrics.json`, 'utf8'))
  const pbones = (glbJson('mystowl').nodes as { name?: string }[]).filter(x => x.name?.startsWith('b_')).map(x => x.name).sort().join()
  for (const n of mysNames) {
    const L = AWAKENED_FORMS[n], f = `public${L?.url}`, m = met(n)
    if (!L) { ok(false, `${n}: a look in AWAKENED_FORMS`); continue }
    ok(L.name === n && L.form === 'mana' && L.url === `/open/spirits/${n}-rigged.glb` && L.glow?.part === 'aura' && L.skin?.emissive === parent.skin?.emissive, `${n}: her own glb, a mana form look off Mystowl, aura = glow part`)
    ok(AWAKEN_GROW[n] > formGrow('mystowl') && L.h > parent.h * 1.2 && m.dial === AWAKEN_GROW[n], `${n}: grown past Mystowl (dial ${AWAKEN_GROW[n]} vs ${formGrow('mystowl')}; rig dial ${m.dial})`)
    ok(!L.rig?.hover && !!L.rig?.fly && !PUBLIC_FORMS.has(n) && Math.abs(m.glb_long - AWAKEN_LEN[n]) < 1e-3, `${n}: an owl on the ground that flies (no hover, the owl's fly numbers), owner preview only, glbLen = her metrics (${m.glb_long})`)
    for (const c of ['idle', 'walk', 'sit', 'lie']) ok(m[c].lowest_m > -0.0005 && m[c].lowest_m < 0.01, `${n} ${c}: on the ground, nothing under it (lowest ${m[c].lowest_m} m)`)
    ok(m.run.lowest_m > 0.05 && m.all_lowest_with_aura_glb > -0.0015, `${n}: the run is FLIGHT (lowest ${m.run.lowest_m} m); her aura never under the ground (${m.all_lowest_with_aura_glb} glb)`)
    ok(m.quality.springs.peak['walk:earl'] > 0.05 && m.quality.springs.peak['run:wingl'] > 0.05, `${n}: baked springs on the tufts + wing tips (walk ear ${m.quality.springs.peak['walk:earl']}, run wing ${m.quality.springs.peak['run:wingl']} rad)`)
    if (!existsSync(f)) { ok(false, `${f} exists`); continue }
    const j = glbJson(n), nodes: string[] = j.nodes.map((x: { name?: string }) => x.name)
    ok(['body', 'eyes', 'aura'].every(x => nodes.includes(x)) && nodes.filter(x => x?.startsWith('b_')).sort().join() === pbones, `${n}: body / eyes / aura on Mystowl's own ${pbones.split(',').length} bones`)
    ok((j.animations as { name: string }[]).map(a => a.name).sort().join() === 'glide,idle,lie,run,sit,walk', `${n}: the owl's six clips`)
  }
  // silhouette, not a reskin, read off the files: rest-pose extents (accessor min / max)
  const ext = (n: string, mesh: string) => { const j = glbJson(n), mi = j.nodes.find((x: { name?: string }) => x.name === mesh).mesh, a = j.accessors[j.meshes[mi].primitives[0].attributes.POSITION]; return { min: a.min as number[], max: a.max as number[] } }
  const span = (n: string, mesh: string, k: number) => { const e = ext(n, mesh); return e.max[k] - e.min[k] }, base = span('mystowl', 'body', 0)
  ok(span('mystowk', 'body', 0) > 1.8 * base && span('mysteth', 'body', 0) > 1.8 * base && span('mystowis', 'body', 0) > 1.4 * base, `spread wings: Mystowk ${span('mystowk', 'body', 0).toFixed(2)}, Mysteth ${span('mysteth', 'body', 0).toFixed(2)}, Mystowis ${span('mystowis', 'body', 0).toFixed(2)} wide vs Mystowl ${base.toFixed(2)}`)
  ok(ext('mystowelle', 'body').max[1] > 1.1 * ext('mystowl', 'body').max[1] && span('mystowelle', 'body', 0) < 1.1 * base, `mystowelle: tall + slim, long tufts (top ${ext('mystowelle', 'body').max[1].toFixed(2)} vs ${ext('mystowl', 'body').max[1].toFixed(2)})`)
  ok(span('mystowk', 'aura', 0) > 1.3 && ext('mystowk', 'aura').max[2] < -0.2, `mystowk: a halo of rings BEHIND her (${span('mystowk', 'aura', 0).toFixed(2)} wide, front z ${ext('mystowk', 'aura').max[2].toFixed(2)})`)
  ok(span('mystowelle', 'aura', 0) > 1.5 && span('mystowelle', 'aura', 2) > 1.1, `mystowelle: a ring of floating scrolls round her (${span('mystowelle', 'aura', 0).toFixed(2)} x ${span('mystowelle', 'aura', 2).toFixed(2)})`)
  ok(ext('mystowis', 'aura').min[2] > -0.03 && ext('mystowis', 'aura').min[1] > 0.45 && ext('mystowis', 'aura').max[1] < 0.95, `mystowis: the gold mask on her face (aura y ${ext('mystowis', 'aura').min[1].toFixed(2)}-${ext('mystowis', 'aura').max[1].toFixed(2)}, z from ${ext('mystowis', 'aura').min[2].toFixed(2)})`)
  ok(span('mysteth', 'aura', 0) > 1.4 && ext('mysteth', 'aura').max[1] > 1.35, `mysteth: eyes down both wings (${span('mysteth', 'aura', 0).toFixed(2)} wide) + rays over her head (top ${ext('mysteth', 'aura').max[1].toFixed(2)})`)
}
console.log(`spirit-awakened: ${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL', f); process.exit(1) }
