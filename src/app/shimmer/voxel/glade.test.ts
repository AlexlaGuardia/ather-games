// Run: npx tsx src/app/shimmer/voxel/glade.test.ts
//
// Moonwell Glade as an island: the ring math, the column builder and — the load-bearing half —
// the save baseline. `recordEdit` diffs against `gladeGeneratedVoxel`; if that disagrees with what
// `generateGladeColumn` put in the column, the whole island is written into the save as edits on
// first load (the plot paid for this once, `plot-column.test.ts`).

import { Column, SECTION, Stage, makeColumn } from './column'
import { columnHeight } from './height'
import { generateGladeColumn, gladeGeneratedVoxel } from './glade-column'
import { DEFAULT_GLADE, gladeDist, gladeEdgeAt, gladePlanAt, gladeSeamSpot, insideGlade, inGladeWall, gladeReach, GLADE_SEAMS, GLADE_SEAM_TO, type GladeSeam } from './glade'
import { STORY_NODES } from './story-path'
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

console.log("the plot's shell stays out of Greg's garden")
{
  // 507 from the origin on the plot-facing bearing: inside the island (r≈150), and inside the band
  // where the continent raises WILDS_BUBBLE's cloud shell (~500). The Wilds column has shell there;
  // the Glade's must not — the pale mass with trees on it across the seam, 2026-09-16.
  const SEED = 1337
  const b = G.seamBearing
  const px = Math.floor((G.cx + Math.cos(b) * 150) / SECTION) * SECTION
  const pz = Math.floor((G.cz + Math.sin(b) * 150) / SECTION) * SECTION
  const wilds = makeColumn(px, pz, SEED)
  const glade = generateGladeColumn(new Column(px, pz), SEED)
  const count = (c: Column, mat: number) => {
    let n = 0
    const H = c.sections.length * SECTION
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) for (let y = 0; y < H; y++) if (c.get(x, y, z) === mat) n++
    return n
  }
  const CLOUD_WALL = 56
  check('the Wilds raise the shell there (sanity: the test can see its subject)', count(wilds, CLOUD_WALL) > 0, `${count(wilds, CLOUD_WALL)} cells`)
  check('the Glade raises none of it', count(glade, CLOUD_WALL) === 0, `${count(glade, CLOUD_WALL)} cells`)
  // And the baseline agrees, cell for cell, in this column too.
  let wrong = 0
  const H = glade.sections.length * SECTION
  for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) for (let y = 0; y < H; y++)
    if (glade.get(x, y, z) !== gladeGeneratedVoxel(glade, x, y, z, SEED)) wrong++
  check('shell-band column matches its baseline', wrong === 0, `${wrong} cells`)
}

// ── ★★★ THE SPINE MUST LEAVE THROUGH A DOOR (2026-09-22) ─────────────────────────────────────
// Alex: *"i went to walk the story road to see if i see a few dif biomes and after the first bridge
// i find a wall like the homeplot has."* He was right that something was wrong and wrong about
// what — the Wilds generates ground at ten million blocks out, and both bubbles are deliberate.
//
// ★ THE DEFECT WAS A COMPOSITION OF TWO CORRECT DECISIONS, which is why nothing caught it for six
// weeks. The island's seam bears on the ORIGIN (correct: it is Greg's fold, and the plot's own
// passage bears back at the glade). The story road leaves toward Gloview (correct: that is where
// the spine goes). Each is right alone. Together they put the one thing in the glade that says
// *this way out* at 180° from the only door, so a keeper who follows it walks into the wall.
//
// ⚠ NO TEST COULD HAVE SEEN IT, because every existing assert was about ONE of the two facts. This
// is the assert about their RELATIONSHIP: wherever the spine crosses the island's coast, a seam
// must be standing there. It is deliberately not "there are two seams" — a count would pass the
// day someone adds a second seam somewhere useless.
for (const SEED of SEEDS) {
  const cfg = DEFAULT_GLADE
  // Where does the spine cross the coast? Walk the leg the road actually takes out of the glade.
  const from = STORY_NODES[0], to = STORY_NODES[1]
  const ux = (to.x - from.x) / Math.hypot(to.x - from.x, to.z - from.z)
  const uz = (to.z - from.z) / Math.hypot(to.x - from.x, to.z - from.z)
  let crossX = 0, crossZ = 0, found = false
  for (let d = 0; d <= cfg.radius + 40; d += 1) {
    const x = Math.round(cfg.cx + ux * d), z = Math.round(cfg.cz + uz * d)
    if (!insideGlade(x, z, SEED, cfg)) { crossX = x; crossZ = z; found = true; break }
  }
  check(`seed ${SEED}: the spine reaches the island coast at all (the test can see its subject)`, found, `${crossX},${crossZ}`)
  if (found) {
    let best = Infinity, bestWhich = ''
    for (const which of GLADE_SEAMS) {
      const t = gladeSeamSpot(SEED, (x, z) => columnHeight(x, z, SEED), cfg, which)
      const d = Math.hypot(t.x - crossX, t.z - crossZ)
      if (d < best) { best = d; bestWhich = which }
    }
    // Generous: the seam only has to be somewhere a keeper walking the road would meet it.
    check(`seed ${SEED}: ★ a seam stands where the STORY ROAD leaves the island — the spine is not a dead end`,
      best <= 48, `nearest seam '${bestWhich}' is ${best.toFixed(0)} blocks from the road's crossing at ${crossX},${crossZ}`)
    check(`seed ${SEED}: and it crosses into the WILDS, not back home`, GLADE_SEAM_TO[bestWhich as GladeSeam] === 'wilds',
      `road-side seam goes to ${GLADE_SEAM_TO[bestWhich as GladeSeam]}`)
  }
}

console.log(`glade: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
