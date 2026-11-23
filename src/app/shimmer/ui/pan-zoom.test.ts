// BETA M100: the map's pan + zoom view math. Run: npx tsx src/app/shimmer/ui/pan-zoom.test.ts
import { HOME, MAX_K, clampView, zoomAt, panBy, wheelFactor, toView, fromView, isHome } from './pan-zoom'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e
const W = 400, H = 300

// zoom keeps the content under the pointer under the pointer
{
  const p: [number, number] = [120, 80], before = fromView(HOME, ...p)
  const v = zoomAt(HOME, 2, ...p, W, H), after = fromView(v, ...p)
  ok(near(v.k, 2), 'zoom: x2 did not double the scale')
  ok(near(before[0], after[0]) && near(before[1], after[1]), `zoom: the point under the cursor moved (${before} -> ${after})`)
  // and a second zoom elsewhere, inside the clamp, keeps that point too
  const q: [number, number] = [300, 200], b2 = fromView(v, ...q), v2 = zoomAt(v, 1.5, ...q, W, H), a2 = fromView(v2, ...q)
  ok(near(b2[0], a2[0]) && near(b2[1], a2[1]), 'zoom: a second zoom about another point drifted')
  ok(near(toView(v2, ...a2)[0], q[0]), 'toView / fromView are not inverses')
}
// clamps: never below the whole map, never past MAX_K, never a gap at an edge
ok(isHome(zoomAt(HOME, 0.5, 200, 150, W, H)), 'clamp: zooming out of the whole map moved it')
ok(zoomAt({ k: 5, x: -100, y: -100 }, 10, 0, 0, W, H).k === MAX_K, 'clamp: zoom passed MAX_K')
{
  const v = { k: 2, x: 0, y: 0 }
  const l = panBy(v, 500, 500, W, H)
  ok(l.x === 0 && l.y === 0, 'clamp: dragged past the top-left edge')
  const r = panBy(v, -5000, -5000, W, H)
  ok(r.x === W - W * 2 && r.y === H - H * 2, `clamp: dragged past the bottom-right edge (${r.x},${r.y})`)
  ok(panBy(HOME, 50, -50, W, H).x === 0, 'clamp: at k=1 a drag moved the map')
  const m = panBy(v, -30, -20, W, H)
  ok(m.x === -30 && m.y === -20, 'pan: an in-bounds drag did not move by the drag')
}
// zooming back out to k=1 from a corner lands exactly home (the clamp pulls the translate in)
{
  let v = zoomAt(HOME, 4, 390, 290, W, H)
  v = zoomAt(v, 0.1, 10, 10, W, H)
  ok(isHome(v), `clamp: zoomed fully out off-centre and the map did not come home (${JSON.stringify(v)})`)
}
// the wheel: down zooms out, up zooms in, line mode is scaled to px
ok(wheelFactor(100) < 1 && wheelFactor(-100) > 1, 'wheel: direction is backwards')
ok(near(wheelFactor(3, 1), wheelFactor(99)), 'wheel: line-mode deltas not scaled')

console.log(`pan-zoom: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
