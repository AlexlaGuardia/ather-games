// BETA M244 sheet 11: Croakara's four AWAKENED forms (owner preview). Run: npx tsx src/app/shimmer/open/ather/spirit-croakaraw.test.ts
import { existsSync, readFileSync, statSync } from 'node:fs'
import { AWAKENED_FORMS, CROAKARA_AWAKENED, CROAKARA_AW_DIAL, SECOND_FORMS, formGrow } from './spirit-models'
import { AWAKENED_BRANCHES, AWAKENED_NAMES } from '../../spirits/spirit'
import { PUBLIC_FORMS } from './spirit-public'
import { GALLERY } from '../../dev/editors/spirit-gallery'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const CANON = '/root/athernyx/CANON/world/spirits-species.md', DIR = 'docs/looks/m244-croakara-2026-11-28'
// names: word for word off the canon line 'Croakara (Mana): **Croakgulp** (Champion; the 99-meals form) . Croakalys . Croakavis . **Araeth** (Enigma, pure)'
const line = existsSync(CANON) ? readFileSync(CANON, 'utf8').split('\n').find(x => x.includes('**Croakara (Mana):**')) ?? '' : ''
const canon = line.replace(/.*\*\*Croakara \(Mana\):\*\*/, '').replace(/\*|\([^)]*\)/g, '').split('·').map(x => x.trim())
const named = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.croakara?.[b] ?? '')
ok(canon.length === 4 && named.join() === canon.join(), `AWAKENED_NAMES.croakara = the canon line in branch order (${named} vs ${canon})`)
const looks = named.map(n => n.toLowerCase())
ok(looks.every(n => AWAKENED_FORMS[n] === CROAKARA_AWAKENED[n]) && Object.keys(CROAKARA_AWAKENED).sort().join() === [...looks].sort().join(), `each wired once into AWAKENED_FORMS (${Object.keys(CROAKARA_AWAKENED)})`)
// gallery: four rows, consecutive, frog + mana, right after Croakarc's (#087-#090)
const rows = GALLERY.filter(r => r.aw && r.sp === 'frog' && r.el === 'mana'), croakarcLast = Math.max(...GALLERY.filter(r => r.aw && r.sp === 'frog' && r.el === 'storm').map(r => r.num))
ok(rows.length === 4 && rows.every((r, i) => r.num === croakarcLast + 1 + i && r.name === named[i] && r.aw!.look === looks[i]), `Croakara's rows follow Croakarc's (#${rows.map(r => r.num)}: ${rows.map(r => r.name)})`)
const L3 = '/root/athernyx/assets/stage3/grimoire-ledger-stage3.json'
if (existsSync(L3)) { const locks = JSON.parse(readFileSync(L3, 'utf8')).locks as { name: string; branch_name: string; second_form: string }[]
  for (const r of rows) ok(locks.some(l => l.name === r.name && l.second_form === 'Croakara' && l.branch_name.toLowerCase() === r.aw!.branch), `${r.name}: a stage-3 lock off Croakara, ${r.aw!.branch}`) }
const parent = SECOND_FORMS.frog!.mana!
for (const n of looks) {
  const L = CROAKARA_AWAKENED[n], m = JSON.parse(readFileSync(`${DIR}/${n}-metrics.json`, 'utf8'))
  ok(L.url === `/open/spirits/${n}-rigged.glb` && existsSync(`public${L.url}`) && statSync(`public${L.url}`).size === m.glb_bytes, `${n}: her glb is in public/ and is the one the metrics measured (${m.glb_bytes} B)`)
  ok(existsSync(`public/open/spirits/${n}-icon.png`), `${n}: her gallery icon (our render)`)
  ok(!PUBLIC_FORMS.has(n), `${n}: not in PUBLIC_FORMS (owner preview only)`)
  ok(CROAKARA_AW_DIAL[n] > formGrow('croakara') && L.h > parent.h * 1.2, `${n}: grown past Croakara (dial ${CROAKARA_AW_DIAL[n]} vs ${formGrow('croakara')})`)
  ok(L.glow?.part === 'aura' && m.tris.aura > 0, `${n}: her motif (aura part, ${m.tris.aura} tris) glows`)
  ok(Math.abs(L.rig!.glbLen - m.glbLen) < 1e-3, `${n}: glbLen = her metrics (${m.glbLen})`)
  if (n === 'croakalys') {
    ok(m.biped && m.ground && Math.abs(L.rig!.clipV.walk - m.walk.v_glb) < 1e-4 && Math.abs(L.rig!.clipV.run - m.run.v_glb) < 1e-4, `croakalys: the ground biped, clip speeds = her metrics (${m.walk.v_glb} / ${m.run.v_glb})`)
    ok(m.body_mean_top > 1.1, `croakalys: she stands UP (body top ${m.body_mean_top} glb vs Croakara's 0.794)`)
    for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) ok(m[c].lowest_glb >= -0.0015 && m[c].body_max_lowest_glb < 0.01, `croakalys ${c}: nothing under the ground (${m[c].lowest_glb}) and on it (${m[c].body_max_lowest_glb})`)
  } else {
    ok(m.bones === 19 && Math.abs(L.rig!.clipV.walk - 0.55 / m.height_m) < 2e-3 && Math.abs(L.rig!.clipV.run - 2.4 / m.height_m) < 1e-2, `${n}: the live Croakara frog rig (19 bones), clips timed at her height_m ${m.height_m}`)
    ok(m.aura_lowest_glb >= 0 && ['idle', 'walk', 'run', 'sit', 'lie'].every(c => m[c].lowest_m > -0.003), `${n}: body / eyes / aura keep above the ground (aura lowest ${m.aura_lowest_glb})`)
    ok(m.jiggle_peak_rad.walk > 0.05, `${n}: baked lure springs (walk peak ${m.jiggle_peak_rad.walk} rad)`)
  }
}
// THE 99-MEALS FORM: visibly heavier and bigger-bellied than Croakara (her body wider + longer, on a bigger dial than her sisters)
const gm = JSON.parse(readFileSync(`${DIR}/croakgulp-metrics.json`, 'utf8')), am = JSON.parse(readFileSync(`${DIR}/araeth-metrics.json`, 'utf8'))
ok(gm.glbLen > am.glbLen * 1.15 && gm.idle.span_m > am.idle.span_m * 1.1 && CROAKARA_AW_DIAL.croakgulp >= Math.max(...Object.values(CROAKARA_AW_DIAL)), `croakgulp: the heaviest (length ${gm.glbLen} vs ${am.glbLen}, span ${gm.idle.span_m} vs ${am.idle.span_m} m, the biggest dial)`)
console.log(`${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('FAIL', f); process.exit(fails.length ? 1 : 0)
