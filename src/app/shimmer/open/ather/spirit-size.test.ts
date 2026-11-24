// Grown spirit sizes in the live 3D garden (Alex 2026-11-24 "the manalotl is way too small"; Magii RULED-AFK athernyx 2a8b028).
// Run: npx tsx src/app/shimmer/open/ather/spirit-size.test.ts
// Reads the shipped glbs, so the model's own geometry (not a copied number) decides the drawn height, length and ground keep.
import * as fs from 'fs'
import { SPIRIT_MODELS, MANALOTL_GLB_LEN, grownTrot, groundLift, lowPoints } from './spirit-models'
import { TROT } from './spirit-trot'
import { GROWN } from '../../sprites/creature-size'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.abs(b)

function glbVerts(url: string): number[] {
  const b = fs.readFileSync(`${__dirname}/../../../../../public${url}`), jl = b.readUInt32LE(12)
  const j = JSON.parse(b.subarray(20, 20 + jl).toString()), bin = b.subarray(20 + jl + 8), out: number[] = []
  for (const n of j.nodes) {
    ok(!n.translation && !n.scale && !n.rotation, `${url}: node ${n.name} has a transform (this reader assumes none)`)
    for (const p of j.meshes[n.mesh].primitives) {
      const a = j.accessors[p.attributes.POSITION], bv = j.bufferViews[a.bufferView]
      ok(a.componentType === 5126, `${url}: positions are float32`)
      const off = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0), st = bv.byteStride ?? 12
      for (let i = 0; i < a.count; i++) for (let k = 0; k < 3; k++) out.push(bin.readFloatLE(off + i * st + k * 4))
    }
  }
  return out
}
const ext = (v: number[], k: number) => { let lo = Infinity, hi = -Infinity; for (let i = k; i < v.length; i += 3) { lo = Math.min(lo, v[i]); hi = Math.max(hi, v[i]) } return [lo, hi] }

for (const sp of ['fox', 'axolotl'] as const) {
  const L = SPIRIT_MODELS[sp]!, V = glbVerts(L.url)
  const [y0, y1] = ext(V, 1), [x0, x1] = ext(V, 0), [z0, z1] = ext(V, 2)
  ok(near(y0, 0, 0) && near(y1, 1, 0.005), `${sp}: the glb is 1 unit tall, feet at 0 (${y0.toFixed(3)}..${y1.toFixed(3)})`)
  const lenU = L.sway.along === 'z' ? z1 - z0 : x1 - x0, height = L.h, len = lenU * L.h
  // ── 1. the drawn size is the GROWN row ──
  if (sp === 'fox') ok(near(height, GROWN.fox.height, 0.001), `Vulnyx draws ${height} m tall, grown is ${GROWN.fox.height}`)
  else {
    ok(near(MANALOTL_GLB_LEN, lenU, 0.01), `MANALOTL_GLB_LEN ${MANALOTL_GLB_LEN} matches the glb's nose-to-tail ${lenU.toFixed(3)}`)
    ok(near(len, GROWN.axolotl.length!, 0.02), `Manalotl draws ${len.toFixed(3)} m long, grown is ${GROWN.axolotl.length}`)
    // the length wins over the 0.35 height at this model's proportions; she is taller than canon's 0.35 and that is reported
    ok(height > GROWN.axolotl.height, `Manalotl height ${height.toFixed(2)} (length-led) is above the 0.35 canon height, as reported`)
  }
  console.log(`   ${sp}: ${height.toFixed(3)} m tall, ${len.toFixed(3)} m long`)

  // ── 2. ground keep: every pose the trot can put her in keeps every vertex on or above the ground ──
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, low = lowPoints(V, cx, cz), D = { ...TROT, ...L.trot }
  let worst = 0, worstAt = '', raw = 0
  for (const pitch of [D.sitPitch, 0, 0.05, 0.11, 0.18, D.sniffPitch - 0.04, D.sniffPitch + 0.04]) for (const roll of [-D.leanMax - 0.1, -D.leanMax, 0, D.leanMax, D.leanMax + 0.1])
    for (const [sx, sy] of [[1, 1], [1, 1.015], [1, 1 - D.squash], [1, D.sitY], [1 - D.stretch * 0.5, 1 + D.stretch]]) {
      const lift = groundLift(low, L.h, pitch, roll, sx, sy), cp = Math.cos(pitch), s = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll)
      let lo = Infinity
      for (let i = 0; i < V.length; i += 3) lo = Math.min(lo, ((V[i] - cx) * sx * sr + V[i + 1] * sy * cr) * cp - (V[i + 2] - cz) * sx * s)
      raw = Math.min(raw, lo * L.h)
      const sink = lo * L.h + lift
      if (sink < worst) { worst = sink; worstAt = `pitch ${pitch.toFixed(2)} roll ${roll.toFixed(2)} sx ${sx} sy ${sy}` }
    }
  ok(worst > -0.004, `${sp}: no pose sinks a vertex more than 4 mm into the ground (worst ${(worst * 100).toFixed(2)} cm at ${worstAt})`)
  ok(raw < -0.01, `${sp}: the guard has a subject: unlifted, the tips DO sink (${(raw * 100).toFixed(1)} cm)`)
  ok(groundLift(low, L.h, 0, 0) < 0.002, `${sp}: standing level she is not lifted (${groundLift(low, L.h, 0, 0).toFixed(4)} m)`)
}

// ── 3. the trot dials grow with her: lengths x size, speeds x sqrt(size); the Manalotl keeps her amble speed (her manner) ──
{
  const k = GROWN.fox.height / 0.55, f = SPIRIT_MODELS.fox!.trot, m = SPIRIT_MODELS.axolotl!.trot
  ok(near(f.stride!, TROT.stride * k, 1e-9) && near(f.hopH!, TROT.hopH * k, 1e-9), `Vulnyx stride / hop grow x${k.toFixed(3)}`)
  ok(near(f.speed!, TROT.speed * Math.sqrt(k), 1e-9) && near(f.dash!, TROT.dash * Math.sqrt(k), 1e-9), 'Vulnyx speed / dash grow x sqrt(size)')
  const km = SPIRIT_MODELS.axolotl!.h / 0.15
  ok(near(m.stride!, 0.12 * km, 1e-9) && near(m.happyH!, 0.035 * km, 1e-9), `Manalotl stride / happy bob grow x${km.toFixed(2)}`)
  ok(m.speed === 0.42 && m.dash === 0.62 && m.playV === 0.5, 'Manalotl keeps her slow amble (0.42 / 0.62 / 0.5 m/s)')
  ok(m.sitY === 0.93 && m.sitPitch === -0.08, 'fractions and angles are not rescaled')
  const g = grownTrot({ stride: 1 }, 1, 4)
  ok(g.stride === 4 && g.speed === TROT.speed * 2 && g.hopH === TROT.hopH * 4, 'grownTrot fills an absent dial from TROT before scaling it')
}

console.log(`spirit-size: ${pass}/${fails.length}`)
if (fails.length) { for (const f of fails) console.error('   x ' + f); process.exit(1) }
