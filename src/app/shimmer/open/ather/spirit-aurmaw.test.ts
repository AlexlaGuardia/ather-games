// BETA M244 sheet 15: Aurmere's four AWAKENED forms (owner preview). Run: npx tsx src/app/shimmer/open/ather/spirit-aurmaw.test.ts
import { existsSync, readFileSync, statSync } from 'node:fs'
import { AWAKENED_FORMS, AURMERE_AWAKENED, AURMERE_AW_DIAL, SECOND_FORMS, formGrow } from './spirit-models'
import { AWAKENED_BRANCHES, AWAKENED_NAMES } from '../../spirits/spirit'
import { PUBLIC_FORMS } from './spirit-public'
import { GALLERY } from '../../dev/editors/spirit-gallery'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const CANON = '/root/athernyx/CANON/world/spirits-species.md', DIR = 'docs/looks/m244-aurmere-2026-11-28'
// names: word for word off the canon line 'Aurmere (Mana): Aurmerok . Aurmelys . Aurmevex . Aurhael (Enigma, pure)'
const line = existsSync(CANON) ? readFileSync(CANON, 'utf8').split('\n').find(x => x.includes('**Aurmere (Mana):**')) ?? '' : ''
const canon = line.replace(/.*\*\*Aurmere \(Mana\):\*\*/, '').replace(/\*|\([^)]*\)/g, '').split('·').map(x => x.trim())
const named = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.aurmere?.[b] ?? '')
ok(canon.length === 4 && named.join() === canon.join(), `AWAKENED_NAMES.aurmere = the canon line in branch order (${named} vs ${canon})`)
const looks = named.map(n => n.toLowerCase())
ok(looks.every(n => AWAKENED_FORMS[n] === AURMERE_AWAKENED[n]) && Object.keys(AURMERE_AWAKENED).sort().join() === [...looks].sort().join(), `each wired once into AWAKENED_FORMS (${Object.keys(AURMERE_AWAKENED)})`)
// gallery: four rows, consecutive, turtle + mana
const rows = GALLERY.filter(r => r.aw && r.sp === 'turtle' && r.el === 'mana')
ok(rows.length === 4 && rows.every((r, i) => r.num === rows[0].num + i && r.name === named[i] && r.aw!.look === looks[i]), `Aurmere's four rows in branch order (#${rows.map(r => r.num)}: ${rows.map(r => r.name)})`)
const L3 = '/root/athernyx/assets/stage3/grimoire-ledger-stage3.json'
if (existsSync(L3)) { const locks = JSON.parse(readFileSync(L3, 'utf8')).locks as { name: string; branch_name: string; second_form: string }[]
  for (const r of rows) ok(locks.some(l => l.name === r.name && l.second_form === 'Aurmere' && l.branch_name.toLowerCase() === r.aw!.branch), `${r.name}: a stage-3 lock off Aurmere, ${r.aw!.branch}`) }
const parent = SECOND_FORMS.turtle!.mana!, M: Record<string, any> = {}
for (const n of looks) {
  const L = AURMERE_AWAKENED[n], m = M[n] = JSON.parse(readFileSync(`${DIR}/${n}-metrics.json`, 'utf8'))
  ok(L.url === `/open/spirits/${n}-rigged.glb` && existsSync(`public${L.url}`) && statSync(`public${L.url}`).size === m.glb_bytes, `${n}: his glb is in public/ and is the one the metrics measured (${m.glb_bytes} B)`)
  ok(existsSync(`public/open/spirits/${n}-icon.png`), `${n}: gallery icon (our render)`)
  ok(!PUBLIC_FORMS.has(n), `${n}: not in PUBLIC_FORMS (owner preview only)`)
  ok(AURMERE_AW_DIAL[n] > formGrow('aurmere') && L.h > parent.h * 1.1, `${n}: grown past Aurmere (dial ${AURMERE_AW_DIAL[n]} vs ${formGrow('aurmere')})`)
  ok(L.glow?.part === 'aura' && m.aura_tris > 0, `${n}: the motif (aura part, ${m.aura_tris} tris) glows`)
  ok(Math.abs(L.rig!.glbLen - m.glb_long) < 1e-3, `${n}: glbLen = his metrics (${m.glb_long})`)
  ok(m.body_verts <= 9800, `${n}: body under ~9k verts (${m.body_verts})`)
  // she WALKS: the Shellmere line's own legged rig (18 bones, four legs + feet), NOT Tidemere's glide rig; clips timed at the base's 0.464 m
  ok(m.bones === 18 && m.height_m === 0.464 && Math.abs(L.rig!.clipV.walk - 0.55 / 0.464) < 1e-3 && Math.abs(L.rig!.clipV.run - 1.9 / 0.464) < 1e-3, `${n}: the base Shellmere legged rig (${m.bones} bones), clips at 0.464 m`)
  ok(m.walk.planted_foot_drift_max_m < 0.01 && m.run.planted_foot_drift_max_m < 0.015, `${n}: planted feet hold (walk ${m.walk.planted_foot_drift_max_m} / run ${m.run.planted_foot_drift_max_m} m)`)
  ok(m.all_lowest_with_aura_glb >= 0 && ['idle', 'walk', 'run', 'sit', 'lie'].every(c => m[c].lowest_m > -0.0015), `${n}: body / eyes / aura keep above the ground (lowest ${m.all_lowest_with_aura_glb})`)
  ok(m.quality?.springs?.['walk:head'] > 0.02 && m.quality?.springs?.['walk:tail'] > 0.05, `${n}: baked springs (walk head ${m.quality?.springs?.['walk:head']}, tail ${m.quality?.springs?.['walk:tail']} rad)`)
}
// THE CHAMPION: the biggest, the sun disc rising behind him; the Virtuoso's sound rings reach wide; the Ace low with her ring; the Enigma's crown + halo
const ok_ = AURMERE_AWAKENED, rk = M.aurmerok, ly = M.aurmelys, vx = M.aurmevex, ha = M.aurhael
ok(rk.idle.span_m > Math.max(ly.idle.span_m, vx.idle.span_m, ha.idle.span_m) && AURMERE_AW_DIAL.aurmerok >= Math.max(...Object.values(AURMERE_AW_DIAL)), `aurmerok: the biggest (span ${rk.idle.span_m} m, dial ${AURMERE_AW_DIAL.aurmerok})`)
ok(rk.extent_hi[1] > rk.body_mean_top + 0.2 && rk.extent_lo[2] < -0.7, `aurmerok: the sun disc stands behind him, over his shell (aura top ${rk.extent_hi[1]} vs body ${rk.body_mean_top}, back ${rk.extent_lo[2]})`)
ok(ly.extent_hi[0] - ly.extent_lo[0] > 1.4 && ly.extent_hi[1] > ly.body_mean_top + 0.2, `aurmelys: her sound rings swirl wide round her, the spiral over her (x ${ly.extent_lo[0]}..${ly.extent_hi[0]}, top ${ly.extent_hi[1]})`)
ok(vx.body_mean_top < Math.min(rk.body_mean_top, ha.body_mean_top) && vx.extent_hi[0] > 0.65, `aurmevex: the low one with the ring round her body (top ${vx.body_mean_top}, ring x ${vx.extent_hi[0]})`)
ok(vx.tris.eyes > ly.tris.eyes && ha.tris.eyes > rk.tris.eyes, `aurmevex + aurhael keep the antennae (eyes tris ${vx.tris.eyes} / ${ha.tris.eyes} vs ${ly.tris.eyes} / ${rk.tris.eyes})`)
ok(ha.extent_hi[1] > ha.body_mean_top + 0.25, `aurhael: the gold crown + halo rise well over her shell (aura top ${ha.extent_hi[1]} vs body ${ha.body_mean_top})`)
ok(Object.keys(ok_).length === 4, 'four forms')
console.log(`${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('FAIL', f); process.exit(fails.length ? 1 : 0)
