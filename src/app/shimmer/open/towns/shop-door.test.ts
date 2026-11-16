// The shop door kit (shop-door.tsx) sits on the shader's painted door and its E point is in front of the facade.
// Run: npx tsx src/app/shimmer/open/towns/shop-door.test.ts
import { doorU, shopDoorPoint, DOOR_W, STEP } from './shop-door'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// the shader (Towns.tsx): cell = floor(u'/cw) with u' = local x + w/2, door cell = floor(cols/2), painted |lu| < 0.65
for (const w of [3, 5.4, 6, 8.1, 9, 10.8, 12, 14.5]) {
  const cols = Math.max(1, Math.floor(w / 2.7)), cw = w / cols, u = doorU(w)
  const cellOf = (x: number) => Math.floor((x + w / 2) / cw)
  ok(cellOf(u) === Math.floor(cols / 2), `w=${w}: door centre is not in the shader's door cell`)
  ok(cellOf(u - DOOR_W / 2 + 0.01) === cellOf(u + DOOR_W / 2 - 0.01), `w=${w}: the opening straddles two cells`)
  ok(Math.abs(u) + DOOR_W / 2 < w / 2, `w=${w}: the opening runs off the front`)
  if (cols % 2 === 0) ok(Math.abs(u) > 0.1, `w=${w}: even cols must put the door off-centre`)
}
// the E point: in front of the facade (the same side lots.ts puts its door), at the door's u, one step below the floor
for (const yaw of [0, 0.7, Math.PI / 2, 2.4, -1.1]) {
  const b = { x: 100, z: -40, yaw, w: 8.1, d: 7, y1: 12 }
  const p = shopDoorPoint(b), fx = Math.cos(yaw), fz = Math.sin(yaw)
  const dx = p.x - b.x, dz = p.z - b.z
  const out = dx * fx + dz * fz, along = dx * -fz + dz * fx
  ok(Math.abs(out - (b.d / 2 + 0.45)) < 1e-9, `yaw=${yaw}: E point is not 0.45 m out from the front (${out.toFixed(3)})`)
  ok(Math.abs(along + doorU(b.w)) < 1e-9, `yaw=${yaw}: E point is not at the door along the front`)
  ok(Math.abs(p.y - (b.y1 + 0.25 - STEP)) < 1e-9, `yaw=${yaw}: E point is not at street height`)
}
if (fails.length) { console.error(`shop-door: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`shop-door: ${pass}/0`)
