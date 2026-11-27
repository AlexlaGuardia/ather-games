// BETA M219 (Alex 11-26: "for my garden a stale resource.. the gate is still there under the new design"): a cluster has ONE
// Green and ONE gate. Every mate's island turns its gate corner onto the same point (plot.ts GATE), so a mate island that drew
// its own FoldGate stood extra gold rings crossways under the M208 grown arch. This renders the real scene trees (server
// markup, no GPU) and counts the gold rings: the viewer's island draws one, the cluster's mates none, for every cluster shape.
// Run: npx tsx src/app/shimmer/open/ather/one-gate.test.ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ClusterScene } from './cluster-scene'
import { PlotIsland } from './plot-scene'
import { clusterFrame, type Mate } from './cluster'
import { toWorld } from './meadow'
import { GATE, STARTING_SQUARES } from './plot'
import type { Quarter } from './cluster'
let n = 0, fails = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log('✗', m) } }
// R3F's lower-case elements render as unknown tags here; React's casing warnings are noise for this count
const quiet = <T,>(f: () => T): T => { const e = console.error; console.error = () => {}; try { return f() } finally { console.error = e } }
// the FoldGate's ring (plot-scene.tsx FoldGate: torus 2.3 x 0.22) and its light
const rings = (html: string) => (html.match(/<torusGeometry args="2\.3,0\.22,6,24"/g) ?? []).length
const lights = (html: string) => (html.match(/<pointLight [^>]*color="#f2d88a"/g) ?? []).length
const Q: Quarter[] = ['ne', 'nw', 'sw', 'se']
const mate = (quarter: Quarter): Mate => ({ quarter, name: quarter, owned: [...STARTING_SQUARES] })

// the viewer's own island draws the one gate
const own = quiet(() => renderToStaticMarkup(createElement(PlotIsland, { owned: new Set(STARTING_SQUARES), pages: 0 })))
ok(rings(own) === 1 && lights(own) === 1, `the keeper's own island draws one gold ring + its light (${rings(own)}, ${lights(own)})`)

// every cluster shape: me in each quarter, with every subset of the other three as mates
for (const mine of Q) {
  const others = Q.filter(q => q !== mine)
  for (let mask = 0; mask < 8; mask++) {
    const mates = others.filter((_, i) => mask & (1 << i)).map(mate)
    const f = clusterFrame(mine, mates)
    // why it matters: each mate's gate corner lands on MY gate, so a mate's ring is a second ring in the same place
    for (const m of f.mates) {
      const g = toWorld(m.x, m.z, m.rot, GATE.x, GATE.z)
      ok(Math.hypot(g.x - GATE.x, g.z - GATE.z) < 1e-3, `${mine}/${m.quarter}: a mate's gate corner stands on the one gate (${g.x.toFixed(2)}, ${g.z.toFixed(2)})`)
    }
    const html = quiet(() => renderToStaticMarkup(createElement(ClusterScene, { frame: f })))
    ok(html.length > 0, `${mine} + [${mates.map(m => m.quarter)}]: the cluster scene renders`)
    ok(rings(html) === 0 && lights(html) === 0, `${mine} + [${mates.map(m => m.quarter)}]: no mate island draws a gate (${rings(html)} rings, ${lights(html)} lights)`)
    ok(rings(own) + rings(html) === 1, `${mine} + [${mates.map(m => m.quarter)}]: one gate on the Green in all`)
  }
}
console.log(fails ? `FAIL ${fails}/${n}` : `ok ${n}`); process.exit(fails ? 1 : 0)
