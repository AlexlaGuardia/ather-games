// Run: npx tsx src/app/shimmer/open/ather/waymark-spots.test.ts
// M147: a held stone goes in front of the keeper; travel stands the keeper beside a stone, on free ground, facing it, never in it.
import { besideStone, plantSpot, PLANT_AHEAD } from './waymarks'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const flat = () => 0, S = { x: 10, z: -20 }
for (let y = -3; y <= 3; y += 0.5) { const p = plantSpot({ x: 1, z: 2, yaw: y }); ok(Math.abs(Math.hypot(p.x - 1, p.z - 2) - PLANT_AHEAD) < 1e-9 && Math.abs((p.x - 1) - -Math.sin(y) * PLANT_AHEAD) < 1e-9 && Math.abs((p.z - 2) - -Math.cos(y) * PLANT_AHEAD) < 1e-9, `ahead at yaw ${y}`) }
const faces = (b: { x: number; z: number; yaw: number }) => { const d = Math.hypot(S.x - b.x, S.z - b.z); return (-Math.sin(b.yaw) * (S.x - b.x) - Math.cos(b.yaw) * (S.z - b.z)) / d > 0.999 }
const a = besideStone(S, () => true, flat)
ok(Math.abs(a.x - S.x - 2.2) < 1e-9 && Math.abs(a.z - S.z - 2.2) < 1e-9 && faces(a), 'open ground: where it always was, facing it')
const walls: [string, (x: number, z: number) => boolean][] = [['east shut', x => x < S.x - 1], ['north only', (_x, z) => z < S.z - 1.5], ['near shut', (x, z) => Math.hypot(x - S.x, z - S.z) > 4], ['a slot', (x, z) => Math.abs(x - S.x) < 1 && z > S.z]]
for (const [n, free] of walls) { const b = besideStone(S, free, flat); ok(free(b.x, b.z) && faces(b) && Math.hypot(b.x - S.x, b.z - S.z) > 2.3, `${n}: free, beside, facing (${JSON.stringify(b)})`) }
const cliff = besideStone(S, () => true, x => (x > S.x + 0.5 ? 6 : 0)); ok(cliff.x <= S.x + 0.5 && faces(cliff), 'never up a cliff from its stone')
const none = besideStone(S, () => false, flat); ok(Math.hypot(none.x - S.x, none.z - S.z) > 2, 'nothing free: still not in the stone')
console.log(`waymark-spots: ${pass} pass, ${fail} fail`); if (fail) process.exit(1)
