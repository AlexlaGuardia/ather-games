// BETA M244 sheet 10: Voltowl's four AWAKENED forms (owner preview). Run: npx tsx src/app/shimmer/open/ather/spirit-voltowaw.test.ts
import { existsSync, readFileSync, statSync } from 'node:fs'
import { AWAKENED_FORMS, VOLTOWL_AWAKENED, VOLTOWL_AW_DIAL, VOLTOWL_AW_LEN, SECOND_FORMS, formGrow } from './spirit-models'
import { AWAKENED_BRANCHES, AWAKENED_NAMES } from '../../spirits/spirit'
import { PUBLIC_FORMS } from './spirit-public'
import { GALLERY } from '../../dev/editors/spirit-gallery'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const CANON = '/root/athernyx/CANON/world/spirits-species.md', DIR = 'docs/looks/m244-voltowl-2026-11-28'
// names: word for word off the canon line 'Voltowl (Storm): Voltowrak . Voltowaya . **Voltwis** (Ace, pure) . Voltoweth'
const line = existsSync(CANON) ? readFileSync(CANON, 'utf8').split('\n').find(x => x.includes('**Voltowl (Storm):**')) ?? '' : ''
const canon = line.replace(/.*\*\*Voltowl \(Storm\):\*\*/, '').replace(/\*|\([^)]*\)/g, '').split('·').map(x => x.trim())
const named = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.voltowl?.[b] ?? '')
ok(canon.length === 4 && named.join() === canon.join(), `AWAKENED_NAMES.voltowl = the canon line in branch order (${named} vs ${canon})`)
const looks = named.map(n => n.toLowerCase())
ok(looks.every(n => AWAKENED_FORMS[n] === VOLTOWL_AWAKENED[n]) && Object.keys(VOLTOWL_AWAKENED).sort().join() === [...looks].sort().join(), `each wired once into AWAKENED_FORMS (${Object.keys(VOLTOWL_AWAKENED)})`)
// gallery: four rows, consecutive, owl + storm, right after Voltmere's (#123-#126)
const rows = GALLERY.filter(r => r.aw && r.sp === 'owl' && r.el === 'storm'), prevLast = Math.max(...GALLERY.filter(r => r.aw && r.sp === 'turtle' && r.el === 'storm').map(r => r.num))
ok(rows.length === 4 && rows.every((r, i) => r.num === prevLast + 1 + i && r.num === 127 + i && r.name === named[i] && r.aw!.look === looks[i]), `Voltowl's rows consecutive from #127, after Voltmere's (#${rows.map(r => r.num)}: ${rows.map(r => r.name)})`)
const L3 = '/root/athernyx/assets/stage3/grimoire-ledger-stage3.json'
if (existsSync(L3)) { const locks = JSON.parse(readFileSync(L3, 'utf8')).locks as { name: string; branch_name: string; second_form: string }[]
  for (const r of rows) ok(locks.some(l => l.name === r.name && l.second_form === 'Voltowl' && l.branch_name.toLowerCase() === r.aw!.branch), `${r.name}: a stage-3 lock off Voltowl, ${r.aw!.branch}`) }
const parent = SECOND_FORMS.owl!.storm!
const glbJson = (n: string) => { const b = readFileSync(`public/open/spirits/${n}-rigged.glb`), jl = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + jl).toString('utf8')) }
const pbones = (glbJson('voltowl').nodes as { name?: string }[]).filter(x => x.name?.startsWith('b_')).map(x => x.name).sort().join()
const M: Record<string, any> = {}   // eslint-disable-line @typescript-eslint/no-explicit-any
for (const n of looks) {
  const L = VOLTOWL_AWAKENED[n], m = M[n] = JSON.parse(readFileSync(`${DIR}/${n}-metrics.json`, 'utf8'))
  ok(L.url === `/open/spirits/${n}-rigged.glb` && existsSync(`public${L.url}`) && statSync(`public${L.url}`).size === m.glb_bytes, `${n}: her glb is in public/ and is the one the metrics measured (${m.glb_bytes} B)`)
  ok(existsSync(`public/open/spirits/${n}-icon.png`), `${n}: her gallery icon (our render)`)
  ok(!PUBLIC_FORMS.has(n), `${n}: not in PUBLIC_FORMS (owner preview only)`)
  ok(L.name === n && L.form === 'storm' && L.glow?.part === 'aura' && L.skin?.emissive === parent.skin?.emissive, `${n}: a storm form look off Voltowl, aura = glow part`)
  ok(VOLTOWL_AW_DIAL[n] > formGrow('voltowl') && L.h > parent.h * 1.2 && Math.abs(m.dial * 1.88 / 1.4 - VOLTOWL_AW_DIAL[n]) < 0.006, `${n}: grown past Voltowl (dial ${VOLTOWL_AW_DIAL[n]} vs ${formGrow('voltowl')}; = rig dial ${m.dial} x 1.88 / 1.4, M249 grew Voltowl)`)
  ok(!L.rig?.hover && !!L.rig?.fly && Math.abs(m.glb_long - VOLTOWL_AW_LEN[n]) < 1e-3 && L.rig!.glbLen === VOLTOWL_AW_LEN[n], `${n}: an owl on the ground that flies, glbLen = her metrics (${m.glb_long})`)
  for (const c of ['idle', 'walk', 'sit', 'lie']) ok(m[c].lowest_m > -0.0005 && m[c].lowest_m < 0.01, `${n} ${c}: on the ground, nothing under it (lowest ${m[c].lowest_m} m)`)
  ok(m.run.lowest_m > 0.05 && m.all_lowest_with_aura_glb > -0.0015, `${n}: the run is FLIGHT (lowest ${m.run.lowest_m} m); her aura never under the ground (${m.all_lowest_with_aura_glb} glb)`)
  ok(m.quality.springs.peak['walk:earl'] > 0.05 && m.quality.springs.peak['run:wingl'] > 0.05, `${n}: baked springs on the tufts + wing tips`)
  if (!existsSync(`public${L.url}`)) continue
  const j = glbJson(n), nodes: string[] = j.nodes.map((x: { name?: string }) => x.name)
  ok(['body', 'eyes', 'aura'].every(x => nodes.includes(x)) && nodes.filter(x => x?.startsWith('b_')).sort().join() === pbones, `${n}: body / eyes / aura on Voltowl's own ${pbones.split(',').length} bones`)
  ok((j.animations as { name: string }[]).map(a => a.name).sort().join() === 'glide,idle,lie,run,sit,walk', `${n}: the owl's six clips`)
  const bodyVerts = j.accessors[j.meshes[j.nodes.find((x: { name?: string }) => x.name === 'body').mesh].primitives[0].attributes.POSITION].count
  ok(bodyVerts < 9000, `${n}: body under 9k verts (${bodyVerts})`)
}
// what makes each HER, read off the files (rest-pose accessor extents)
const ext = (n: string, mesh: string) => { const j = glbJson(n), mi = j.nodes.find((x: { name?: string }) => x.name === mesh).mesh, a = j.accessors[j.meshes[mi].primitives[0].attributes.POSITION]; return { min: a.min as number[], max: a.max as number[] } }
const span = (n: string, mesh: string, k: number) => { const e = ext(n, mesh); return e.max[k] - e.min[k] }, base = span('voltowl', 'body', 0)
if (looks.every(n => existsSync(`public/open/spirits/${n}-rigged.glb`))) {
  ok(span('voltowrak', 'body', 0) > 1.3 * base && span('voltoweth', 'body', 0) > 1.3 * base, `spread wings: Voltowrak ${span('voltowrak', 'body', 0).toFixed(2)}, Voltoweth ${span('voltoweth', 'body', 0).toFixed(2)} wide vs Voltowl ${base.toFixed(2)}`)
  ok(ext('voltowaya', 'body').max[1] > 1.15 * ext('voltowl', 'body').max[1], `voltowaya: wings raised high, the conductor (top ${ext('voltowaya', 'body').max[1].toFixed(2)} vs ${ext('voltowl', 'body').max[1].toFixed(2)})`)
  ok(ext('voltwis', 'body').min[2] < ext('voltowl', 'body').min[2] - 0.2, `voltwis: wings swept back, the dive (back z ${ext('voltwis', 'body').min[2].toFixed(2)} vs ${ext('voltowl', 'body').min[2].toFixed(2)})`)
  ok(span('voltowrak', 'aura', 0) > 0.8 && ext('voltowrak', 'aura').max[1] > 1.0, `voltowrak: lightning under her + a crest over her (${span('voltowrak', 'aura', 0).toFixed(2)} wide, top ${ext('voltowrak', 'aura').max[1].toFixed(2)})`)
  ok(span('voltowaya', 'aura', 0) > 1.4, `voltowaya: the figure-eight round her (${span('voltowaya', 'aura', 0).toFixed(2)} wide)`)
  ok(span('voltwis', 'aura', 1) > 1.2 && ext('voltwis', 'aura').min[2] < -0.3, `voltwis: the spear slants up behind her (${span('voltwis', 'aura', 1).toFixed(2)} tall)`)
  ok(span('voltoweth', 'aura', 0) > 2.0 && span('voltoweth', 'aura', 1) > 0.9 && ext('voltoweth', 'aura').max[2] < -0.15, `voltoweth: the cyclone eye behind her (${span('voltoweth', 'aura', 0).toFixed(2)} x ${span('voltoweth', 'aura', 1).toFixed(2)}, front z ${ext('voltoweth', 'aura').max[2].toFixed(2)})`)
}
console.log(`spirit-voltowaw: ${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL', f); process.exit(1) }
