// BETA M208: the keeper lands on the Centre Green at the gate (plot.ts HOME_LANDING) and the Green is dressed (green-view.tsx).
// Run: npx tsx src/app/shimmer/open/ather/green.test.ts
import { readFileSync } from 'fs'
import { createLoco, tickLocomotion, type LocoInput } from '../shared/locomotion'
import { terrainWorld } from '../terrain-world'
import {
  plotShape, mistWalls, STARTING_SQUARES, HOME_LANDING, LANDING_OFF, GATE, GATE_TRUNKS, GATE_TRUNK_R, GREEN_LAMPS, CHORDSTONE,
  THRESHOLD, GROUND_Y, onGreen, GATE_FACE,
} from './plot'
import { clusterFrame, clusterGround, mateWalls, inMiddle } from './cluster'
import { CHORDSTONE_R } from './chordstone'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const input = (o: Partial<LocoInput> = {}): LocoInput => ({ mvX: 0, mvZ: 0, fwdX: 0, fwdZ: -1, rightX: 1, rightZ: 0, jumpKey: false, crouchKey: false, dt: 1 / 60, ...o })
const START = new Set<string>(STARTING_SQUARES)

// where: on the Green, at the gate, in front of its face, facing it
const solo = clusterFrame(null, [])
ok(inMiddle(solo, HOME_LANDING.x, HOME_LANDING.z), 'the landing is on the Green (alone: the solo keeper\'s own small Green)')
const d = Math.hypot(HOME_LANDING.x - GATE.x, HOME_LANDING.z - GATE.z)
ok(Math.abs(d - LANDING_OFF) < 1e-9 && d < 6, `lands ${d.toFixed(2)} m from the gate`)
const fwd = { x: -Math.sin(HOME_LANDING.yaw), z: -Math.cos(HOME_LANDING.yaw) }, toGate = { x: (GATE.x - HOME_LANDING.x) / d, z: (GATE.z - HOME_LANDING.z) / d }
ok(fwd.x * toGate.x + fwd.z * toGate.z > 0.999, 'lands FACING the gate')
const toHome = { x: THRESHOLD.x - GATE.x, z: THRESHOLD.z - GATE.z }, out = { x: HOME_LANDING.x - GATE.x, z: HOME_LANDING.z - GATE.z }
ok(toHome.x * out.x + toHome.z * out.z > 0, 'lands on the gate\'s face side, the side of this keeper\'s own garden')
const c = onGreen(3, 0); ok(Math.abs(c.x - CHORDSTONE.x) < 0.5 * 3.4 && Math.hypot(onGreen(3.4, 0).x - CHORDSTONE.x, onGreen(3.4, 0).z - CHORDSTONE.z) < 1e-9, 'onGreen(side) = the Chordstone\'s side axis (same frame as the gate group)')

// a two-keeper cluster: the guest's frame has the SAME Green at the same spot, so both land on the one Green
for (const mine of ['ne', 'sw', 'nw'] as const) {
  const f = clusterFrame(mine, [{ quarter: 'ne', name: 'host', owned: [] }, { quarter: mine, name: 'me', owned: [] }])
  ok(!!f.middle && f.middle.x === GATE.x && f.middle.z === GATE.z && inMiddle(f, HOME_LANDING.x, HOME_LANDING.z), `cluster (${mine}): the Green's centre is the gate and the landing is on it`)
}

// clear: nothing solid where a keeper lands; the trunks and lamps stay off the paths in and off the Chordstone
const shape = plotShape(START, [...mistWalls(START), ...mateWalls(solo)], (x, z) => clusterGround(solo, x, z))
ok(shape.solids(HOME_LANDING.x - 0.4, 0, HOME_LANDING.z - 0.4, HOME_LANDING.x + 0.4, 9, HOME_LANDING.z + 0.4).length === 0, 'no walker box at the landing')
ok(Math.abs(shape.ground(HOME_LANDING.x, HOME_LANDING.z) - GROUND_Y) < 0.6, `the landing stands on the Green's ground (${shape.ground(HOME_LANDING.x, HOME_LANDING.z).toFixed(2)})`)
ok(GATE_TRUNKS.every(t => Math.hypot(t.x - CHORDSTONE.x, t.z - CHORDSTONE.z) > GATE_TRUNK_R + CHORDSTONE_R), 'the trunks clear the Chordstone')
ok(GATE_TRUNKS.every(t => Math.hypot(t.x - HOME_LANDING.x, t.z - HOME_LANDING.z) > 4), 'the trunks stand clear of the landing')
ok(GREEN_LAMPS.length === 4 && GREEN_LAMPS.every(l => inMiddle(solo, l.x, l.z)), 'four lamps, all on the Green')
ok(GREEN_LAMPS.every(l => { const a = Math.atan2(l.z - GATE.z, l.x - GATE.x) - GATE_FACE; const m = ((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2); return Math.abs(m - Math.PI / 4) < 1e-6 }), 'the lamps stand between the four paths (diagonal to the gate\'s axes)')
ok(shape.solids(GATE_TRUNKS[0].x - 0.1, 0, GATE_TRUNKS[0].z - 0.1, GATE_TRUNKS[0].x + 0.1, 9, GATE_TRUNKS[0].z + 0.1).length > 0, 'a trunk is solid to the walker')

// a keeper who lands can walk home: from the landing to the start ground's threshold
{
  const world = terrainWorld(shape)
  const lc = createLoco(HOME_LANDING.x, shape.ground(HOME_LANDING.x, HOME_LANDING.z), HOME_LANDING.z)
  let best = Infinity
  for (let t = 0; t < 60 * 90; t++) {
    const dx = THRESHOLD.x - lc.px, dz = THRESHOLD.z - lc.pz, dd = Math.hypot(dx, dz); best = Math.min(best, dd)
    if (dd < 1) break
    tickLocomotion(lc, input({ mvX: dx / dd, mvZ: dz / dd, fwdX: dx / dd, fwdZ: dz / dd }), world)
  }
  ok(best < 2, `from the landing the keeper walks home to the start ground (closest ${best.toFixed(1)} m)`)
}

// the page: every arrival home is the landing, not the old start-corner threshold
const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8')
ok(/const goHome = useCallback\(\(\) => \{ if \(gardenOpen\(loadTut\(\)\)\) arrive\(\{ kind: 'plot' \}, HOME_LANDING\)/.test(page), 'goHome (travel home, death, a fall) lands at HOME_LANDING')
ok(/useState<Spawn>\(HOME_LANDING\)/.test(page) && /const pos = useRef\(\{ x: HOME_LANDING\.x/.test(page), 'loading in starts at HOME_LANDING')
ok(/if \(visitHost\) arrive\(\{ kind: 'plot' \}, HOME_LANDING\)/.test(page), 'a guest visiting lands on the host\'s Green')
ok(!/arrive\(\{ kind: 'plot' \}, THRESHOLD\)/.test(page), 'no arrival lands on THRESHOLD any more')
ok(/<GreenDressing \/>/.test(page), 'the Green is dressed on the plot')

console.log(fails ? `\n${fails} FAILED` : '\nall pass')
process.exit(fails ? 1 : 0)
