// quest-fade.ts. Run: npx tsx src/app/shimmer/open/shared/quest-fade.test.ts
import { fadeStep, FADE_S } from './quest-fade'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
// at 60 fps: about FADE_S to come in, with many in-between frames (a fade, not a pop)
{
  let op = 0, t = 0, mid = 0
  while (op < 1 && t < 5) { op = fadeStep(op, true, 1 / 60); t += 1 / 60; if (op > 0 && op < 1) mid++ }
  ok(Math.abs(t - FADE_S) < 1 / 30, `fade in takes ~${FADE_S} s at 60 fps (${t.toFixed(3)})`)
  ok(mid >= 15, `fade in has in-between frames (${mid})`)
  let out = 0; while (op > 0 && out < 5) { op = fadeStep(op, false, 1 / 60); out += 1 / 60 }
  ok(Math.abs(out - FADE_S) < 1 / 30, `fade out takes ~${FADE_S} s (${out.toFixed(3)})`)
}
ok(fadeStep(0, true, 1 / 60) < 0.1, 'one 60 fps frame is a small step, not a pop')
ok(fadeStep(0.5, true, 10) === 1 && fadeStep(0.5, false, 10) === 0, 'clamped to 0..1')
ok(Math.abs(fadeStep(0, true, 0.1) - fadeStep(0, true, 0.05) * 2) < 1e-12, 'frame-rate independent: two half frames = one frame')
console.log(`quest-fade: ${pass} pass, ${fails.length} fail`)
if (fails.length) { console.log(fails.join('\n')); process.exit(1) }
