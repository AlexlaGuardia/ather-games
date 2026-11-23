// BETA M83 p1 s1b: the builder's free-fly camera (pure). Run: npx tsx src/app/shimmer/dev/editors/fly-cam.test.ts
import { stepCam, lookCam, zoomCam, toggleTop, camOver, forward, NO_KEYS, CLEAR, CEIL, PITCH_MAX, stepStrength, STRENGTH_STEPS, STRENGTH_MIN, STRENGTH_MAX, type Cam } from './fly-cam'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const flat = () => 10
const hill = (x: number) => (x > 50 ? 80 : 10)        // a cliff east of x = 50
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e

const c0: Cam = { x: 0, y: 50, z: 0, yaw: 0, pitch: -0.3, top: false }
// W goes along the view, flattened: pitch down must not dive
const w = stepCam(c0, { ...NO_KEYS, f: true }, 0.1, flat)
ok(w.z < 0 && near(w.x, 0) && near(w.y, 50), `W: forward (-z at yaw 0), level despite pitch down (z ${w.z.toFixed(2)}, y ${w.y})`)
const d = stepCam({ ...c0, yaw: Math.PI / 2 }, { ...NO_KEYS, f: true }, 0.1, flat)
ok(d.x < 0 && near(d.z, 0, 1e-9), `W at yaw 90° goes -x (three's convention) (x ${d.x.toFixed(2)})`)
const r = stepCam(c0, { ...NO_KEYS, r: true }, 0.1, flat)
ok(r.x > 0 && near(r.z, 0, 1e-9), 'D strafes right (+x at yaw 0)')
const f2 = stepCam(c0, { ...NO_KEYS, f: true, fast: true }, 0.1, flat)
ok(Math.abs(f2.z) > 3.9 * Math.abs(w.z), 'Shift = fast')
// speed scales with height: a low pass is slower than a high one
const low = stepCam({ ...c0, y: 14 }, { ...NO_KEYS, f: true }, 0.1, flat), high = stepCam({ ...c0, y: 400 }, { ...NO_KEYS, f: true }, 0.1, flat)
ok(Math.abs(high.z) > 5 * Math.abs(low.z), `speed grows with height (low ${Math.abs(low.z).toFixed(2)} m, high ${Math.abs(high.z).toFixed(2)} m per step)`)
// never under the ground: fly into the cliff
let c: Cam = { ...c0, x: 40, y: 20, yaw: -Math.PI / 2 }   // facing +x
for (let i = 0; i < 40; i++) c = stepCam(c, { ...NO_KEYS, f: true }, 0.1, hill)
ok(c.x > 50 && c.y >= 80 + CLEAR - 1e-9, `flying into a cliff lifts over it, never inside (x ${c.x.toFixed(1)}, y ${c.y.toFixed(1)})`)
ok(stepCam({ ...c0, y: 12 }, { ...NO_KEYS, down: true }, 5, flat).y === 10 + CLEAR, 'C cannot sink below ground + clearance')
ok(stepCam({ ...c0, y: CEIL - 1 }, { ...NO_KEYS, up: true, fast: true }, 5, flat).y === CEIL, 'Space stops at the ceiling')
// look
const l = lookCam(c0, 100, 1e6)
ok(near(l.pitch, -PITCH_MAX) && l.yaw < 0, 'right-drag: yaw follows the mouse, pitch clamped')
// zoom
const zi = zoomCam(c0, -500, flat)
const [fx, fy, fz] = forward(c0)
ok(zi.y < c0.y && zi.z < c0.z && near((zi.x - c0.x) * fy, (zi.y - c0.y) * fx) && near((zi.z - c0.z) * fy, (zi.y - c0.y) * fz, 1e-6), 'wheel in: dolly along the view ray')
ok(zoomCam(c0, -1e7, flat).y === 10 + CLEAR, 'a huge wheel-in stops at the ground')
// top-down
const t = toggleTop(c0, flat)
ok(t.top && near(t.pitch, -Math.PI / 2) && t.y >= 160 && t.x === 0 && t.z === 0, `T: straight down over the same spot, >= 150 m up (y ${t.y})`)
ok(lookCam(t, 300, 300) === t, 'TOP ignores look')
const tp = stepCam(t, { ...NO_KEYS, f: true, r: true }, 0.1, flat)
ok(tp.z < t.z && tp.x > t.x && tp.y === t.y, 'TOP: W pans north (-z), D east, height kept')
const tz = zoomCam(t, 500, flat)
ok(tz.y > t.y && tz.x === t.x && tz.z === t.z, 'TOP: wheel out = higher, same spot')
const back = toggleTop(tp, flat)
ok(!back.top && near(back.y, c0.y) && near(back.pitch, c0.pitch) && back.x === tp.x, 'T again: back to the fly height + pitch you left, at the panned spot')
// start pose
const s = camOver(100, 200, flat)
ok(s.z > 200 && s.y > 10 && s.pitch < 0 && !s.top, 'start: south of the point, raised, looking down at it')

// M83: the strength ladder (Fly's - / = hotkeys)
ok(STRENGTH_STEPS[0] === STRENGTH_MIN && STRENGTH_STEPS[STRENGTH_STEPS.length - 1] === STRENGTH_MAX && STRENGTH_STEPS.every((v, i) => i === 0 || v > STRENGTH_STEPS[i - 1]), 'strength ladder: min..max, rising')
ok(STRENGTH_MIN * 10 >= 1, `strength min ${STRENGTH_MIN}: at least 1 dm per tick, so the rounded edit moves`)
ok(STRENGTH_MAX >= 3, `strength max ${STRENGTH_MAX} m/tick (60 m/s held: the +-60 m clamp in ~1 s)`)
ok(stepStrength(0.2, 1) === 0.35 && stepStrength(0.2, -1) === 0.1, 'step up / down from a rung')
ok(stepStrength(0.24, 1) === 0.35 && stepStrength(0.24, -1) === 0.2, 'between rungs: to the neighbour in that direction (a slider value)')
ok(stepStrength(STRENGTH_MAX, 1) === STRENGTH_MAX && stepStrength(STRENGTH_MIN, -1) === STRENGTH_MIN, 'clamped at both ends')
let s9 = STRENGTH_MIN; for (let i = 0; i < 20; i++) s9 = stepStrength(s9, 1); ok(s9 === STRENGTH_MAX, 'twenty ups reach the top')

console.log(fails ? `\n${fails} FAILED` : '\nall pass')
process.exit(fails ? 1 : 0)
