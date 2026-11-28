// BETA M244 sheet 12: Croakore's four AWAKENED forms (owner preview). Run: npx tsx src/app/shimmer/open/ather/spirit-croakorew.test.ts
import { existsSync, readFileSync, statSync } from 'node:fs'
import { AWAKENED_FORMS, CROAKORE_AWAKENED, CROAKORE_AW_DIAL, SECOND_FORMS, formGrow } from './spirit-models'
import { AWAKENED_BRANCHES, AWAKENED_NAMES } from '../../spirits/spirit'
import { PUBLIC_FORMS } from './spirit-public'
import { GALLERY } from '../../dev/editors/spirit-gallery'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const CANON = '/root/athernyx/CANON/world/spirits-species.md', DIR = 'docs/looks/m244-croakore-2026-11-28'
// names: word for word off the canon line 'Croakore (Earth): **Oregrak** (Champion, pure) . Croakorelle . Croakoris . Croakormyr'
const line = existsSync(CANON) ? readFileSync(CANON, 'utf8').split('\n').find(x => x.includes('**Croakore (Earth):**')) ?? '' : ''
const canon = line.replace(/.*\*\*Croakore \(Earth\):\*\*/, '').replace(/\*|\([^)]*\)/g, '').split('·').map(x => x.trim())
const named = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.croakore?.[b] ?? '')
ok(canon.length === 4 && named.join() === canon.join(), `AWAKENED_NAMES.croakore = the canon line in branch order (${named} vs ${canon})`)
const looks = named.map(n => n.toLowerCase())
ok(looks.every(n => AWAKENED_FORMS[n] === CROAKORE_AWAKENED[n]) && Object.keys(CROAKORE_AWAKENED).sort().join() === [...looks].sort().join(), `each wired once into AWAKENED_FORMS (${Object.keys(CROAKORE_AWAKENED)})`)
// gallery: four rows, consecutive, frog + earth, right after Croakara's (#091-#094)
const rows = GALLERY.filter(r => r.aw && r.sp === 'frog' && r.el === 'earth'), croakaraLast = Math.max(...GALLERY.filter(r => r.aw && r.sp === 'frog' && r.el === 'mana').map(r => r.num))
ok(rows.length === 4 && rows.every((r, i) => r.num === croakaraLast + 1 + i && r.num === 95 + i && r.name === named[i] && r.aw!.look === looks[i]), `Croakore's rows #095-#098 follow Croakara's (#${rows.map(r => r.num)}: ${rows.map(r => r.name)})`)
const L3 = '/root/athernyx/assets/stage3/grimoire-ledger-stage3.json'
if (existsSync(L3)) { const locks = JSON.parse(readFileSync(L3, 'utf8')).locks as { name: string; branch_name: string; second_form: string }[]
  for (const r of rows) ok(locks.some(l => l.name === r.name && l.second_form === 'Croakore' && l.branch_name.toLowerCase() === r.aw!.branch), `${r.name}: a stage-3 lock off Croakore, ${r.aw!.branch}`) }
const parent = SECOND_FORMS.frog!.earth!
const M: Record<string, any> = {}   // eslint-disable-line @typescript-eslint/no-explicit-any
for (const n of looks) {
  const L = CROAKORE_AWAKENED[n], m = M[n] = JSON.parse(readFileSync(`${DIR}/${n}-metrics.json`, 'utf8'))
  ok(L.url === `/open/spirits/${n}-rigged.glb` && existsSync(`public${L.url}`) && statSync(`public${L.url}`).size === m.glb_bytes, `${n}: her glb is in public/ and is the one the metrics measured (${m.glb_bytes} B)`)
  ok(existsSync(`public/open/spirits/${n}-icon.png`), `${n}: her gallery icon (our render)`)
  ok(!PUBLIC_FORMS.has(n), `${n}: not in PUBLIC_FORMS (owner preview only)`)
  ok(CROAKORE_AW_DIAL[n] > formGrow('croakore') && L.h > parent.h * 1.2, `${n}: grown past Croakore (dial ${CROAKORE_AW_DIAL[n]} vs ${formGrow('croakore')})`)
  ok(L.glow?.part === 'aura' && m.tris.aura > 0, `${n}: her motif (aura part, ${m.tris.aura} tris) glows`)
  ok(Math.abs(L.rig!.glbLen - m.glbLen) < 1e-3, `${n}: glbLen = her metrics (${m.glbLen})`)
  ok(m.bones === 20 && Math.abs(L.rig!.clipV.walk - 0.55 / m.height_m) < 2e-3 && Math.abs(L.rig!.clipV.run - 2.4 / m.height_m) < 1e-2, `${n}: the live Croakore frog rig (19 bones + the ground bone), clips timed at her height_m ${m.height_m}`)
  ok(m.aura_lowest_glb >= 0 && ['idle', 'walk', 'run', 'sit', 'lie'].every(c => m[c].lowest_m > -0.003), `${n}: body / eyes / aura keep above the ground in every clip (aura lowest ${m.aura_lowest_glb})`)
  ok(m.jiggle_peak_rad.walk > 0.05, `${n}: baked lure springs (walk peak ${m.jiggle_peak_rad.walk} rad)`)
  ok(m.verts.body < 9000, `${n}: body under 9k verts (${m.verts.body})`)
}
// what makes each HER: Oregrak the heaviest (the Champion, pure Earth) with ground cracks reaching past her; Croakorelle's crystal ball out in
// front of her chest; Croakoris's burrow behind her; Croakormyr's crust standing up off her back
const [o, e, a, y] = looks.map(n => M[n])
const wide = (m: { body_box: number[][] }) => m.body_box[1][0] - m.body_box[0][0]
ok(wide(o) > Math.max(wide(e), wide(a), wide(y)) && o.body_box[1][1] > Math.max(e.body_box[1][1], a.body_box[1][1], y.body_box[1][1]) && CROAKORE_AW_DIAL.oregrak >= Math.max(...Object.values(CROAKORE_AW_DIAL)), `oregrak: the broadest + tallest body (${wide(o).toFixed(2)} glb wide), the biggest dial`)
ok(o.aura_box[1][0] - o.aura_box[0][0] > 1.4 && o.aura_box[1][1] < 0.01, `oregrak: cracks flat on the ground, wider than her (${(o.aura_box[1][0] - o.aura_box[0][0]).toFixed(2)} glb)`)
ok(e.aura_box[1][2] > e.body_box[1][2] + 0.1 && e.aura_box[1][1] > 0.4, `croakorelle: the crystal ball out in front of her chest (aura front z ${e.aura_box[1][2]} vs body ${e.body_box[1][2]})`)
ok(a.aura_box[0][2] < a.body_box[0][2] - 0.1 && a.aura_box[1][1] > 0.4, `croakoris: the burrow + spray behind her (aura back z ${a.aura_box[0][2]} vs body ${a.body_box[0][2]})`)
ok(y.aura_box[0][2] < 0 && y.aura_box[1][1] > y.body_box[1][1] * 0.8 && y.aura_box[1][2] < y.body_box[1][2] * 0.5, `croakormyr: the crust on her back, high and behind (aura z ${y.aura_box[0][2]}-${y.aura_box[1][2]}, top ${y.aura_box[1][1]})`)
console.log(`${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('FAIL', f); process.exit(fails.length ? 1 : 0)
