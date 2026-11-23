// The keeper's proportions (BETA M103). Run: npx tsx src/app/shimmer/open/shared/keeper-proportions.test.ts
import * as THREE from 'three'
import { DIALS, DEFAULT_PROPORTIONS, MODELS, modelId, parseProportions, parseFile, changedOnly, proportionsFor, type Proportions } from './keeper-proportions'
import { buildKeeper } from './keeper-figure'
import { DEFAULT_LOOK, type Look } from './keeper-look'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) < e

// the 6 models
ok(MODELS.length === 6 && new Set(MODELS).size === 6, 'models: not 6 distinct (3 frames x 2 torsos)')
ok(modelId({ frame: 0, torso: 1 }) === 'small-curved' && modelId({ frame: 2, torso: 0 }) === 'large-broad', 'modelId: wrong mapping')
ok(modelId({ frame: 9, torso: -1 }) === 'medium-broad', 'modelId: out-of-range look did not fall back to medium-broad')
// dials: defaults inside their range, keys unique
ok(new Set(DIALS.map(d => d.key)).size === DIALS.length, 'dials: duplicate key')
ok(DIALS.every(d => d.min < d.max && d.def >= d.min && d.def <= d.max), 'dials: a default outside its range')
ok(DIALS.every(d => d.kind === 'size' || d.kind === 'spacing'), 'dials: unknown kind')

// parse: clamps, drops junk, never throws
const p = parseProportions({ headW: 99, torsoL: 'x', neck: 0.1, bogus: 3, hand: NaN })
ok(p.headW === 1.4 && p.torsoL === 1 && p.neck === 0.1 && p.hand === 1 && !('bogus' in p), 'parse: clamp / junk handling wrong')
ok(JSON.stringify(parseProportions(null)) === JSON.stringify(DEFAULT_PROPORTIONS), 'parse: null is not the defaults')
const f = parseFile({ 'small-broad': { jaw: 0.5 }, nope: { jaw: 1 } })
ok(Object.keys(f).length === 6 && f['small-broad'].jaw === 0.5 && f['large-curved'].jaw === 0 && !('nope' in f), 'parseFile: models wrong')
ok(Object.keys(parseFile('garbage')).length === 6, 'parseFile: junk file threw or lost models')
// round trip: what the route stores (changedOnly) parses back to the same dials
const moved: Proportions = { ...DEFAULT_PROPORTIONS, headW: 0.85, legs: 1.3, handY: -0.05 }
const stored = changedOnly(moved)
ok(Object.keys(stored).length === 3 && JSON.stringify(parseProportions(JSON.parse(JSON.stringify(stored)))) === JSON.stringify(moved), 'round trip: changedOnly -> parse lost or added a dial')
ok(Object.keys(changedOnly(DEFAULT_PROPORTIONS)).length === 0, 'changedOnly: defaults stored something')

// ★ defaults = today's body. The formulas below are the pre-M103 buildKeeper, written out; every model, both hands + feet + head.
for (let frame = 0; frame < 3; frame++) for (let torso = 0; torso < 2; torso++) {
  const look: Look = { ...DEFAULT_LOOK, frame, torso }
  const k = buildKeeper(look, DEFAULT_PROPORTIONS)
  const wide = [0.88, 1, 1.16][frame], tall = [0.9, 1, 1.1][frame]
  const base = 0.55 * tall * 0.62, TB = 0.62 * tall * 1.08, Hf = 0.5 * 1.15, hy = base + TB + Hf * 0.5 + 0.07
  const at = (n: string) => k.group.getObjectByName(n)!.position
  const id = modelId(look)
  ok(near(k.headY, hy) && near(k.height, hy + Hf * 0.6), `${id}: head moved at defaults`)
  ok(near(at('hand-l').x, 0.29 * wide + 0.09) && near(at('hand-l').y, base + TB * 0.32) && near(at('hand-l').z, 0.03), `${id}: hand moved at defaults`)
  ok(near(at('foot-r').x, -0.17 * wide) && near(at('foot-r').y, 0.045), `${id}: foot moved at defaults`)
  ok(at('head').equals(new THREE.Vector3(0, hy, 0)) && k.group.getObjectByName('head')!.scale.equals(new THREE.Vector3(1, 1, 1)), `${id}: head scaled at defaults`)
}

// every dial MOVES something: build at the dial's max (or min if def is max) and compare a dump of the figure
const dump = (k: ReturnType<typeof buildKeeper>) => {
  const out: string[] = []; k.group.updateMatrixWorld(true)
  k.group.traverse(o => { const m = o as THREE.Mesh; out.push(o.matrixWorld.elements.map(v => v.toFixed(5)).join(',') + (m.geometry ? m.geometry.attributes.position.count + ':' + (Array.from(m.geometry.attributes.position.array as Float32Array).reduce((t, v, i) => t + v * ((i % 7) + 1), 0)).toFixed(4) : '')) })
  return out.join('|')
}
const look: Look = { ...DEFAULT_LOOK, eyes: 2, ears: 1 }   // Round eyes (whites + pupils), Pointed ears
const at0 = dump(buildKeeper(look, DEFAULT_PROPORTIONS))
for (const d of DIALS) {
  const v = d.def === d.max ? d.min : d.max
  ok(dump(buildKeeper(look, { ...DEFAULT_PROPORTIONS, [d.key]: v })) !== at0, `dial ${d.key}: moving it changed nothing on the figure`)
}
// feet stay on the ground at any foot size; the head rides the torso + neck gap
const big = buildKeeper(look, { ...DEFAULT_PROPORTIONS, foot: 1.8 }), fl = big.group.getObjectByName('foot-l')!
ok(near(fl.position.y, 0.045 * 1.8), 'foot: a bigger foot sank into / floated off the ground')
const tall = buildKeeper(look, { ...DEFAULT_PROPORTIONS, torsoL: 1.5, neck: 0.1 }), base0 = buildKeeper(look, DEFAULT_PROPORTIONS)
ok(tall.headY > base0.headY + 0.1, 'head: did not ride up on a longer torso + neck gap')
// the shipped file parses for every look
ok(MODELS.every((_, i) => proportionsFor({ frame: Math.floor(i / 2), torso: i % 2 }) !== undefined), 'proportionsFor: a model had no proportions')

console.log(`keeper-proportions: ${pass} passed, ${fails.length} failed`)
for (const m of fails) console.log('  FAIL', m)
process.exit(fails.length ? 1 : 0)
