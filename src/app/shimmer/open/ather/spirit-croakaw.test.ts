// BETA M244 sheet 9: Croakarc's four AWAKENED forms (owner preview). Run: npx tsx src/app/shimmer/open/ather/spirit-croakaw.test.ts
import { existsSync, readFileSync, statSync } from 'node:fs'
import { AWAKENED_FORMS, CROAK_AWAKENED, CROAK_AW_DIAL, CROAKARC_RIG, SECOND_FORMS, formGrow } from './spirit-models'
import { AWAKENED_BRANCHES, AWAKENED_NAMES } from '../../spirits/spirit'
import { PUBLIC_FORMS } from './spirit-public'
import { alexSized } from '../../dev/editors/m249-sized'  // M249 s2: sizes Alex set in the gallery pass (pinned exactly by gallery-size-m249.test.ts)
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const CANON = '/root/athernyx/CANON/world/spirits-species.md', DIR = 'docs/looks/m244-croakarc-2026-11-28'
// names: word for word off the canon line 'Croakarc (Storm): Croakarkor . Croakarielle . **Arcvik** (Ace, pure) . Croakarcun', branch order
const line = existsSync(CANON) ? readFileSync(CANON, 'utf8').split('\n').find(x => x.includes('**Croakarc (Storm):**')) ?? '' : ''
const canon = line.replace(/.*\*\*Croakarc \(Storm\):\*\*/, '').replace(/\*|\([^)]*\)/g, '').split('·').map(x => x.trim())
const named = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.croakarc?.[b] ?? '')
ok(canon.length === 4 && named.join() === canon.join(), `AWAKENED_NAMES.croakarc = the canon line in branch order (${named} vs ${canon})`)
ok(/Arcvik\*\* \(Ace, pure\)/.test(line), 'canon: Arcvik is the Ace (pure)')
const looks = named.map(n => n.toLowerCase())
ok(looks.every(n => AWAKENED_FORMS[n] === CROAK_AWAKENED[n]) && Object.keys(CROAK_AWAKENED).sort().join() === [...looks].sort().join(), `each wired once into AWAKENED_FORMS (${Object.keys(CROAK_AWAKENED)})`)
const parent = SECOND_FORMS.frog!.storm!
for (const n of looks) {
  const L = CROAK_AWAKENED[n], m = JSON.parse(readFileSync(`${DIR}/${n}-metrics.json`, 'utf8'))
  ok(L.url === `/open/spirits/${n}-rigged.glb` && existsSync(`public${L.url}`) && statSync(`public${L.url}`).size === m.glb_bytes, `${n}: her glb is in public/ and is the one the metrics measured (${m.glb_bytes} B)`)
  ok(existsSync(`public/open/spirits/${n}-icon.png`), `${n}: her gallery icon (our render)`)
  ok(!PUBLIC_FORMS.has(n), `${n}: not in PUBLIC_FORMS (owner preview only)`)
  ok(alexSized('awakened:' + n, 'form:croakarc') || (CROAK_AW_DIAL[n] > formGrow('croakarc') && L.h > parent.h * 1.2), `${n}: grown past Croakarc (dial ${CROAK_AW_DIAL[n]} vs ${formGrow('croakarc')})`)
  ok(L.glow?.part === 'aura', `${n}: her motif (aura part) glows`)
  if (n === 'arcvik') {
    ok(L.rig!.clipV.walk === CROAKARC_RIG.clipV.walk && L.rig!.glbLen === m.glbLen && m.bones === 24, `arcvik: the live Croakarc skink rig (24 bones, her clips), glbLen = her metrics (${m.glbLen})`)
    ok(m.walk.lowest_m > -0.003 && m.run.lowest_m > -0.003, `arcvik: walk / run keep to the ground (${m.walk.lowest_m} / ${m.run.lowest_m} m)`)
  } else {
    ok(m.biped && m.ground && Math.abs(m.glbLen - L.rig!.glbLen) < 1e-3 && Math.abs(L.rig!.clipV.walk - m.walk.v_glb) < 1e-4 && Math.abs(L.rig!.clipV.run - m.run.v_glb) < 1e-4,
      `${n}: wired numbers = her metrics (glbLen ${m.glbLen}, walk ${m.walk.v_glb} / run ${m.run.v_glb} glb/s)`)
    ok(m.body_mean_top > 1.0, `${n}: she stands UP (body top ${m.body_mean_top} glb vs the skink's 0.512)`)
    for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) ok(m[c].lowest_glb >= -0.0015 && m[c].body_max_lowest_glb < 0.01, `${n} ${c}: nothing under the ground (${m[c].lowest_glb}) and on it (${m[c].body_max_lowest_glb})`)
  }
}
console.log(`${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('FAIL', f); process.exit(fails.length ? 1 : 0)
