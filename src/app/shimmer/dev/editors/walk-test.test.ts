// BETA M87 (World Builder p5): the WALK TEST + the COST METER, pure.
// Walk: H drops the keeper on foot at the crosshair spot over the DRAFT's ground + solid pieces; walking into a placed big rock
// stops at it; H again = Fly over the spot the keeper stands on, at Fly's old height + pitch; walking never touches the draft.
// Meter: each measure as a share of its budget, green < 70 % <= amber <= 100 % < red, the worst wins; desktop + phone budgets.
// Run: npx tsx src/app/shimmer/dev/editors/walk-test.test.ts
import { walkShape, enterWalk, stepWalk, exitWalk, walkEye, dropFeet, walkInput } from './walk-test'
import { readMeter, levelOf, smoothMs, fmtCount, DESKTOP_BUDGET, PHONE_BUDGET, BUDGETS, AMBER } from './cost-meter'
import { NO_KEYS, type Cam, type Keys } from './fly-cam'
import { sceneryBoxes, sceneryPlaced } from '../../open/ather/scenery'
import { cleanProp, type Prop } from '../../world/builder-props'
import { BODY_R } from '../../open/shared/locomotion'

let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const near = (a: number, b: number, e = 1e-3) => Math.abs(a - b) <= e

// ── the draft: gentle ground, one big solid rock at (0, -10), a small (not solid) rock at (6, 0)
const ground = (x: number, z: number) => 2 + 0.01 * x
const props: Prop[] = [cleanProp({ id: 'p1', k: 'filler:rock-large', x: 0, z: -10, q: 0, s: 1 })!, cleanProp({ id: 'p2', k: 'filler:rock-small', x: 6, z: 0, q: 0, s: 1 })!]
const draft = { props, edits: { 't': { '3,4': 12 } } }
const before = JSON.stringify(draft)
const boxes = sceneryBoxes(sceneryPlaced(draft.props, ground))
ok(boxes.length >= 1, `the big rock is a solid box (${boxes.length} boxes; the small rock is not solid)`)
const rock = boxes[0]
const shape = walkShape(ground, boxes)
const cam: Cam = { x: 0, y: 60, z: 30, yaw: 0, pitch: -0.4, top: false }

// ── enter
ok(enterWalk(cam, null, shape) === null, 'no spot under the crosshair = no walk')
ok(enterWalk(cam, { x: 0, z: 0 }, walkShape(() => -Infinity, [])) === null, 'the void (no land) = no walk')
const w = enterWalk(cam, { x: 0, z: 10 }, shape)!
ok(!!w && near(w.loco.px, 0) && near(w.loco.pz, 10), 'H drops the keeper at the crosshair spot')
ok(!!w && w.loco.py >= ground(0, 10) && w.loco.py < ground(0, 10) + 0.2, `feet on the draft's ground (${w?.loco.py.toFixed(2)} over ${ground(0, 10)})`)
ok(near(w.back.above, 60 - ground(0, 30)) && w.back.pitch === -0.4, 'Fly\'s height above the ground + pitch are kept for the way back')
ok(near(dropFeet(shape, 0, -10), rock.y1), 'a drop ON the rock stands on its top, not inside it')

// ── walk north (yaw 0 = -z) straight into the rock: the walker stops at its face
const fwd: Keys = { ...NO_KEYS, f: true }
const face = rock.z1 + BODY_R
let through = false, held = 0
for (let i = 0; i < 60 * 3.45; i++) { stepWalk(w, fwd, 0, 1 / 60); if (w.loco.pz < face - 0.05 && w.loco.py < rock.y1 - 0.1) through = true; if (Math.abs(w.loco.pz - face) < 0.05) held++ }
ok(Math.abs(w.loco.pz - face) < 0.05, `walking into the big rock stops at its face (z ${w.loco.pz.toFixed(2)}, face + body ${face.toFixed(2)})`)
ok(held >= 6, `... and stays there while W is held (${held} frames at the face)`)
ok(near(w.loco.px, 0, 0.05), 'straight on (no drift sideways)')
ok(!w.loco.airborne || w.loco.climbing, 'on the ground (or on the rock\'s face), not falling')
let top = 0
// held on, the game's own walker climbs a 1.65 m rock (its mantle): over the TOP, never through the stone
for (let i = 0; i < 60 * 3; i++) { stepWalk(w, fwd, 0, 1 / 60); top = Math.max(top, w.loco.py); if (w.loco.pz < rock.z1 - 0.3 && w.loco.pz > rock.z0 + 0.3 && w.loco.py < rock.y1 - 0.3) through = true }
ok(!through && top >= rock.y1 - 0.05, `held on, it goes OVER the top (peak feet ${top.toFixed(2)}, rock top ${rock.y1.toFixed(2)}), never through the stone (the game's mantle)`)
const e = walkEye(w); ok(e.y > w.loco.py + 1, 'the view is at eye height')

// the same walk with no rock goes past it (the stop is the rock, not the walker)
const w2 = enterWalk(cam, { x: 0, z: 10 }, walkShape(ground, []))!
for (let i = 0; i < 60 * 8; i++) stepWalk(w2, fwd, 0, 1 / 60)
ok(w2.loco.pz < rock.z0, `no rock = walks on past where it stood (z ${w2.loco.pz.toFixed(1)})`)

// ── exit: Fly over where the keeper stands, Fly's height + pitch, the walk's yaw
const turned = { ...cam, yaw: 0.3 }
const back = exitWalk(w, turned, ground)
ok(near(back.x, w.loco.px) && near(back.z, w.loco.pz), 'H again = Fly at the same spot the keeper stands on')
ok(near(back.y, ground(back.x, back.z) + w.back.above) && back.pitch === -0.4 && back.yaw === 0.3 && !back.top, 'at Fly\'s old height above the ground, its pitch, the view\'s yaw')
const fromTop = enterWalk({ ...cam, top: true, pitch: -1.5 }, { x: 0, z: 10 }, shape)!
ok(fromTop.back.pitch === -0.6, 'entered from TOP: back to an oblique Fly (not straight down)')

// ── the draft was only read
ok(JSON.stringify(draft) === before, 'walking never writes the draft (props + edits unchanged)')

// ── input
const inp = walkInput({ ...NO_KEYS, f: true, r: true }, 0, 1 / 60)
ok(near(Math.hypot(inp.mvX, inp.mvZ), 1) && inp.mvX > 0 && inp.mvZ < 0, 'diagonal input is normalised (W + D = north-east)')
ok(walkInput({ ...NO_KEYS, up: true, down: true }, 0, 0.016).jumpKey && walkInput({ ...NO_KEYS, down: true }, 0, 0.016).crouchKey, 'Space jumps, C crouches')

// ── the meter
ok(DESKTOP_BUDGET.calls === 600 && DESKTOP_BUDGET.tris === 1_500_000 && near(DESKTOP_BUDGET.ms, 16.667), 'desktop budget = 600 draws / 1.5M tris / 16.7 ms')
ok(PHONE_BUDGET.calls < DESKTOP_BUDGET.calls && PHONE_BUDGET.tris < DESKTOP_BUDGET.tris && BUDGETS.phone === PHONE_BUDGET, 'the phone budget is the tighter toggle')
ok(levelOf(0) === 'green' && levelOf(AMBER - 0.001) === 'green' && levelOf(AMBER) === 'amber' && levelOf(1) === 'amber' && levelOf(1.0001) === 'red', 'green < 70 % <= amber <= 100 % < red')
ok(levelOf(NaN) === 'green' && levelOf(-1) === 'green', 'junk reads green (no false alarm)')
const r = readMeter({ calls: 300, tris: 1_200_000, ms: 10 }, DESKTOP_BUDGET)
ok(near(r.share.calls, 0.5) && near(r.share.tris, 0.8) && near(r.share.ms, 0.6), 'shares = measure / budget')
ok(r.level.calls === 'green' && r.level.tris === 'amber' && r.worst === 'amber', 'the worst measure is the meter\'s colour (tris amber)')
ok(readMeter({ calls: 700, tris: 10, ms: 1 }, DESKTOP_BUDGET).worst === 'red', 'over the draw budget alone = red')
ok(readMeter({ calls: 120, tris: 100_000, ms: 5 }, DESKTOP_BUDGET).worst === 'green' && readMeter({ calls: 120, tris: 100_000, ms: 5 }, PHONE_BUDGET).worst === 'amber', 'the same view: green on desktop, amber on the phone budget')
ok(smoothMs(0, 20) === 20 && near(smoothMs(10, 20), 11) && smoothMs(10, NaN) === 10 && smoothMs(10, 0) === 10, 'frame time is an exponential average (one hitch nudges it)')
ok(fmtCount(1_234_567) === '1.23M' && fmtCount(45_600) === '45.6k' && fmtCount(812) === '812', 'counts read short')

console.log(fails ? `\n${fails} FAILED` : '\nall passed')
process.exit(fails ? 1 : 0)
