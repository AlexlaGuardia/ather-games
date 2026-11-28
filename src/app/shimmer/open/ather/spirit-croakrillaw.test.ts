// BETA M244 sheet 12: Croakrill's four AWAKENED forms (owner preview). Run: npx tsx src/app/shimmer/open/ather/spirit-croakrillaw.test.ts
import { existsSync, readFileSync, statSync } from 'node:fs'
import { AWAKENED_FORMS, CROAKRILL_AWAKENED, CROAKRILL_AW_DIAL, SECOND_FORMS, formGrow } from './spirit-models'
import { AWAKENED_BRANCHES, AWAKENED_NAMES } from '../../spirits/spirit'
import { PUBLIC_FORMS } from './spirit-public'
import { GALLERY } from '../../dev/editors/spirit-gallery'
import { alexSized } from '../../dev/editors/m249-sized'  // M249 s2: sizes Alex set in the gallery pass (pinned exactly by gallery-size-m249.test.ts)
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const CANON = '/root/athernyx/CANON/world/spirits-species.md', DIR = 'docs/looks/m244-croakrill-2026-11-28'
// names: word for word off the canon line 'Croakrill (Water): Croakrillok . **Rillesse** (Virtuoso, pure) . Croakrillvex . Croakrilleth'
const line = existsSync(CANON) ? readFileSync(CANON, 'utf8').split('\n').find(x => x.includes('**Croakrill (Water):**')) ?? '' : ''
const canon = line.replace(/.*\*\*Croakrill \(Water\):\*\*/, '').replace(/\*|\([^)]*\)/g, '').split('·').map(x => x.trim())
const named = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.croakrill?.[b] ?? '')
ok(canon.length === 4 && named.join() === canon.join(), `AWAKENED_NAMES.croakrill = the canon line in branch order (${named} vs ${canon})`)
const looks = named.map(n => n.toLowerCase())
ok(looks.every(n => AWAKENED_FORMS[n] === CROAKRILL_AWAKENED[n]) && Object.keys(CROAKRILL_AWAKENED).sort().join() === [...looks].sort().join(), `each wired once into AWAKENED_FORMS (${Object.keys(CROAKRILL_AWAKENED)})`)
// gallery: four rows, consecutive, frog + water
const rows = GALLERY.filter(r => r.aw && r.sp === 'frog' && r.el === 'water')
ok(rows.length === 4 && rows.every((r, i) => r.num === rows[0].num + i && r.name === named[i] && r.aw!.look === looks[i]), `Croakrill's four rows in branch order (#${rows.map(r => r.num)}: ${rows.map(r => r.name)})`)
const L3 = '/root/athernyx/assets/stage3/grimoire-ledger-stage3.json'
if (existsSync(L3)) { const locks = JSON.parse(readFileSync(L3, 'utf8')).locks as { name: string; branch_name: string; second_form: string }[]
  for (const r of rows) ok(locks.some(l => l.name === r.name && l.second_form === 'Croakrill' && l.branch_name.toLowerCase() === r.aw!.branch), `${r.name}: a stage-3 lock off Croakrill, ${r.aw!.branch}`) }
const parent = SECOND_FORMS.frog!.water!
for (const n of looks) {
  const L = CROAKRILL_AWAKENED[n], m = JSON.parse(readFileSync(`${DIR}/${n}-metrics.json`, 'utf8'))
  ok(L.url === `/open/spirits/${n}-rigged.glb` && existsSync(`public${L.url}`) && statSync(`public${L.url}`).size === m.glb_bytes, `${n}: her glb is in public/ and is the one the metrics measured (${m.glb_bytes} B)`)
  ok(existsSync(`public/open/spirits/${n}-icon.png`), `${n}: her gallery icon (our render)`)
  ok(!PUBLIC_FORMS.has(n), `${n}: not in PUBLIC_FORMS (owner preview only)`)
  ok(alexSized('awakened:' + n, 'form:croakrill') || (CROAKRILL_AW_DIAL[n] > formGrow('croakrill') && L.h > parent.h * 1.2), `${n}: grown past Croakrill (dial ${CROAKRILL_AW_DIAL[n]} vs ${formGrow('croakrill')})`)
  ok(L.glow?.part === 'aura' && m.tris.aura > 0, `${n}: her motif (aura part, ${m.tris.aura} tris) glows`)
  ok(Math.abs(L.rig!.glbLen - m.glbLen) < 1e-3, `${n}: glbLen = her metrics (${m.glbLen})`)
  ok(m.body_verts <= 9800, `${n}: body under ~9k verts (${m.body_verts})`)
  if (n === 'rillesse') {
    ok(m.biped && m.ground && Math.abs(L.rig!.clipV.walk - m.walk.v_glb) < 1e-4 && Math.abs(L.rig!.clipV.run - m.run.v_glb) < 1e-4, `rillesse: the ground biped, clip speeds = her metrics (${m.walk.v_glb} / ${m.run.v_glb})`)
    ok(m.body_mean_top > 1.1, `rillesse: she stands UP (body top ${m.body_mean_top} glb vs Croakrill's 0.854)`)
    for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) ok(m[c].lowest_glb >= -0.0015 && m[c].body_max_lowest_glb < 0.01, `rillesse ${c}: nothing under the ground (${m[c].lowest_glb}) and on it (${m[c].body_max_lowest_glb})`)
  } else {
    ok(m.bones === 19 && Math.abs(L.rig!.clipV.walk - 0.55 / m.height_m) < 2e-3 && Math.abs(L.rig!.clipV.run - 2.4 / m.height_m) < 1e-2, `${n}: the live Croakrill frog rig (19 bones), clips timed at her height_m ${m.height_m}`)
    ok(m.aura_lowest_glb >= 0 && ['idle', 'walk', 'run', 'sit', 'lie'].every(c => m[c].lowest_m > -0.003), `${n}: body / eyes / aura keep above the ground (aura lowest ${m.aura_lowest_glb})`)
    ok(m.jiggle_peak_rad.walk > 0.05, `${n}: baked lure springs (walk peak ${m.jiggle_peak_rad.walk} rad)`)
  }
}
// THE CHAMPION: bigger than her sisters (wider + taller body, the biggest dial); the Enigma's cloud hangs over her head
const km = JSON.parse(readFileSync(`${DIR}/croakrillok-metrics.json`, 'utf8')), em = JSON.parse(readFileSync(`${DIR}/croakrilleth-metrics.json`, 'utf8'))
ok(alexSized('awakened:croakrillok', 'awakened:rillesse', 'awakened:croakrillvex', 'awakened:croakrilleth') || (km.idle.span_m > em.idle.span_m * 1.1 && CROAKRILL_AW_DIAL.croakrillok >= Math.max(...Object.values(CROAKRILL_AW_DIAL))), `croakrillok: the biggest (span ${km.idle.span_m} vs ${em.idle.span_m} m, the biggest dial)`)
ok(em.aura_lowest_glb > em.body_mean_top, `croakrilleth: her rain cloud + rain hang above her body (aura lowest ${em.aura_lowest_glb} > body top ${em.body_mean_top})`)
console.log(`${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('FAIL', f); process.exit(fails.length ? 1 : 0)
