// Run: npx tsx src/app/shimmer/voxel/glade.test.ts
//
// Moonwell Glade as an island: the ring math, the column builder and — the load-bearing half —
// the save baseline. `recordEdit` diffs against `gladeGeneratedVoxel`; if that disagrees with what
// `generateGladeColumn` put in the column, the whole island is written into the save as edits on
// first load (the plot paid for this once, `plot-column.test.ts`).

import { Column, SECTION, Stage, makeColumn } from './column'
import { columnHeight } from './height'
import { generateGladeColumn, gladeGeneratedVoxel } from './glade-column'
import { DEFAULT_GLADE, gladeDist, gladeEdgeAt, gladePlanAt, gladeSeamSpot, insideGlade, inGladeWall, gladeReach } from './glade'
import { AIR } from './section'
import { ZONE_ANCHORS } from './zones'

let pass = 0, fail = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++ } else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const SEEDS = [1, 7, 42, 555, 1337]
const G = DEFAULT_GLADE
const glade = ZONE_ANCHORS.find(z => z.id === 'moonwell-glade')!

console.log('the ring')
{
  check('centred on the zone anchor', G.cx === glade.x && G.cz === glade.z)
  // The wobble only ever cuts in, and the outline is a function of bearing alone.
  for (const seed of SEEDS) {
    let past = 0, notClosed = 0
    for (let i = 0; i < 360; i++) {
      const b = (i / 360) * Math.PI * 2
      const e1 = gladeEdgeAt(G.cx + Math.cos(b) * 50, G.cz + Math.sin(b) * 50, seed)
      const e2 = gladeEdgeAt(G.cx + Math.cos(b) * 400, G.cz + Math.sin(b) * 400, seed)
      if (e1 > G.radius) past++
      if (Math.abs(e1 - e2) > 1e-6) notClosed++
    }
    check(`seed ${seed}: the edge never passes radius`, past === 0, `${past} bearings`)
    check(`seed ${seed}: the edge depends on bearing alone`, notClosed === 0, `${notClosed} bearings`)
  }
  // Everything authored stands well inside: Greg's spawn, the harness's five standing spots.
  const spots = [[-150, -640], [-159, -628], [-125, -605], [-138, -617], [-155, -616], [-159, -600]] as const
  for (const seed of SEEDS)
    check(`seed ${seed}: every authored spot is inside`, spots.every(([x, z]) => insideGlade(x, z, seed)))
  // The wall is a ring just past the edge, and past the reach there is nothing.
  for (const seed of SEEDS) {
    let wallOk = true, reachOk = true
    for (let i = 0; i < 72; i++) {
      const b = (i / 72) * Math.PI * 2
      const e = gladeEdgeAt(G.cx + Math.cos(b) * 100, G.cz + Math.sin(b) * 100, seed)
      const wx = G.cx + Math.cos(b) * (e + 1.5), wz = G.cz + Math.sin(b) * (e + 1.5)
      if (!inGladeWall(wx, wz, seed)) wallOk = false
      const ox = G.cx + Math.cos(b) * (gladeReach() + 2), oz = G.cz + Math.sin(b) * (gladeReach() + 2)
      if (gladePlanAt(ox, oz, seed, 100).kind !== 'void') reachOk = false
    }
    check(`seed ${seed}: a ring of wall just past the edge`, wallOk)
    check(`seed ${seed}: void past the reach`, reachOk)
  }
  // The keel never eats the turf: the plan's floor band ends under the ground, even at the lip.
  for (const seed of SEEDS) {
    let bad = 0
    for (let i = 0; i < 72; i++) {
      const b = (i / 72) * Math.PI * 2
      const e = gladeEdgeAt(G.cx + Math.cos(b) * 100, G.cz + Math.sin(b) * 100, seed)
      for (const r of [0, e * 0.5, e * 0.9, e - 1]) {
        const x = G.cx + Math.cos(b) * r, z = G.cz + Math.sin(b) * r
        const p = gladePlanAt(x, z, seed, 100)
        if (p.kind !== 'inside' || p.floorTop > 100 - 1) bad++
      }
    }
    check(`seed ${seed}: the floor band stays under the turf`, bad === 0, `${bad} columns`)
  }
}

console.log('the seam')
{
  for (const seed of SEEDS) {
    const s = gladeSeamSpot(seed, (x, z) => columnHeight(x, z, seed))
    check(`seed ${seed}: the seam stands inside the coast`, insideGlade(s.x, s.z, seed))
    check(`seed ${seed}: the seam is within a few blocks of the wall`,
      gladeEdgeAt(s.x, s.z, seed) - gladeDist(s.x, s.z) < G.seamInset + 2)
    // It faces the plot's fold: the bearing from the Glade to the origin.
    const toOrigin = Math.atan2(-G.cz, -G.cx)
    check(`seed ${seed}: the seam faces the origin`, Math.abs(s.bearing - toOrigin) < 1e-9)
  }
}

console.log('the column and its baseline')
{
  const SEED = 1337
  const at = (wx: number, wz: number) => ({ wx: Math.floor(wx / SECTION) * SECTION, wz: Math.floor(wz / SECTION) * SECTION })
  const MID = at(G.cx, G.cz)
  const b = G.seamBearing
  const eb = gladeEdgeAt(G.cx + Math.cos(b) * 100, G.cz + Math.sin(b) * 100, SEED)
  const LIP = at(G.cx + Math.cos(b) * (eb - 4), G.cz + Math.sin(b) * (eb - 4))
  const VOID = at(G.cx + Math.cos(b) * (G.radius + 40), G.cz + Math.sin(b) * (G.radius + 40))
  for (const [name, c] of [['mid', MID], ['lip', LIP], ['void', VOID]] as const) {
    const col = generateGladeColumn(new Column(c.wx, c.wz), SEED)
    check(`${name}: the column is Ready`, col.stage === Stage.Ready)
    let wrong = 0, solid = 0
    const H = col.sections.length * SECTION
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) for (let y = 0; y < H; y++) {
      const got = col.get(x, y, z)
      if (got !== AIR) solid++
      if (got !== gladeGeneratedVoxel(col, x, y, z, SEED)) wrong++
    }
    check(`${name}: every cell matches its baseline`, wrong === 0, `${wrong} of ${SECTION * SECTION * H}`)
    if (name === 'void') check('void: nothing generated', solid === 0, `${solid} solid`)
    else check(`${name}: ground exists`, solid > 0)
  }
  // The surface inside is the Wilds' surface: the mask never touches y = h.
  {
    const col = generateGladeColumn(new Column(MID.wx, MID.wz), SEED)
    // Compare against the continent at the same cells.
    const w = makeColumn(MID.wx, MID.wz, SEED)
    let diff = 0
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
      const h = w.heightAt(x, z)
      for (let y = h - 2; y <= h + 6; y++) if (col.get(x, y, z) !== w.get(x, y, z)) diff++
    }
    check('mid: the surface band is the Wilds\' own', diff === 0, `${diff} cells differ`)
  }
}

console.log(`glade: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
