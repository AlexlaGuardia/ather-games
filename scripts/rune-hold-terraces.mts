// Bake Rune Hold's terraces into world/heightmaps.json (the file the 3D sculpt tool writes).
// Run: npx tsx scripts/rune-hold-terraces.mts        — then the json is the truth; sculpt on top freely.
import { readFileSync, writeFileSync } from 'node:fs'
import { RUNE_HOLD } from '../src/app/shimmer/world/tilemap'
import { terraceHeights } from '../src/app/shimmer/play3d/rune-hold-terraces'
import { runeHoldDoors } from '../src/app/shimmer/play3d/rune-hold-terraces-doors'

const P = 'src/app/shimmer/world/heightmaps.json'
const raw = readFileSync(P, 'utf8')          // read first: never open for write before the read (memory: python-open-truncates)
const all = JSON.parse(raw)
all['rune-hold'] = terraceHeights(RUNE_HOLD, runeHoldDoors())
writeFileSync(P, JSON.stringify(all))
console.log('baked rune-hold terraces into', P)
