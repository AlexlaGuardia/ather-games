// BETA M244 sheet 14: Mesamere's four AWAKENED forms (owner preview). Run: npx tsx src/app/shimmer/open/ather/spirit-mesaaw.test.ts
import { existsSync, readFileSync, statSync } from 'node:fs'
import { AWAKENED_FORMS, MESAMERE_AWAKENED, MESAMERE_AW_DIAL, SECOND_FORMS, formGrow } from './spirit-models'
import { AWAKENED_BRANCHES, AWAKENED_NAMES } from '../../spirits/spirit'
import { PUBLIC_FORMS } from './spirit-public'
import { GALLERY } from '../../dev/editors/spirit-gallery'
import { alexSized } from '../../dev/editors/m249-sized'  // M249 s2: sizes Alex set in the gallery pass (pinned exactly by gallery-size-m249.test.ts)
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const CANON = '/root/athernyx/CANON/world/spirits-species.md', DIR = 'docs/looks/m244-mesamere-2026-11-28'
// names: word for word off the canon line 'Mesamere (Earth): Mesathar (Champion, pure) . Mesamelle . Mesamis . Mesamun'
const line = existsSync(CANON) ? readFileSync(CANON, 'utf8').split('\n').find(x => x.includes('**Mesamere (Earth):**')) ?? '' : ''
const canon = line.replace(/.*\*\*Mesamere \(Earth\):\*\*/, '').replace(/\*|\([^)]*\)/g, '').split('·').map(x => x.trim())
const named = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.mesamere?.[b] ?? '')
ok(canon.length === 4 && named.join() === canon.join(), `AWAKENED_NAMES.mesamere = the canon line in branch order (${named} vs ${canon})`)
const looks = named.map(n => n.toLowerCase())
ok(looks.every(n => AWAKENED_FORMS[n] === MESAMERE_AWAKENED[n]) && Object.keys(MESAMERE_AWAKENED).sort().join() === [...looks].sort().join(), `each wired once into AWAKENED_FORMS (${Object.keys(MESAMERE_AWAKENED)})`)
// gallery: four rows, consecutive, turtle + earth
const rows = GALLERY.filter(r => r.aw && r.sp === 'turtle' && r.el === 'earth')
ok(rows.length === 4 && rows.every((r, i) => r.num === rows[0].num + i && r.name === named[i] && r.aw!.look === looks[i]), `Mesamere's four rows in branch order (#${rows.map(r => r.num)}: ${rows.map(r => r.name)})`)
const L3 = '/root/athernyx/assets/stage3/grimoire-ledger-stage3.json'
if (existsSync(L3)) { const locks = JSON.parse(readFileSync(L3, 'utf8')).locks as { name: string; branch_name: string; second_form: string }[]
  for (const r of rows) ok(locks.some(l => l.name === r.name && l.second_form === 'Mesamere' && l.branch_name.toLowerCase() === r.aw!.branch), `${r.name}: a stage-3 lock off Mesamere, ${r.aw!.branch}`) }
const parent = SECOND_FORMS.turtle!.earth!, M: Record<string, any> = {}
for (const n of looks) {
  const L = MESAMERE_AWAKENED[n], m = M[n] = JSON.parse(readFileSync(`${DIR}/${n}-metrics.json`, 'utf8'))
  ok(L.url === `/open/spirits/${n}-rigged.glb` && existsSync(`public${L.url}`) && statSync(`public${L.url}`).size === m.glb_bytes, `${n}: his glb is in public/ and is the one the metrics measured (${m.glb_bytes} B)`)
  ok(existsSync(`public/open/spirits/${n}-icon.png`), `${n}: gallery icon (our render)`)
  ok(!PUBLIC_FORMS.has(n), `${n}: not in PUBLIC_FORMS (owner preview only)`)
  ok(alexSized('awakened:' + n, 'form:mesamere') || (MESAMERE_AW_DIAL[n] > formGrow('mesamere') && L.h > parent.h * 1.1), `${n}: grown past Mesamere (dial ${MESAMERE_AW_DIAL[n]} vs ${formGrow('mesamere')})`)
  ok(L.glow?.part === 'aura' && m.aura_tris > 0, `${n}: the motif (aura part, ${m.aura_tris} tris) glows`)
  ok(Math.abs(L.rig!.glbLen - m.glb_long) < 1e-3, `${n}: glbLen = his metrics (${m.glb_long})`)
  ok(m.body_verts <= 9800, `${n}: body under ~9k verts (${m.body_verts})`)
  // he WALKS: the Shellmere line's own legged rig (18 bones, four legs + feet), NOT Tidemere's glide rig; clips timed at the base's 0.464 m
  ok(m.bones === 18 && m.height_m === 0.464 && Math.abs(L.rig!.clipV.walk - 0.55 / 0.464) < 1e-3 && Math.abs(L.rig!.clipV.run - 1.9 / 0.464) < 1e-3, `${n}: the base Shellmere legged rig (${m.bones} bones), clips at 0.464 m`)
  ok(m.walk.planted_foot_drift_max_m < 0.01 && m.run.planted_foot_drift_max_m < 0.015, `${n}: planted feet hold (walk ${m.walk.planted_foot_drift_max_m} / run ${m.run.planted_foot_drift_max_m} m)`)
  ok(m.all_lowest_with_aura_glb >= 0 && ['idle', 'walk', 'run', 'sit', 'lie'].every(c => m[c].lowest_m > -0.0015), `${n}: body / eyes / aura keep above the ground (lowest ${m.all_lowest_with_aura_glb})`)
  ok(m.quality?.springs?.['walk:head'] > 0.02 && m.quality?.springs?.['walk:tail'] > 0.05, `${n}: baked springs (walk head ${m.quality?.springs?.['walk:head']}, tail ${m.quality?.springs?.['walk:tail']} rad)`)
}
// THE CHAMPION: the massive one (widest + tallest body, the biggest dial); the Virtuoso's head held high; the Ace low + long; the Enigma's spires
const th = M.mesathar, ml = M.mesamelle, mi = M.mesamis, mu = M.mesamun
ok(alexSized('awakened:mesathar', 'awakened:mesamelle', 'awakened:mesamis', 'awakened:mesamun') || (th.idle.span_m > Math.max(ml.idle.span_m, mi.idle.span_m, mu.idle.span_m) && th.body_mean_top > Math.max(ml.body_mean_top, mi.body_mean_top, mu.body_mean_top) && MESAMERE_AW_DIAL.mesathar >= Math.max(...Object.values(MESAMERE_AW_DIAL))), `mesathar: the biggest (span ${th.idle.span_m} m, top ${th.body_mean_top})`)
ok(ml.extent_hi[1] > ml.body_mean_top * 0.98 && ml.idle.top_m > mi.idle.top_m, `mesamelle: her head carried high (idle top ${ml.idle.top_m} m vs Mesamis ${mi.idle.top_m})`)
ok(mi.body_mean_top < Math.min(th.body_mean_top, mu.body_mean_top) && mi.glb_long > mu.glb_long, `mesamis: the low long runner (top ${mi.body_mean_top}, long ${mi.glb_long})`)
ok(mu.extent_hi[1] > mu.body_mean_top + 0.25, `mesamun: the crystal spires rise well over her shell (aura top ${mu.extent_hi[1]} vs body ${mu.body_mean_top})`)
console.log(`${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('FAIL', f); process.exit(fails.length ? 1 : 0)
