import { gaitOf, smoothSpeed, type Gait } from './mate-gait'
let f = 0; const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) f++ }
/** the page's own loop: 12 Hz targets, eased at LERP 10, 60 fps; returns the gait each frame */
const run = (speed: number, walkS: number, restS: number, fps = 60) => {
  let x = 0, tx = 0, sp = 0, g: Gait = 'idle', next = 0; const out: Gait[] = [], dt = 1 / fps
  for (let t = 0; t < walkS + restS; t += dt) {
    if (t >= next && t < walkS) { tx = speed * t; next = t + 1 / 12 }
    const was = x; x += (tx - x) * (1 - Math.exp(-10 * dt)); sp = smoothSpeed(sp, Math.abs(x - was), dt); g = gaitOf(g, sp, 5.2); out.push(g)
  }
  return out
}
for (const fps of [60, 30, 8]) {
  const w = run(4.2, 3, 2, fps), n = Math.round(3 * fps)
  ok(w.slice(Math.round(fps), n).every(g => g === 'walk'), `${fps} fps: a 4.2 m/s walk reads walk throughout`)
  ok(w.slice(-Math.round(fps / 2)).every(g => g === 'idle'), `${fps} fps: idle within 1.5 s of stopping`)
  ok(w.filter((g, i) => i && g !== w[i - 1]).length === 2, `${fps} fps: one start, one stop, no flicker`)
}
ok(run(6.5, 3, 0).slice(60).every(g => g === 'run'), 'a 6.5 m/s run reads run throughout')
ok(gaitOf('walk', 200, 5.2) === 'idle', 'a teleport is not a run')
ok(gaitOf('idle', 0.3, 5.2) === 'idle' && gaitOf('walk', 0.3, 5.2) === 'walk', 'start and stop are apart')
console.log(f ? `FAIL ${f}` : 'PASS'); process.exit(f ? 1 : 0)
