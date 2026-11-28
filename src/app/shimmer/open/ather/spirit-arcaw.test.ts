// BETA M244 sheet 15: Arclotl's four AWAKENED forms (owner preview). Run: npx tsx src/app/shimmer/open/ather/spirit-arcaw.test.ts
import { existsSync, readFileSync, statSync } from 'node:fs'
import { AWAKENED_FORMS, ARCLOTL_AWAKENED, ARCLOTL_AW_DIAL, SECOND_FORMS, formGrow } from './spirit-models'
import { AWAKENED_BRANCHES, AWAKENED_NAMES } from '../../spirits/spirit'
import { PUBLIC_FORMS } from './spirit-public'
import { GALLERY } from '../../dev/editors/spirit-gallery'
import { alexSized } from '../../dev/editors/m249-sized'  // M249 s2: sizes Alex set in the gallery pass (pinned exactly by gallery-size-m249.test.ts)
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const CANON = '/root/athernyx/CANON/world/spirits-species.md', DIR = 'docs/looks/m244-arclotl-2026-11-28'
// names: word for word off the canon line 'Arclotl (Storm): Arclotar . Arclelle . **Arcis** (Ace, pure) . Arclun'
const line = existsSync(CANON) ? readFileSync(CANON, 'utf8').split('\n').find(x => x.includes('**Arclotl (Storm):**')) ?? '' : ''
const canon = line.replace(/.*\*\*Arclotl \(Storm\):\*\*/, '').replace(/\*|\([^)]*\)/g, '').split('·').map(x => x.trim())
const named = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.arclotl?.[b] ?? '')
ok(canon.length === 4 && named.join() === canon.join(), `AWAKENED_NAMES.arclotl = the canon line in branch order (${named} vs ${canon})`)
const looks = named.map(n => n.toLowerCase())
ok(looks.every(n => AWAKENED_FORMS[n] === ARCLOTL_AWAKENED[n]) && Object.keys(ARCLOTL_AWAKENED).sort().join() === [...looks].sort().join(), `each wired once into AWAKENED_FORMS (${Object.keys(ARCLOTL_AWAKENED)})`)
// gallery: four rows, consecutive, axolotl + storm, the last four rows
const rows = GALLERY.filter(r => r.aw && r.sp === 'axolotl' && r.el === 'storm')
ok(rows.length === 4 && rows.every((r, i) => r.num === rows[0].num + i && r.name === named[i] && r.aw!.look === looks[i]) && rows[0].num === 111, `Arclotl's four rows, consecutive from #111 (sheet 15b's Aurmere rows follow) (#${rows.map(r => r.num)}: ${rows.map(r => r.name)})`)
const L3 = '/root/athernyx/assets/stage3/grimoire-ledger-stage3.json'
if (existsSync(L3)) { const locks = JSON.parse(readFileSync(L3, 'utf8')).locks as { name: string; branch_name: string; second_form: string }[]
  for (const r of rows) ok(locks.some(l => l.name === r.name && l.second_form === 'Arclotl' && l.branch_name.toLowerCase() === r.aw!.branch), `${r.name}: a stage-3 lock off Arclotl, ${r.aw!.branch}`) }
const parent = SECOND_FORMS.axolotl!.storm!
const glbJson = (n: string) => { const b = readFileSync(`public/open/spirits/${n}-rigged.glb`), jl = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + jl).toString('utf8')) }
const ext = (n: string, mesh: string) => { const j = glbJson(n), mi = j.nodes.find((x: { name?: string }) => x.name === mesh).mesh, a = j.accessors[j.meshes[mi].primitives[0].attributes.POSITION]; return { min: a.min as number[], max: a.max as number[], count: a.count as number } }
const BIPED = ['arclotar', 'arclelle', 'arcis']
for (const n of looks) {
  const L = ARCLOTL_AWAKENED[n], m = JSON.parse(readFileSync(`${DIR}/${n}-metrics.json`, 'utf8')), up = BIPED.includes(n)
  ok(L.url === `/open/spirits/${n}-rigged.glb` && existsSync(`public${L.url}`) && statSync(`public${L.url}`).size === m.glb_bytes, `${n}: her glb is in public/ and is the one the metrics measured (${m.glb_bytes} B)`)
  ok(existsSync(`public/open/spirits/${n}-icon.png`), `${n}: her gallery icon (our render)`)
  ok(!PUBLIC_FORMS.has(n), `${n}: not in PUBLIC_FORMS (owner preview only)`)
  ok(L.name === n && L.form === 'storm' && L.glow?.part === 'aura' && L.skin?.emissive === parent.skin?.emissive, `${n}: a storm form look off Arclotl, aura = glow part`)
  ok(alexSized('form:arclotl') || (ARCLOTL_AW_DIAL[n] > formGrow('arclotl') && Math.abs(L.h / parent.h - ARCLOTL_AW_DIAL[n] / formGrow('arclotl')) < 1e-9), `${n}: grown past Arclotl in the same number space (dial ${ARCLOTL_AW_DIAL[n]} vs ${formGrow('arclotl')})`)
  if (!existsSync(`public${L.url}`)) continue
  const j = glbJson(n), nodes: string[] = j.nodes.map((x: { name?: string }) => x.name), bones = nodes.filter(x => x?.startsWith('b_')), body = ext(n, 'body')
  ok(['body', 'eyes', 'aura'].every(x => nodes.includes(x)), `${n}: body / eyes / aura parts`)
  ok((j.animations as { name: string }[]).map(a => a.name).sort().join() === 'idle,lie,run,sit,walk', `${n}: five clips`)
  ok(body.count < 9000, `${n}: body under 9k verts (${body.count})`)
  ok(Math.abs(L.rig!.glbLen - (body.max[2] - body.min[2])) < 2e-3, `${n}: glbLen = her rest nose-to-tail (${L.rig!.glbLen} vs ${(body.max[2] - body.min[2]).toFixed(3)})`)
  if (up) {   // the ground biped: legs + arms + a four-bone tail; every clip on the ground, nothing under it; clipV = the metrics' v_glb
    ok(['b_leg_l', 'b_shin_r', 'b_arm_l', 'b_farm_r', 'b_tail4'].every(x => bones.includes(x)) && !bones.some(x => /^b_(fl|hl)_/.test(x)), `${n}: stands on the ground biped (${bones.length} bones)`)
    for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) ok(m[c].lowest_glb > -0.0015 && m[c].body_max_lowest_glb < (c === 'lie' ? 0.10 : 0.04), `${n} ${c}: on the ground (lowest ${m[c].lowest_glb}, body up at most ${m[c].body_max_lowest_glb} glb)`)
    ok(L.rig!.clipV.walk === m.walk.v_glb && L.rig!.clipV.run === m.run.v_glb, `${n}: clipV = her metrics (${m.walk.v_glb} / ${m.run.v_glb})`)
    ok(body.max[1] > 1.2, `${n}: STANDS (rest top ${body.max[1].toFixed(2)} glb; Arclotl's sits under 0.95)`)
  } else {    // Arclun: four legs on the live Arclotl's skeleton script + the halo bone her rings ride
    ok(['b_fl_up', 'b_hr_paw', 'b_ear_l', 'b_tail4', 'b_halo'].every(x => bones.includes(x)) && !bones.includes('b_arm_l'), `${n}: the lotl quadruped + halo (${bones.length} bones)`)
    for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) ok(m[c].lowest_m > -0.002 && m[c].lowest_m < 0.02, `${n} ${c}: on the ground (lowest ${m[c].lowest_m} m)`)
    ok(m.weights_bad === 0, `${n}: weights clean`)
  }
}
// what makes each HER, read off the files (rest-pose accessor extents)
if (looks.every(n => existsSync(`public/open/spirits/${n}-rigged.glb`))) {
  const w = (n: string, k: number, mesh = 'body') => { const e = ext(n, mesh); return e.max[k] - e.min[k] }
  ok(w('arclotar', 0, 'aura') > 0.9 && ext('arclotar', 'aura').max[1] > 1.0, `arclotar: bolts crackling round her (aura ${w('arclotar', 0, 'aura').toFixed(2)} wide)`)
  ok(w('arclotar', 1) > w('arcis', 1) && w('arclotar', 0) > w('arcis', 0), 'arclotar: the biggest of the three standing')
  ok(w('arclelle', 0, 'aura') > 1.1 && w('arclelle', 1, 'aura') > 0.6, `arclelle: ribbons of current loop round her (${w('arclelle', 0, 'aura').toFixed(2)} x ${w('arclelle', 1, 'aura').toFixed(2)})`)
  const orb = ext('arcis', 'aura'); ok(orb.min[1] >= 0 && orb.min[1] < 0.03 && orb.max[1] > 1.25 && w('arcis', 0, 'aura') > 1.25, `arcis: inside a big orb resting on the ground (y ${orb.min[1].toFixed(3)}..${orb.max[1].toFixed(2)})`)
  ok(w('arclun', 2) > 1.7 && ext('arclun', 'body').max[1] < 1.0, `arclun: long + low (${w('arclun', 2).toFixed(2)} long, ${ext('arclun', 'body').max[1].toFixed(2)} tall)`)
  ok(ext('arclun', 'aura').min[1] > 0.1 && w('arclun', 0, 'aura') > 1.3, `arclun: sound rings spread round her head (${w('arclun', 0, 'aura').toFixed(2)} wide)`)
}
console.log(`spirit-arcaw: ${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL', f); process.exit(1) }
