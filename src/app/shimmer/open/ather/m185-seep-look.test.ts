// M185 s2b: the mana seep's LOCKED look B 'crystal tent' (Alex 11-26, Magii #17937), as geometry: ribs arch over the crack to a
// crown, legs web out over the ground; S / M / L grow in rib count and spread; never a column or a fountain (wider than tall,
// nothing below the ground, nothing much above the crown); the large one stays under a keeper's height (~1.75 m) at top scale.
// npx tsx src/app/shimmer/open/ather/m185-seep-look.test.ts
import * as THREE from 'three'
let fails = 0, passes = 0
const ok = (c: boolean, m: string) => { if (c) passes++; else { fails++; console.log('✗', m) } }
void (async () => {
const { SEEP_SIZE, seepTentGeometry, SEEP_LOOK } = await import('./crystal-nodes')
const S = ['seep_s', 'seep_m', 'seep_l'] as const
const box = (k: typeof S[number]) => { const g = seepTentGeometry(k); g.computeBoundingBox(); const b = g.boundingBox!; return { b, g } }
const bx = S.map(box)
for (let i = 0; i < 3; i++) {
  const k = S[i], { b, g } = bx[i], Z = SEEP_SIZE[k]
  const w = Math.min(b.max.x - b.min.x, b.max.z - b.min.z), h = b.max.y
  ok(b.min.y > -0.05, `${k}: nothing below the ground (${b.min.y.toFixed(3)})`)
  ok(Math.abs(h - Z.crown) < 0.15 * Z.crown + 0.06, `${k}: the crown is the top (${h.toFixed(2)} vs ${Z.crown})`)
  ok(w > 2.5 * h, `${k}: a tent, wider than tall, never a column / fountain (${w.toFixed(2)} x ${h.toFixed(2)})`)
  ok(w > 1.6 * Z.foot, `${k}: the legs web out past where the ribs meet the ground (${w.toFixed(2)} vs foot ${Z.foot})`)
  // ribs reach the ground: plenty of vertices low, out at the leg radius
  const p = g.attributes.position; let low = 0
  for (let v = 0; v < p.count; v++) if (p.getY(v) < 0.08 && Math.hypot(p.getX(v), p.getZ(v)) > Z.foot * 0.8) low++
  ok(low > Z.ribs * 20, `${k}: legs lie on the ground out past the foot (${low} low verts)`)
}
ok(SEEP_SIZE.seep_s.ribs < SEEP_SIZE.seep_m.ribs && SEEP_SIZE.seep_m.ribs < SEEP_SIZE.seep_l.ribs, 'rib count grows S < M < L')
const spread = bx.map(({ b }) => b.max.x - b.min.x)
ok(spread[0] < spread[1] && spread[1] < spread[2], `spread grows S < M < L (${spread.map(n => n.toFixed(2))})`)
ok(bx[0].b.max.y < bx[1].b.max.y && bx[1].b.max.y < bx[2].b.max.y, 'height grows S < M < L')
ok(bx[2].b.max.y * 1.3 < 1.85, `a large seep at top node scale (1.3) stays under a keeper (${(bx[2].b.max.y * 1.3).toFixed(2)} m)`)
ok(new THREE.Color(SEEP_LOOK.rib).getHSL({ h: 0, s: 0, l: 0 }).l > 0.9, 'the ribs are white crystal')
ok(new THREE.Color(SEEP_LOOK.worked).getHSL({ h: 0, s: 0, l: 0 }).l < 0.6, 'a worked seep goes dull')
console.log(`m185-seep-look: ${passes} passed, ${fails} failed`); process.exit(fails ? 1 : 0)
})()
