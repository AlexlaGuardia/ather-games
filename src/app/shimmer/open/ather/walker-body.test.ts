// ather/walker-body.ts (BETA M163 s1): the Walker's locked look, what a round hits on it, the wind-up's outline, and that the
// other bodies (Pooler, Flit) and the fight numbers were left alone.
import * as THREE from 'three'
import { createHash } from 'node:crypto'
import { walkerGeometry, walkerField, makeWalker, poseWalker, WALKER_HEAD, WALKER_CORE, BONES } from './walker-body'
import { HEAD_Y, HEAD_R, BODY_Y, BODY_R, LEG_Y, LEG_R, BODY_FIT, SHAMBLER, CRAWLER, newCombat, spawnHollow, stepCombat, type Terrain } from './combat'
import { sprout, poseSprout } from './hollow-body'
import { flitMats, poseFlit } from './flit-body'
import { goopMaterial, sharedGoop, releaseGroundEnvs, wetEnv, wetLife, DRAIN } from './hollow-goop'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const G = walkerGeometry(), P = G.attributes.position, tris = G.index!.count / 3
const rest = { t: 0, tell: 0, fall: 0, walk: 0, knock: 0 }
const W = makeWalker(goopMaterial())
const posed = (p: Partial<typeof rest> = {}) => { poseWalker(W.bones, { ...rest, ...p }); W.mesh.updateMatrixWorld(true); W.mesh.skeleton.update(); const out: THREE.Vector3[] = []; for (let i = 0; i < P.count; i++) out.push(W.mesh.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(P, i))); return out }
const box = (v: THREE.Vector3[]) => new THREE.Box3().setFromPoints(v)
const R = posed(), B = box(R), S = B.getSize(new THREE.Vector3())

// ── the skin ──
ok(tris > 1500 && tris <= 4576, `${tris} triangles in one draw (the 13 lumps were 4576)`)
ok(walkerGeometry() === G, 'one skin shared by every Walker')
{ const c = new Map<string, number>(), I = G.index!.array; let drip = 0; for (let i = 0; i < I.length; i += 3) for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) { const p = I[i + a], q = I[i + b], k = p < q ? `${p},${q}` : `${q},${p}`; c.set(k, (c.get(k) ?? 0) + 1) }
  for (const n of c.values()) if (n !== 2) drip++; ok(drip <= 7 * 6 * 2 + 7 * 10 + 20, `a closed skin (${drip} open edges, the drips' seams and tops only)`) }
{ let out = 0; const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), I = G.index!.array
  for (let i = 0; i < I.length; i += 3) { a.fromBufferAttribute(P, I[i]); b.fromBufferAttribute(P, I[i + 1]); c.fromBufferAttribute(P, I[i + 2]); n.fromBufferAttribute(G.attributes.normal, I[i]); if (b.sub(a).cross(c.sub(a)).dot(n) < 0) out++ }
  ok(out < tris * 0.02, `it faces out (${out} of ${tris} turned in)`) }
ok(W.mesh.skeleton.bones.length === BONES.length, 'eight bones')
// ── the locked shape, off the field ──
const wide = (y: number, z = 0) => { let x = 0; for (let k = 0; k < 0.7; k += 0.005) if (walkerField(k, y, z) < 0) x = k; return x * 2 }
const arms = (y: number) => { let gap = 0; for (let k = 0.1; k < 0.45; k += 0.005) if (walkerField(k, y, 0.02) > 0) gap++; return gap }
ok(B.max.y > 1.7 && B.max.y < 1.82, `stands ${B.max.y.toFixed(2)} m (the sim's height ${SHAMBLER.height})`)
ok(B.min.y > -0.06 && B.min.y < 0.05, `feet on the ground (${B.min.y.toFixed(2)})`)
ok(wide(1.25) > wide(1.6, 0.07) * 1.8, `shoulders far wider than the dome (${wide(1.25).toFixed(2)} / ${wide(1.6, 0.07).toFixed(2)})`)
ok(wide(1.42, 0.0) > 0.28 && wide(1.36, 0) >= wide(1.46, 0.02), 'no neck: the dome runs out into the shoulders')
ok(arms(0.9) > 12 && arms(0.7) > 5, 'the arms hang clear of a slim body')
ok(wide(0.1, 0.02) > wide(0.42, 0.02) * 1.3, `heavy at the heel (${wide(0.1, 0.02).toFixed(2)} at the foot, ${wide(0.42, 0.02).toFixed(2)} at the knee)`)
ok(walkerField(0.185, 0.06, -0.17) < 0 && walkerField(0, 0.3, 0) > 0, 'a heel behind the shin; daylight between the legs')
ok([0.45, 0.41].every(y => walkerField(0.375, y, 0) > -0.02), 'the arm runs out to one point, no fingers')
for (const sd of [-1, 1]) { let low = 9; for (let i = 0; i < P.count; i++) if (P.getX(i) * sd > 0.33 && P.getY(i) > 0.27) low = Math.min(low, P.getY(i)); ok(low < 0.4, `a drip hangs under each arm (${low.toFixed(2)})`) }
// ── the surface ──
{ const m = goopMaterial(), c = m.color.getHex(THREE.SRGBColorSpace), r = c >> 16, g = (c >> 8) & 255, b = c & 255
  ok(Math.max(r, g, b) <= 0x18 && Math.max(r, g, b) - Math.min(r, g, b) <= 4, `near-black, no hue (${c.toString(16)})`); ok(m.emissive.getHex() === 0 && !m.emissiveMap, 'no glow'); ok(m.roughness < 0.3, 'wet')
  const a = sharedGoop('#9cc46a', false, 'skin'); ok(a === sharedGoop('#9cc46a', false, 'skin') && a !== sharedGoop('#9cc46a', false), 'one skin material per ground, apart from the instanced ones'); releaseGroundEnvs() }
{ const px = (hex: string) => { const d = wetEnv(hex).image.data as unknown as Uint16Array, o: number[][] = []; for (let i = 0; i < d.length; i += 4) o.push([0, 1, 2].map(k => THREE.DataUtils.fromHalfFloat(d[i + k]))); return o.sort((a, b) => b[1] - a[1]) }
  const g = px('#9cc46a'), r = px('#c49a6a'), d = px(DRAIN), mid = g[g.length >> 1]
  ok(g[0][1] > g[0][0] && g[0][1] > g[0][2] && r[0][0] > r[0][1], 'the highlight is the colour of the ground it stands on'); ok(g[0][1] > 3 && mid[1] < 0.5, `bright in spots, dark all round (${g[0][1].toFixed(2)} / ${mid[1].toFixed(2)})`)
  ok(d[0][1] < g[0][1] * 0.25 && wetLife(DRAIN) < 0.2, `drained ground gives it almost none (${d[0][1].toFixed(2)})`); ok(releaseGroundEnvs() >= 3, 'freed when the Wilds are left') }
// ── what a round hits ──
ok(WALKER_HEAD === HEAD_Y && WALKER_CORE > BODY_Y * 0.7 && WALKER_CORE < BODY_Y * 1.6, 'the dome is built on HEAD_Y, the seed is in the chest')
// seen from the front AND from the side: a round down either line meets the sphere
const inS = (v: THREE.Vector3, y: number, r: number) => Math.hypot(v.x, v.y - y) < r && Math.hypot(v.z, v.y - y) < r, bodyR = BODY_R * Math.sqrt(BODY_FIT)
{ const head = R.filter(v => v.y > 1.46), hit = head.filter(v => inS(v, HEAD_Y, HEAD_R)); ok(hit.length === head.length, `every point of the dome is a head hit (${hit.length} of ${head.length})`)
  const legs = R.filter(v => v.y < 0.4 && Math.abs(v.x) < 0.36), lh = legs.filter(v => inS(v, BODY_Y, bodyR) || inS(v, LEG_Y, LEG_R)); ok(lh.length > legs.length * 0.82, `the heavy legs hit (${lh.length} of ${legs.length})`)
  for (const v of R) if (process.argv.includes('-v') && !(inS(v, HEAD_Y, HEAD_R) || inS(v, BODY_Y, bodyR) || inS(v, LEG_Y, LEG_R))) console.log(v.x.toFixed(2), v.y.toFixed(2), v.z.toFixed(2))
  const all = R.filter(v => inS(v, HEAD_Y, HEAD_R) || inS(v, BODY_Y, bodyR) || inS(v, LEG_Y, LEG_R)); ok(all.length > R.length * 0.87, `the whole skin hits (${all.length} of ${R.length})`) }
const flat: Terrain = { heightAt: () => 0, walkable: () => true }
const shot = (x: number, y: number) => { const c = newCombat(); c.hollows.length = 0; const h = spawnHollow(c, flat, 0, 0, 'shambler'); Object.assign(h, { state: 'recover', t: 99, hp: 999 }); c.rounds.push({ x, y, z: 1.5, vx: 0, vy: 0, vz: -120, life: 0.06, dmg: 5, crit: 8 }); for (let i = 0; i < 3; i++) stepCombat(c, flat, { x: 60, y: 0, z: 60 }, 1 / 60); return 999 - h.hp }
ok(shot(0, 1.6) === 8, `the dome takes a head hit (${shot(0, 1.6)})`); ok(shot(0, 1.0) === 5, 'the chest a body hit'); ok(shot(0.4, 0.75) === 5, 'the sack arm a body hit')
ok(shot(0.22, 0.12) === 5, 'a heel hits (it did not before M163)'); ok(shot(0.7, 1) === 0, 'past the arm misses'); ok(shot(0.4, 1.5) === 0, 'over the shoulder, beside the dome, misses'); ok(shot(0.55, 0.1) === 0, 'beside the foot misses')
// ── the motion reads from the outline, as before ──
{ const t = box(posed({ tell: 1 })), f = box(posed({ fall: 1 })), k = box(posed({ knock: 1 })), w = posed({ walk: 1, t: 0.28 }), sz = t.getSize(new THREE.Vector3())
  ok(t.max.y > B.max.y + 0.15, `the tell RISES (${B.max.y.toFixed(2)} -> ${t.max.y.toFixed(2)})`); ok(sz.x < S.x * 0.85, `the tell GATHERS in (${S.x.toFixed(2)} -> ${sz.x.toFixed(2)})`)
  ok(f.max.z > B.max.z + 0.9 && f.max.y < B.max.y - 0.1, `the lunge falls FORWARD (${B.max.z.toFixed(2)} -> ${f.max.z.toFixed(2)})`); ok(k.min.z < B.min.z - 0.2, 'a hit knocks it BACK')
  ok(box(w).getSize(new THREE.Vector3()).z > S.z + 0.1, 'it strides'); ok(posed({ t: 1.1 }).some((v, i) => v.distanceTo(R[i]) > 0.01), 'never a statue') }
// ── the others, untouched ──
const sha = (a: number[]) => createHash('sha1').update(a.map(v => v.toFixed(5)).join()).digest('hex').slice(0, 10)
{ const s = sprout('crawler'), o = s.lumps.map(() => new THREE.Matrix4()); poseSprout(s, { t: 1.3, tell: 0.4, fall: 0.2, walk: 0.7, knock: 0.1 }, o); const c = sha(o.flatMap(m => m.elements))
  const f = flitMats(); poseFlit({ t: 1.3, zip: 0.3, tell: 0.4, bank: 0.1, kick: 0, knock: 0.1 }, f); const d = sha(f.flatMap(m => m.elements))
  ok(c === 'ef476ec80b', `the Pooler's body is the one before M163 (${c})`); ok(d === '13cfd681a9', `the Flit's too (${d})`) }
ok([SHAMBLER.hp, SHAMBLER.damage, SHAMBLER.chaseSpeed, SHAMBLER.windup, SHAMBLER.radius, SHAMBLER.hitReach, HEAD_R, BODY_R].join() === '45,14,2.1,0.45,0.42,1.15,0.26,0.44' && CRAWLER.bodyR === 0.5, 'fight numbers untouched')
console.log(`walker-body: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
