// M202 11-28 TIDEMERE CARRIES HER OWN WATER (spirit-water.ts): the sheet she rides + the wet trail that dries.
// Run: npx tsx src/app/shimmer/open/ather/spirit-water.test.ts
// Also reads the canon line (the rule this draws) and her shipped glb's clips: no flipper vertex goes under the sheet, the plastron rides it.
import * as fs from 'fs'
import * as THREE from 'three'
import { isWaterForm, makeTideGlide, trailStep, wetCount, TRAIL_N, TRAIL_LIFE, SHEET_CLEAR } from './spirit-water'
import { formLook } from './spirit-models'

let fails = 0, pass = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fails++; console.log('FAIL ' + m) } }

// the rule, from the canon file (Magii bcc8bb5)
const canon = fs.readFileSync('/root/athernyx/CANON/world/spirits-species.md', 'utf8')
ok(/Tidemere line carries its own water/.test(canon) && /glides on a thin sheet of water that travels under it, leaving a wet trail that dries behind/.test(canon), 'canon: the Tidemere line carries its own water (spirits-species.md)')

// who glides: Tidemere only (the Shellmere line's water form), not her sisters
const tide = formLook('turtle', 'water')!
ok(isWaterForm(tide.name) && tide.name === 'tidemere', `Tidemere glides (${tide.name})`)
ok(['earth', 'mana', 'storm'].every(e => !isWaterForm(formLook('turtle', e as 'earth')!.name)) && !isWaterForm('shellmere') && !isWaterForm('vulnix'), 'her sisters, her base, other water forms walk')

// pure: a patch every `gap` of travel, none while she stands
{ const st = { x: 0, z: 0, init: false }; let laid = 0
  for (let i = 0; i < 50; i++) if (trailStep(st, 0, 0, 0.3)) laid++
  ok(laid === 0, `standing still lays no wet patch (${laid})`)
  for (let i = 0; i <= 105; i++) if (trailStep(st, i * 0.03, 0, 0.3)) laid++
  ok(laid === 10, `3.15 m of travel at a 0.3 m gap lays 10 patches (${laid})`)
  ok(wetCount([0, 1, 2, -99], 3) === 3 && wetCount([0, 1, 2], 0.5 + TRAIL_LIFE) === 2 && wetCount([0], TRAIL_LIFE + 0.01) === 0, 'wetCount: a patch is wet for TRAIL_LIFE, then dry') }

// the real thing in a scene: her group under a parent; walk her 4 m, then stand
{ const h = tide.h, scene = new THREE.Group(), grp = new THREE.Group(), shell = new THREE.Object3D(); scene.add(grp); grp.add(shell); shell.position.set(0, 0.3 * h, -0.05 * h)
  const w = makeTideGlide(h); grp.add(w.sheet); scene.add(w.trail)
  ok(w.sheet.parent === grp && w.trail.parent === scene && w.sheet.name === 'tide-sheet' && w.trail.name === 'tide-trail', 'the sheet rides IN her group, the trail lies BESIDE it')
  ok(w.sheet.position.y > 0 && w.sheet.position.y < SHEET_CLEAR * h, `the sheet lies on her ground, under her plastron (${w.sheet.position.y.toFixed(4)} m < ${(SHEET_CLEAR * h).toFixed(4)})`)
  const box = new THREE.Box3().setFromObject(w.sheet); ok(box.max.x - box.min.x > 0.6 * h && box.max.z - box.min.z > 0.8 * h, `the sheet spans her body (${(box.max.x - box.min.x).toFixed(2)} x ${(box.max.z - box.min.z).toFixed(2)} m)`)
  let t = 0; const tick = (dx: number) => { grp.position.x += dx; grp.updateMatrixWorld(true); t += 1 / 30; w.update(t, grp, shell) }
  for (let i = 0; i < 30; i++) tick(0)
  ok(w.stats().laid === 0, `standing, no trail (${w.stats().laid})`)
  for (let i = 0; i < 120; i++) tick(4 / 120)
  const s1 = w.stats(); ok(s1.laid >= Math.floor(4 / w.gap) - 1 && s1.wet > 0 && s1.wet <= TRAIL_N, `walking 4 m lays her trail (${s1.laid} laid, ${s1.wet} wet, cap ${TRAIL_N})`)
  ok(Math.abs(w.sheet.position.x) < 1e-6, 'the sheet follows her body (centred under her shell)')
  const pos = (w.trail.geometry.getAttribute('position') as THREE.BufferAttribute)
  let ys = Infinity, ye = -Infinity; for (let i = 0; i < pos.count; i++) { const b = (w.trail.geometry.getAttribute('aBirth') as THREE.BufferAttribute).getX(i); if (b > 0) { ys = Math.min(ys, pos.getY(i)); ye = Math.max(ye, pos.getY(i)) } }
  ok(ys > 0 && ye < 0.01, `the patches lie on her ground (${ys.toFixed(4)}..${ye.toFixed(4)} m)`)
  for (let i = 0; i < 200; i++) tick(0.2)
  ok(w.stats().wet <= TRAIL_N && w.stats().laid > TRAIL_N, `a long walk keeps at most ${TRAIL_N} patches (${w.stats().wet} wet of ${w.stats().laid} laid)`)
  for (let i = 0; i < Math.ceil((TRAIL_LIFE + 0.2) * 30); i++) tick(0)
  ok(w.stats().wet === 0, `standing ${TRAIL_LIFE + 0.2} s, her trail has dried (${w.stats().wet} wet)`)
  w.dispose(); ok(!w.sheet.parent && !w.trail.parent, 'dispose takes both away') }

// her glb: 14 bones, flippers only, and in EVERY clip no flipper vertex under the sheet's top (0.03 x 0.45) nor the plastron off it
{ const f = 'docs/looks/m202-tidemere-glide-2026-11-28/tidemere-metrics.json', M = JSON.parse(fs.readFileSync(f, 'utf8'))
  ok(M.bones === 14 && !M.bone_names.some((n: string) => /leg|foot|paw/.test(n)), `rig: 14 bones, no leg / foot / paw (${M.bone_names.join(' ')})`)
  for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) {
    ok(M[c].fin_low_min > SHEET_CLEAR * 0.45 + 0.005, `${c}: her flippers stay over her water (lowest ${M[c].fin_low_min} > sheet ${(SHEET_CLEAR * 0.45).toFixed(4)} glb units)`)
    ok(M[c].body_low_min > 0.01 && M[c].body_low_max < 0.045, `${c}: her plastron rides her sheet (${M[c].body_low_min}..${M[c].body_low_max} glb units)`)
  }
  ok(fs.statSync('public' + tide.url).size === M.glb_bytes, `the shipped ${tide.url} is that rig (${M.glb_bytes} bytes)`) }

console.log(`spirit-water: ${pass} pass, ${fails} fail`); process.exit(fails ? 1 : 0)
