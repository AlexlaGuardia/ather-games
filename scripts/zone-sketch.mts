// Zone layout sketch — the garden loop realized at world scale, drawn for Alex's blessing.
//
// ★ THIS IS A PROPOSAL DOCUMENT, not generation code. The zone identities, roles and loop ORDER
// are canon (CANON/game/shimmer-geography.md — the mapped loop, IDs stable); their SCALE and
// world-coordinates are build (the boundary doc gives every number to Jin). Nothing here ships
// until Alex blesses the layout; then the region fields get built against these anchors.
//
// Run: npx tsx scripts/zone-sketch.mts   → public/zone-sketch.png (served at /zone-sketch.png)

import sharp from 'sharp'

interface Zone {
  id: string
  name: string
  role: string
  x: number; z: number          // world blocks, spawn at origin
  rx: number; rz: number        // region half-extents
  fill: string
  stroke: string
  dashed?: boolean
}

// The loop, west arm and east arm, exactly as ruled:
// Home → Mycelial Path → (Spirit Meadows | Twilight Thicket) ‖ east: → Mana Springs (Voranyx mouth)
// → Route 2 → Gloview → Route 3 → The Outfields → [sealed Ather Winds]
const ZONES: Zone[] = [
  { id: 'garden', name: 'HOME PLOT', role: 'spawn · build mode · reformed Moglins dock', x: 0, z: 0, rx: 380, rz: 340, fill: '#d9b64a33', stroke: '#d9b64a' },
  { id: 'moonwell-glade', name: 'MOONWELL GLADE', role: 'Gregory · tended heart · fold-gate', x: -150, z: -640, rx: 340, rz: 300, fill: '#bcd0e833', stroke: '#bcd0e8' },
  { id: 'mycelial-path', name: 'MYCELIAL PATH', role: 'west corridor · forks to both arms', x: -1250, z: -120, rx: 620, rz: 260, fill: '#b8a06433', stroke: '#b8a064' },
  { id: 'spirit-meadow', name: 'SPIRIT MEADOWS', role: 'HOLD 1 · first liberation · gentle open terrain', x: -2150, z: 700, rx: 950, rz: 780, fill: '#7fc46a33', stroke: '#7fc46a' },
  { id: 'twilight-thicket', name: 'TWILIGHT THICKET', role: 'cozy pocket · closed dim woodland', x: -2000, z: -1150, rx: 800, rz: 650, fill: '#7a6b9e33', stroke: '#9a8bc4' },
  { id: 'mana-springs', name: 'MANA SPRINGS', role: 'eastern hub · broken spring-pocked uplands · ascent', x: 2100, z: -300, rx: 900, rz: 750, fill: '#5fd0c433', stroke: '#5fd0c4' },
  { id: 'gloview-village', name: 'GLOVIEW VILLAGE', role: 'free Moglin village · nothing hostile ever', x: 3450, z: -1500, rx: 520, rz: 430, fill: '#e0955633', stroke: '#e09556' },
  { id: 'the-outfields', name: 'THE OUTFIELDS', role: 'frayed edge · retreat pens · still garden', x: 3700, z: 1000, rx: 900, rz: 750, fill: '#a8a28c33', stroke: '#a8a28c' },
]

interface Marker { name: string; note: string; x: number; z: number; sealed?: boolean }
const MARKERS: Marker[] = [
  { name: 'VORANYX CAVERNS', note: 'cave mouth · 1F⇄2F · sealed door to the Silt below', x: 2650, z: -1000 },
  { name: 'ATHER WINDS', note: 'sealed gate to the Wilds · v1 closing hook', x: 4800, z: 650, sealed: true },
  { name: 'SPIRIT CORNER', note: 'shop interior via Home Plot gate (not terrain)', x: 550, z: 620 },
]

const W = 1500, H = 1100
const SCALE = 0.135                      // px per block
const OX = W * 0.42, OZ = H * 0.52      // spawn position on the sheet
const px = (x: number) => OX + x * SCALE
const pz = (z: number) => OZ + z * SCALE

const zoneEls = ZONES.map(zo => `
  <ellipse cx="${px(zo.x)}" cy="${pz(zo.z)}" rx="${zo.rx * SCALE}" ry="${zo.rz * SCALE}"
    fill="${zo.fill}" stroke="${zo.stroke}" stroke-width="2.5" ${zo.dashed ? 'stroke-dasharray="8 6"' : ''}/>
  <text x="${px(zo.x)}" y="${pz(zo.z) - 8}" text-anchor="middle" font-family="monospace" font-size="19"
    font-weight="bold" fill="${zo.stroke}">${zo.name}</text>
  <text x="${px(zo.x)}" y="${pz(zo.z) + 14}" text-anchor="middle" font-family="monospace" font-size="11.5"
    fill="#cfc9bd">${zo.role}</text>
  <text x="${px(zo.x)}" y="${pz(zo.z) + 30}" text-anchor="middle" font-family="monospace" font-size="10"
    fill="#8f897d">~${Math.round(zo.rx * 2 / 100) * 100}×${Math.round(zo.rz * 2 / 100) * 100}</text>`).join('')

const markerEls = MARKERS.map(m => `
  <g>
    <rect x="${px(m.x) - 7}" y="${pz(m.z) - 7}" width="14" height="14"
      fill="${m.sealed ? 'none' : '#e8e2d4'}" stroke="#e8e2d4" stroke-width="2"
      transform="rotate(45 ${px(m.x)} ${pz(m.z)})"/>
    <text x="${px(m.x)}" y="${pz(m.z) - 14}" text-anchor="middle" font-family="monospace" font-size="13"
      font-weight="bold" fill="#e8e2d4">${m.name}${m.sealed ? ' ⊘' : ''}</text>
    <text x="${px(m.x)}" y="${pz(m.z) + 24}" text-anchor="middle" font-family="monospace" font-size="10"
      fill="#8f897d">${m.note}</text>
  </g>`).join('')

// The loop as route arrows (travel corridors — in-game these are the valley floors and riversides).
const routes: [number, number, number, number, string][] = [
  [0, 0, -1250, -120, ''],                    // home → mycelial
  [-1250, -120, -2150, 700, ''],              // → meadows (SW arm)
  [-1250, -120, -2000, -1150, ''],            // → thicket (NW arm)
  [0, 0, 2100, -300, ''],                     // home → springs (east arm)
  [2100, -300, 3450, -1500, 'ROUTE 2'],       // springs → gloview
  [3450, -1500, 3700, 1000, 'ROUTE 3'],        // gloview → outfields
  [3700, 1000, 4800, 650, ''],                 // outfields → threshold
  [0, 0, -150, -640, ''],                     // home ↔ moonwell
]
const routeEls = routes.map(([x1, z1, x2, z2, label]) => {
  const mx = (px(x1) + px(x2)) / 2, mz = (pz(z1) + pz(z2)) / 2
  return `
  <line x1="${px(x1)}" y1="${pz(z1)}" x2="${px(x2)}" y2="${pz(z2)}"
    stroke="#6d675c" stroke-width="2" stroke-dasharray="3 7"/>
  ${label ? `<text x="${mx}" y="${mz - 6}" text-anchor="middle" font-family="monospace" font-size="11" fill="#6d675c">${label}</text>` : ''}`
}).join('')

// The greying rim — drained country thickening toward the world's frayed edge; greyfield biome
// (and the Hollows at night) concentrates out here, thinning toward the tended heart.
const rim = `
  <ellipse cx="${px(800)}" cy="${pz(0)}" rx="${5300 * SCALE}" ry="${3800 * SCALE}"
    fill="none" stroke="#83887b" stroke-width="36" stroke-dasharray="30 22" opacity="0.28"/>
  <text x="${px(800)}" y="${pz(-3650)}" text-anchor="middle" font-family="monospace" font-size="14"
    fill="#83887b">· · · THE GREYING RIM — greyfields + ruins + the night's Hollows thicken out here · · ·</text>`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#1b1d1a"/>
  <text x="30" y="42" font-family="monospace" font-size="24" font-weight="bold" fill="#e8e2d4">THE GARDEN AT WORLD SCALE — zone layout proposal v1</text>
  <text x="30" y="64" font-family="monospace" font-size="12" fill="#8f897d">the ruled loop (shimmer-geography.md) as anchored regions · wild country between zones carries the generic biomes (woodland / meadow / greyfield / rivers)</text>
  ${rim}${routeEls}${zoneEls}${markerEls}
  <g transform="translate(${W - 260}, ${H - 70})">
    <line x1="0" y1="0" x2="${1000 * SCALE}" y2="0" stroke="#e8e2d4" stroke-width="3"/>
    <text x="${500 * SCALE}" y="-8" text-anchor="middle" font-family="monospace" font-size="12" fill="#e8e2d4">1000 blocks</text>
  </g>
  <text x="30" y="${H - 28}" font-family="monospace" font-size="11" fill="#6d675c">★ spawn = HOME PLOT · zone positions/sizes are BUILD (mine, dial freely) · zone identities + loop order are CANON (Magii's)</text>
</svg>`

await sharp(Buffer.from(svg)).png().toFile('public/zone-sketch.png')
console.log('public/zone-sketch.png — open ather.games/zone-sketch.png')
