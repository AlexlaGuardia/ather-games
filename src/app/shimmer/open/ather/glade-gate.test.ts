// BETA M165 s1: the Glade's grown gate + the Moonwell's rim. npx tsx src/app/shimmer/open/ather/glade-gate.test.ts
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import * as THREE from 'three'
import { isValidElement, type ReactElement } from 'react'
import { FoldGate } from './plot-scene'
import { GATE, GATE_FACE, GROUND_Y, STARTING_SQUARES, plotShape } from './plot'
import { GLADE_GATE } from './glade-cluster'
import { APEX, GATE_BASE, LIGHT, OPEN, PLINTH, gladeGateFigure, limb } from './glade-gate-figure'
import { gladeLayerGround, parseGladeLayer } from './glade-layer'
import { MOONWELL, shoreRadius } from './moonwell'
import { POOL_SEGS, POOL_Y, SHEET_RINGS, poolEdge, poolSheet } from './moonwell-water'
import { GLOW_H, RIM_TOP, poolGlow, poolRim, sheetColors } from './moonwell-rim'
let n = 0, fails = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log('✗', m) } }
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e

// ── every other gate is what it was (Alex 11-25: the Glade's ONLY) ──
// the tree of elements the gate of a keeper's cluster draws, as plain data, against the look that shipped before M165
const flat = (e: unknown): unknown => Array.isArray(e) ? e.map(flat) : !isValidElement(e) ? e : (() => { const { children, ...p } = (e as ReactElement<Record<string, unknown>>).props; return [String((e as ReactElement).type), p, children === undefined ? [] : [children].flat().map(flat)] })()
const want = ['group', { position: [GATE.x, GROUND_Y - 0.4, GATE.z], 'rotation-y': GATE_FACE, userData: { foldGate: true } }, [
  ['mesh', { 'position-y': 0.375 }, [['cylinderGeometry', { args: [1.6, 1.8, 0.75, 12] }, []], ['meshLambertMaterial', { color: '#b9ab90', flatShading: true }, []]]],
  ['mesh', { 'position-y': 3.4 }, [['torusGeometry', { args: [2.3, 0.22, 6, 24] }, []], ['meshLambertMaterial', { color: '#e7c766', emissive: '#c79a2e', emissiveIntensity: 0.6, flatShading: true }, []]]],
  ['mesh', { 'position-y': 3.4 }, [['circleGeometry', { args: [2.1, 24] }, []], ['meshBasicMaterial', { color: '#f4e3b0', transparent: true, opacity: 0.35, side: THREE.DoubleSide }, []]]],
  ['pointLight', { 'position-y': 3.4, color: '#f2d88a', intensity: 6, distance: 18 }, []],
]]
ok(JSON.stringify(flat(FoldGate())) === JSON.stringify(want), 'a keeper\'s own gate is the gold ring, number for number: ' + JSON.stringify(flat(FoldGate())).slice(0, 400))
const src = join(__dirname, '..', '..'), files: string[] = []
const walk = (d: string) => readdirSync(d).forEach(f => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) files.push(p) }); walk(src)
const text = new Map(files.map(f => [f, readFileSync(f, 'utf8')])), at = (name: string) => [...text].find(([f]) => f.endsWith('/open/ather/' + name))![1]
const off = [...text].flatMap(([f, t]) => t.split('\n').filter(l => /gate=\{/.test(l) && /<(PlotScene|PlotIsland|ClusterScene)\b/.test(l)).map(l => [f.split('/').pop()!, l.trim()]))
ok(off.filter(([f]) => f === 'page.tsx').length === 1 && off.filter(([f]) => f === 'page.tsx').every(([, l]) => l.startsWith("{zone.kind === 'glade' &&")), 'the page turns the gold ring off in the glade zone and nowhere else')
ok(off.some(([f, l]) => f === 'page.tsx' && l.split('gate={false}').length === 3), 'there on the keeper\'s island AND the friends\' three')
ok(off.filter(([f]) => f !== 'page.tsx').every(([f, l]) => (f === 'plot-scene.tsx' || f === 'cluster-scene.tsx') && l.includes('gate={gate}')) && off.length === 3, `the rest pass it on: ${JSON.stringify(off)}`)
for (const [f, c] of [['plot-scene.tsx', 2], ['cluster-scene.tsx', 1]] as const) ok(at(f).split('gate = true').length - 1 === c, `${f}: the gold ring is the default`)
ok(at('plot-scene.tsx').includes('{gate && <FoldGate />}'), 'an island draws its ring unless told not to')
ok([...text].filter(([, t]) => /<GladeGate\b/.test(t)).map(([f]) => f.split('/').pop()).join() === 'glade-cluster-view.tsx', 'the grown gate is mounted by the Glade alone')
ok([...text].filter(([, t]) => /<GladeCluster\b/.test(t)).every(([f, t]) => f.endsWith('page.tsx') && t.split('\n').filter(l => /<GladeCluster\b/.test(l)).every(l => l.trim().startsWith("{zone.kind === 'glade' &&"))), 'and the Glade\'s folk only in the glade zone')

// ── it stands where the gate stood, and the walker's box is untouched ──
ok(GLADE_GATE === GATE && GATE.x === -212 && GATE.z === 212, 'the gate has not moved')
const box = plotShape(new Set(STARTING_SQUARES)).solids(GATE.x, 0, GATE.z, GATE.x, 9, GATE.z).filter(b => b.y1 < 5)
// (the box's y is -Infinity: the island has no ground at the Green, so nobody has ever bumped the gate's stone; left as it is, M165 is looks only)
ok(box.length === 1 && near(box[0].x1 - box[0].x0, 3.2) && near(box[0].z1 - box[0].z0, 3.2) && box[0].y1 === -Infinity, 'its box is the old box')
ok(near(GATE_BASE, 0.4) && PLINTH.top === 1.6 && PLINTH.foot === 1.8 && PLINTH.h - GATE_BASE > 0.1 && PLINTH.h - GATE_BASE < 0.25, 'the plinth keeps the old stone\'s footprint, a low slab a keeper who walks over it barely sinks in')
const F = gladeGateFigure(), P = F.toon.attributes.position
let inWay = 0, left = 0, right = 0, top = 0, low = 9, over = 0
for (let k = 0; k < P.count; k++) {
  const x = P.getX(k), y = P.getY(k), z = P.getZ(k); top = Math.max(top, y); low = Math.min(low, y)
  if (y > PLINTH.h + 0.2 && y < 3.6 && Math.abs(x) < OPEN / 2) { inWay++; if (process.argv.includes('-v')) console.log(x, y, z) }
  if (Math.abs(x) < 0.4 && y > APEX - 0.1 && y < 6.4) over++
  if (y > 1 && y < 4 && x > 1.5) right++; if (y > 1 && y < 4 && x < -1.5) left++
  void z
}
ok(inWay === 0, `nothing stands in the opening (${inWay})`)
ok(left > 200 && right > 200 && over > 60, `two trunks (${left} / ${right}) that meet over the middle (${over})`)
ok(low > -0.4 && top > 7 && top < 9, `it stands on its foot and is ${top.toFixed(1)} m tall`)
// a limb's faces look out (inside out, only its ink is seen: the first look was two black trees)
for (const sx of [1, -1]) { const g = limb([[2 * sx, 0, 0], [2.1 * sx, 2, 0.2], [1.2 * sx, 4, 0], [-1 * sx, 4.4, 0]], [0.4, 0.3, 0.2, 0.05]), p = g.attributes.position, N = g.attributes.normal, ix = g.index!.array; let bad = 0
  for (let k = 0; k < ix.length; k += 3) { const [a, b, c] = [0, 1, 2].map(i => new THREE.Vector3().fromBufferAttribute(p, ix[k + i])); if (b.sub(a).cross(c.sub(a)).dot([0, 1, 2].reduce((v, i) => v.add(new THREE.Vector3().fromBufferAttribute(N, ix[k + i])), new THREE.Vector3())) <= 0) bad++ }
  ok(bad === 0, `limb ${sx}: faces out (${bad})`) }
const Q = F.light.attributes.position; let far = 0; for (let k = 0; k < Q.count; k++) far = Math.max(far, Math.hypot(Q.getX(k), Q.getY(k)))
ok(far <= LIGHT.r + 1e-4 && LIGHT.y + LIGHT.r < APEX && F.light.attributes.color.itemSize === 4, 'the light fills the arch, clear of its top')
const spun: number[] = []; for (let k = 0; k < Q.count; k++) if (Math.abs(Math.abs(Q.getZ(k)) - 0.02) < 1e-6) spun.push(Math.hypot(Q.getX(k), Q.getY(k)))
ok(spun.length > 400 && Math.max(...spun) > 1.4 && Math.min(...spun) < 0.1, 'the spiral runs from the middle out')
ok((F.toon.index!.count + F.ink.index!.count + F.light.index!.count) / 3 < 24000, `phone-safe: ${((F.toon.index!.count + F.ink.index!.count + F.light.index!.count) / 3).toFixed(0)} triangles`)

// ── the rim: on Alex's live ground (v16) and on a made-up rough one ──
const live = gladeLayerGround(parseGladeLayer(JSON.parse(readFileSync(join(src, 'world', 'glade-edits.json'), 'utf8'))).edits)
const rough = (x: number, z: number) => live(x, z) + Math.sin(x * 0.4) * 0.6 + Math.cos(z * 0.3) * 0.5
for (const [name, g] of [['v16', live], ['rough', rough]] as const) {
  const R = poolRim(g), e = poolEdge(g), hs = R.tops.map(q => q.h - g(q.x, q.z))
  ok(R.stones > 80 && R.stones < 160, `${name}: a ring of ${R.stones} stones`)
  ok(hs.every(h => h > 0.14 && h <= RIM_TOP), `${name}: every top ${Math.min(...hs).toFixed(3)}..${Math.max(...hs).toFixed(3)} m over its own ground`)
  // all the way round: no bearing without a stone within a stone's length
  const a = R.tops.map(q => Math.atan2(q.z - MOONWELL.z, q.x - MOONWELL.x)).sort((p, q) => p - q); let gap = a[0] + Math.PI * 2 - a[a.length - 1]; for (let k = 1; k < a.length; k++) gap = Math.max(gap, a[k] - a[k - 1])
  ok(gap < 0.06, `${name}: no hole in the rim (${(gap * 22).toFixed(2)} m)`)
  // at the water's edge, inside lip over the water, the rest on the bank
  const out = R.tops.map(q => { const t = ((Math.atan2(q.z - MOONWELL.z, q.x - MOONWELL.x) / (Math.PI * 2)) * POOL_SEGS + POOL_SEGS) % POOL_SEGS, k = Math.floor(t); return Math.hypot(q.x - MOONWELL.x, q.z - MOONWELL.z) - (e[k].r * (1 - (t - k)) + e[(k + 1) % POOL_SEGS].r * (t - k)) })
  ok(Math.min(...out) > -0.35 && Math.min(...out) < -0.02 && Math.max(...out) < 1.0, `${name}: the stones sit on the edge (${Math.min(...out).toFixed(2)}..${Math.max(...out).toFixed(2)} m)`)
  // faces out: the tops' triangles look up
  const T = R.pos; let up = 0, down = 0
  for (let k = 0; k < T.length; k += 9) { const u = [T[k + 3] - T[k], T[k + 5] - T[k + 2]], v = [T[k + 6] - T[k], T[k + 8] - T[k + 2]], ny = u[1] * v[0] - u[0] * v[1], a2 = Math.abs(ny); if (a2 < 0.2) continue; if (ny > 0) up++; else down++ }
  ok(up > 300 && down === 0, `${name}: the stones' tops face up (${up} / ${down})`)
  // every face of every stone looks out of it (28 triangles a stone)
  let inward = 0; for (let b = 0; b < T.length; b += 28 * 9) { const c = [0, 0, 0]; for (let k = 0; k < 28 * 3; k++) for (let i = 0; i < 3; i++) c[i] += T[b + k * 3 + i] / 84
    for (let t = 0; t < 28; t++) { const o = b + t * 9, A = new THREE.Vector3(T[o], T[o + 1], T[o + 2]), B = new THREE.Vector3(T[o + 3], T[o + 4], T[o + 5]), D = new THREE.Vector3(T[o + 6], T[o + 7], T[o + 8]), N = B.clone().sub(A).cross(D.clone().sub(A)); if (N.lengthSq() > 1e-8 && N.normalize().dot(A.clone().add(B).add(D).multiplyScalar(1 / 3).sub(new THREE.Vector3(...c))) < -0.02) inward++ } }
  ok(inward === 0, `${name}: every face looks out (${inward})`)
  ok(R.ink.length === R.pos.length && R.col.length === R.pos.length && R.pos.every(Number.isFinite), `${name}: one ink hull, all finite`)
}
{ const R = poolRim(live), inTop = R.tops.filter(q => Math.hypot(q.x - MOONWELL.x, q.z - MOONWELL.z) < shoreRadius(q.x, q.z)); ok(inTop.length > 50 && inTop.every(q => q.h > POOL_Y + 0.02), 'v16: the stones stand over the water, so the rim holds it') }
// nothing solid: no walker file knows the rim
ok([...text].filter(([, t]) => /from '.*moonwell-rim'/.test(t)).map(([f]) => f.split('/').pop()).sort().join() === 'moonwell-quest.tsx', 'only the drawing reads the rim: no box, no ground, so a keeper wades in anywhere')
// the water: the same level plane, a colour for every vertex; the glow stands on it
const S = poolSheet(live); ok(S.pos.length === sheetColors().length && S.pos.length / 3 === 1 + SHEET_RINGS.length * POOL_SEGS && S.pos.every((v, k) => k % 3 !== 1 || near(v, POOL_Y, 1e-5)), 'the sheet is level and every vertex has its colour')
{ let up = 0; for (let k = 0; k < S.idx.length; k += 3) { const [a, b, c] = [0, 1, 2].map(i => S.idx[k + i] * 3); if ((S.pos[b + 2] - S.pos[a + 2]) * (S.pos[c] - S.pos[a]) - (S.pos[b] - S.pos[a]) * (S.pos[c + 2] - S.pos[a + 2]) > 0) up++ }; ok(up === S.idx.length / 3, 'the sheet faces up') }
const G = poolGlow(live); ok(G.pos.every((v, k) => k % 3 !== 1 || (v >= POOL_Y - 1e-5 && v <= POOL_Y + GLOW_H + 1e-5)) && G.col.every((v, k) => k % 4 !== 3 || v <= 0.8), 'the glow is low and soft')
console.log(fails ? `FAIL ${fails}/${n}` : `ok ${n}`); process.exit(fails ? 1 : 0)
