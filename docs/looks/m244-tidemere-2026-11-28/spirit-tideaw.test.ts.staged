// BETA M244 sheet 11: Tidemere's four AWAKENED forms (owner preview). Run: npx tsx src/app/shimmer/open/ather/spirit-tideaw.test.ts
// Canon (spirits-species.md, Alex 11-28): the Tidemere line CARRIES ITS OWN WATER: every awakening keeps its flippers and glides on a thin
// sheet of water, so each is on Tidemere's own legless glide rig and draws her water sheet + trail (spirit-water.ts).
import { existsSync, readFileSync, statSync } from 'node:fs'
import { AWAKENED_FORMS, TIDE_AWAKENED, TIDE_AW_DIAL, SECOND_FORMS, formGrow } from './spirit-models'
import { AWAKENED_BRANCHES, AWAKENED_NAMES } from '../../spirits/spirit'
import { PUBLIC_FORMS } from './spirit-public'
import { isWaterForm } from './spirit-water'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const CANON = '/root/athernyx/CANON/world/spirits-species.md', DIR = 'docs/looks/m244-tidemere-2026-11-28'
// names: word for word off the canon line 'Tidemere (Water): Tidemok . **Tidessa** (Virtuoso, pure) . Tidemerk . Tidemyr', branch order
const text = existsSync(CANON) ? readFileSync(CANON, 'utf8') : '', line = text.split('\n').find(x => x.includes('**Tidemere (Water):**')) ?? ''
const canon = line.replace(/.*\*\*Tidemere \(Water\):\*\*/, '').replace(/\*|\([^)]*\)/g, '').split('·').map(x => x.trim())
const named = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.tidemere?.[b] ?? '')
ok(canon.length === 4 && named.join() === canon.join(), `AWAKENED_NAMES.tidemere = the canon line in branch order (${named} vs ${canon})`)
ok(/Tidessa\*\* \(Virtuoso, pure\)/.test(line), 'canon: Tidessa is the Virtuoso (pure)')
ok(/The Tidemere line carries its own water/.test(text) && /four awakenings keep their flippers/.test(text), 'canon: the line carries its own water, the four keep their flippers')
const looks = named.map(n => n.toLowerCase())
ok(looks.every(n => AWAKENED_FORMS[n] === TIDE_AWAKENED[n]) && Object.keys(TIDE_AWAKENED).sort().join() === [...looks].sort().join(), `each wired once into AWAKENED_FORMS (${Object.keys(TIDE_AWAKENED)})`)
const parent = SECOND_FORMS.turtle!.water!
/** the bone names written into a glb (its JSON chunk) */
const glbBones = (p: string): string[] => {
  const b = readFileSync(p), n = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + n).toString('utf8'))
  return (j.skins?.[0]?.joints ?? []).map((i: number) => j.nodes[i].name as string)
}
const meshNames = (p: string): string[] => { const b = readFileSync(p), n = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + n).toString('utf8')).meshes.map((m: { name: string }) => m.name) }
for (const n of looks) {
  const L = TIDE_AWAKENED[n], m = JSON.parse(readFileSync(`${DIR}/${n}-metrics.json`, 'utf8')), g = `public${L.url}`
  ok(L.url === `/open/spirits/${n}-rigged.glb` && existsSync(g) && statSync(g).size === m.glb_bytes, `${n}: her glb is in public/ and is the one the metrics measured (${m.glb_bytes} B)`)
  ok(existsSync(`public/open/spirits/${n}-icon.png`), `${n}: her gallery icon (our render)`)
  ok(!PUBLIC_FORMS.has(n), `${n}: not in PUBLIC_FORMS (owner preview only)`)
  ok(TIDE_AW_DIAL[n] > formGrow('tidemere') && L.h > parent.h * 1.2, `${n}: grown past Tidemere (dial ${TIDE_AW_DIAL[n]} vs ${formGrow('tidemere')})`)
  ok(L.glow?.part === 'aura' && existsSync(g) && meshNames(g).includes('aura'), `${n}: her motif (aura part) is in the glb and glows`)
  ok(Math.abs(L.rig!.glbLen - m.glb_long) < 1e-3 && L.rig!.clipV.walk === parent.rig!.clipV.walk && L.rig!.clipV.run === parent.rig!.clipV.run, `${n}: glbLen = her metrics (${m.glb_long}), Tidemere's clip speeds`)
  // the glide rig: Tidemere's 14 bones, flipper + blade bones, NO legs (read out of the glb itself)
  const bones = existsSync(g) ? glbBones(g) : []
  ok(bones.length === 14 && ['shell', 'flip0_l', 'blade0_l', 'flip1_r', 'blade1_r', 'head', 'lids'].every(b => bones.some(x => x === b || x === `b_${b}`)) && !bones.some(x => /leg|foot|paw|knee/.test(x)),
    `${n}: on Tidemere's glide rig (${bones.length} bones, flippers, no legs)`)
  ok(isWaterForm(n), `${n}: glides on her own water (spirit-water WATER_FORMS: the sheet + the wet trail)`)
  for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) {
    const clear = c === 'sit' || c === 'lie' ? m.clear_sit : m.clear
    ok(m[c].body_low_min >= clear - 0.001 && m[c].body_low_max < clear + 0.012, `${n} ${c}: her plastron RIDES her sheet (${m[c].body_low_min}..${m[c].body_low_max} glb over the ground, clear ${clear})`)
    const floor = c === 'sit' || c === 'lie' ? m.clear_sit + 0.008 : m.fin_floor   // rig_tidemere fin_pose floors; the springs may dip a blade 4 mm (+ 2 mm between keys)
    ok(m[c].fin_low_min >= floor - 0.006, `${n} ${c}: her flippers stroke over the water, never step (lowest ${m[c].fin_low_min}, floor ${floor})`)
  }
  ok(m.all_lowest_with_aura_glb >= 0.001, `${n}: nothing under the ground in any clip, motif included (${m.all_lowest_with_aura_glb})`)
  ok(m.body_verts < 9000, `${n}: body under 9k verts (${m.body_verts})`)
  const sp = m.quality?.springs ?? {}
  ok((sp['run:blade0l'] ?? 0) > 0.05 && (sp['walk:head'] ?? 0) > 0.02, `${n}: baked springs (blade ${sp['run:blade0l']}, head ${sp['walk:head']} rad)`)
}
// silhouettes, read off the metrics (glb units): Tidemok the tallest (spikes), Tidemerk the longest + lowest, Tidessa's crown over her head
const M = Object.fromEntries(looks.map(n => [n, JSON.parse(readFileSync(`${DIR}/${n}-metrics.json`, 'utf8'))]))
if (looks.length === 4) {
  ok(M.tidemok.extent_hi[1] > Math.max(M.tidessa.body_mean_top, M.tidemerk.extent_hi[1], M.tidemyr.body_mean_top) + 0.1, `tidemok: the big spiked shell stands tallest (${M.tidemok.extent_hi[1]})`)
  ok(M.tidemerk.glb_long > Math.max(M.tidemok.glb_long, M.tidessa.glb_long, M.tidemyr.glb_long) && M.tidemerk.body_mean_top < Math.min(M.tidemok.body_mean_top, M.tidessa.body_mean_top, M.tidemyr.body_mean_top),
    `tidemerk: the longest and the lowest (lean, fast: ${M.tidemerk.glb_long} long, ${M.tidemerk.body_mean_top} top)`)
  ok((M.tidessa.quality.aura.head ?? 0) > 0 && (M.tidessa.quality.aura.neck ?? 0) > 0, 'tidessa: a crown on her head bone + a necklace on her neck bone')
  ok(M.tidemyr.aura_tris > 2000, `tidemyr: the reef + the waterfall (${M.tidemyr.aura_tris} tris)`)
}
console.log(`${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('FAIL', f); process.exit(fails.length ? 1 : 0)
