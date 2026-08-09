// Mist-patch density sweep. Run: npx tsx scripts/mist-sweep.mts [seed]
//
// The mist config's spacing cannot be reasoned about, only measured: the pad and dell filters kill
// most cells, and how many they kill depends on the plains pass, the swell and the zone lifts. So
// "2-3 per region" is a number you read off the world, not one you derive — the same lesson the
// plains pads and the ruin spacing both taught (measure ≥1200 units or the number is noise).
//
// Re-run this after ANY change to height.ts, zones.ts or the mist filters. mist.test.ts asserts a
// band so a bad retune fails loudly; this tells you which way to move.

import { DEFAULT_MIST, mistPatchAt, type MistPatch } from '../src/app/shimmer/voxel/mist.ts'
import { zoneAt, ZONE_ANCHORS } from '../src/app/shimmer/voxel/zones.ts'
import { greyness } from '../src/app/shimmer/voxel/biome.ts'

const SEED = Number(process.argv[2] ?? 1337)
const CFG = DEFAULT_MIST

const reach = Math.max(...ZONE_ANCHORS.map(a => Math.max(Math.abs(a.x) + a.rx, Math.abs(a.z) + a.rz)))
const cells = Math.ceil(reach / (CFG.spacing * 16)) + 2

const byZone = new Map<string, MistPatch[]>()
for (const a of ZONE_ANCHORS) byZone.set(a.id, [])
let wild = 0, examined = 0

for (let cx = -cells; cx <= cells; cx++) {
  for (let cz = -cells; cz <= cells; cz++) {
    examined++
    const p = mistPatchAt(SEED, cx, cz, CFG)
    if (!p) continue
    const id = zoneAt(p.x, p.z, SEED).zone?.id
    if (id) byZone.get(id)!.push(p)
    else wild++
  }
}

console.log(`seed ${SEED} · spacing ${CFG.spacing} cols (${CFG.spacing * 16} blocks) · radius ${CFG.radius}`)
console.log(`${examined} cells examined across ${(cells * 2 + 1)}² — one candidate each\n`)

for (const a of ZONE_ANCHORS) {
  const ps = byZone.get(a.id)!
  const areaK = (Math.PI * a.rx * a.rz) / 1e6
  const flag = a.mist <= 0 ? '  (mist: 0)' : ps.length >= 1 && ps.length <= 5 ? '' : '   ⚠ OUT OF BAND'
  console.log(
    `${a.id.padEnd(18)} ${String(ps.length).padStart(2)} patches  ·  ${areaK.toFixed(2)}M blocks²  ·  ` +
    `mist ${a.mist}${flag}`)
  for (const p of ps) {
    console.log(`     (${String(p.x).padStart(6)}, ${String(p.z).padStart(6)})  floor ${String(p.floor).padStart(3)}  ` +
      `weight ${p.weight.toFixed(2)}  grey ${greyness(p.x, p.z, SEED).toFixed(2)}`)
  }
}
console.log(`\nwild country (outside every zone): ${wild} — expected 0, zones are the gate`)
