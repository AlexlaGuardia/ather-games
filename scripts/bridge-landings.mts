// DOES THE DECK MEET THE SHORE? Run: npx tsx scripts/bridge-landings.mts
//
// ★★★ WHY THIS EXISTS. Alex, 2026-08-30, from play: *"i found alot of instances where they didnt
// land on the shore smoothly.. (like the shore is higher than the bridge)"*. `bridges.ts`'s own
// header says the opposite — *"deck and bank met flush by construction, no ramp logic anywhere"* —
// so the claim and the world disagreed and nothing in the tree could say which was right.
// Measured at 2026-08-30 on seed 1337: **19 flush · 18 SHORE HIGHER (up to +2) · 2 lower.**
//
// ── ★★ THE DIAGNOSIS, so the number is not just a number ──────────────────────────────────────
// Both halves are correct about different PLACES. `height.ts`'s approach blend pins the bank to
// `table + 1` **at the waterline** and eases back toward raw terrain as you move away
// (`h = raw + ((table+1) - raw) * sm01(...)`). The deck springs from `table + 1` **at its span
// anchor**, which is further out — where the blend has already relaxed. The gap between those two
// places is the step a keeper walks up.
//
// ⚠ AND THE OBVIOUS FIX IS BLOCKED BY THE MODULE GRAPH. `holds.ts` can flatten terrain because
// `height.ts` IMPORTS it; `bridges.ts` imports height, so the arrow runs the other way and a bridge
// cannot contribute a height blend without restructuring. The fix has to lay BLOCKS, not move
// ground — which is what Alex proposed independently: *"premake all the blocks from one end of the
// bridge to the other, including the shore."*
//
// ⚠⚠ THE FIRST VERSION OF THIS PROBE READ `s.x` / `s.z` / `s.dir`, WHICH DO NOT EXIST ON
// `BridgeSpec`. Every sample was NaN and it reported a confident **100% in one direction with zero
// in the others** — which is the only reason it got caught. A probe's shape is evidence about the
// probe first. It finds bridges the way the world does now: `bridgeAt()` per column.
import { bridgeSpecs, bridgeAt } from './src/app/shimmer/voxel/bridges'
import { columnHeight } from './src/app/shimmer/voxel/height'

const SEED = 1337
const specs = bridgeSpecs(SEED)

// Scan around each crossing's piers to find its columns.
const landings: { id: string; end: string; deck: number; shore: number; d: number; at: string }[] = []
for (let i = 0; i < specs.length; i++) {
  const s = specs[i]
  const anchor = s.pierPos[0] ?? { x: 0, z: 0 }
  const cells = new Map<string, { x: number; z: number; t: number }>()
  const R = s.span + 20
  for (let x = anchor.x - R; x <= anchor.x + R; x++) for (let z = anchor.z - R; z <= anchor.z + R; z++) {
    const b = bridgeAt(x, z, SEED)
    if (b && b.i === i) cells.set(`${x},${z}`, { x, z, t: b.t })
  }
  if (!cells.size) continue
  const ts = [...cells.values()].map(c => c.t)
  const tMin = Math.min(...ts), tMax = Math.max(...ts)
  for (const [end, tEnd] of [['near', tMin], ['far', tMax]] as const) {
    for (const c of cells.values()) {
      if (c.t !== tEnd) continue
      // The deck's own top here, and the first LAND column beyond it in each direction.
      const deck = columnHeight(c.x, c.z, SEED)
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = c.x + dx, nz = c.z + dz
        if (bridgeAt(nx, nz, SEED)) continue          // still on the bridge
        const shore = columnHeight(nx, nz, SEED)
        landings.push({ id: s.id, end, deck, shore, d: shore - deck, at: `${nx},${nz}` })
      }
      break
    }
  }
}

const up = landings.filter(l => l.d > 0), flat = landings.filter(l => l.d === 0), down = landings.filter(l => l.d < 0)
console.log(`bridges ${specs.length} · landing samples ${landings.length}`)
console.log(`  flush           ${flat.length}`)
console.log(`  SHORE HIGHER    ${up.length}   <- a step UP off the deck, which is what Alex reported`)
console.log(`  shore lower     ${down.length}`)
if (up.length) {
  up.sort((a, b) => b.d - a.d)
  console.log(`  worst: ${up.slice(0, 8).map(l => `${l.id} ${l.end} +${l.d} @${l.at}`).join(' · ')}`)
}
