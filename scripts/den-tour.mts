// Where are the dens? — prints the nearest den mouths to a point, with a ready `tp` line.
//
// Run: npx tsx scripts/den-tour.mts [x] [z] [count]
//
// ★ THE SAME ARGUMENT AS `findLands`: a feature nobody can find is a feature nobody can judge.
// A den is one mouth in a bank, roughly one per 17 chunks in meadow and one per 240 in barrens —
// wandering for it is not a review, it is a lottery. This turns "go look at a den" into a
// coordinate you can paste into the console.
//
// ⚠ IT READS THE SOURCE GENERATOR, NOT THE DEPLOYED WORKER. The page runs the prebuilt
// `public/voxel-gen.worker.<hash>.js`; this imports `dens.ts` directly. After any edit inside the
// worker's import graph the two disagree silently, and this one will always look right. If a
// coordinate here shows no den in game, suspect the artifact before the coordinate.
import { denStartsAt, denAt, denCells, DEFAULT_DENS } from '../src/app/shimmer/voxel/dens'
import { columnHeight, DEFAULT_HEIGHT } from '../src/app/shimmer/voxel/height'
import { landMix, dominantLand } from '../src/app/shimmer/voxel/character'
import { DEFAULT_DEPTH } from '../src/app/shimmer/voxel/depth'
import { bubbleSwallows } from '../src/app/shimmer/voxel/bubble'
import { WILDS_BUBBLE } from '../src/app/shimmer/voxel/column'

const SEED = Number(process.env.WORLD_SEED ?? 1337)
const SIZE = 16
const [ax, az, want] = [Number(process.argv[2] ?? 0), Number(process.argv[3] ?? 0), Number(process.argv[4] ?? 8)]
const surfaceAt = (x: number, z: number) => columnHeight(x, z, SEED, DEFAULT_HEIGHT)
const sea = DEFAULT_DEPTH.seaLevel

const found: { d: number; x: number; z: number; y: number; mx: number; mz: number; land: string; cells: number; yaw: number }[] = []
const R = 70
for (let cz = Math.floor(az / SIZE) - R; cz <= Math.floor(az / SIZE) + R; cz++) {
  for (let cx = Math.floor(ax / SIZE) - R; cx <= Math.floor(ax / SIZE) + R; cx++) {
    for (const st of denStartsAt(SEED, cx, cz, SIZE)) {
      const p = denAt(st, SEED, surfaceAt, sea)
      if (!p) continue
      const mx = Math.round(p.mouthX), mz = Math.round(p.mouthZ)
      // ⚠⚠ A DEN INSIDE THE FOLD IS NOT A PLACE YOU CAN GO, AND IT COSTS FIVE SCREENSHOTS TO LEARN.
      // The continent generator answers for coordinates the home-plot bubble occupies, so dens are
      // planned there — but `/tp` into the shell lands the keeper in a column with zero solid cells,
      // `hasFallenOut` sets them back at their door, and the visible symptom is *a teleport that
      // silently does nothing*. I read that as a broken `WORLD_CMD` flag and went hunting through
      // `world-shot.mts` and the console's Enter handling before checking the destination. The
      // instrument was fine; I was pointing it into a hole in the world. `findLands` already learned
      // this exact lesson — same guard, same reason.
      if (bubbleSwallows(WILDS_BUBBLE, [{ id: 'den', x: mx, z: mz }]).length > 0) continue
      // Stand OUTSIDE the mouth, looking back into the bank: step further downhill, face uphill.
      const sx = mx + Math.round(p.dx * 3), sz = mz + Math.round(p.dz * 3)
      // Spawn faces -Z and yaw turns right, so this is the bearing from the stand point to the mouth.
      const yaw = Math.round((Math.atan2(mx - sx, -(mz - sz)) * 180) / Math.PI)
      found.push({
        d: Math.hypot(mx - ax, mz - az), x: sx, z: sz, y: p.floorY, mx, mz,
        land: dominantLand(landMix(mx, mz, SEED)).id, cells: denCells(p).length, yaw,
      })
    }
  }
}
found.sort((a, b) => a.d - b.d)
if (!found.length) { console.log(`no dens within ${R} chunks of (${ax}, ${az}) — say so rather than reading silence as "dens are broken"`); process.exit(0) }
console.log(`${found.length} dens within ${R} chunks of (${ax}, ${az}). Nearest ${Math.min(want, found.length)}:\n`)
console.log('  dist  land        floor  cells   stand here, facing the bank')
for (const f of found.slice(0, want)) {
  console.log(`  ${String(Math.round(f.d)).padStart(5)}  ${f.land.padEnd(11)} ${String(f.y).padStart(5)}  ${String(f.cells).padStart(5)}   mouth ${f.mx} ${f.mz}  ·  tp ${f.x} ${f.z}  yaw ${f.yaw}`)
}
