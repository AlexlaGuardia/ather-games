// BETA M112 s2: the reserved-name fix, Gleaner's signed talk, the Burrfolk camp. npx tsx src/app/shimmer/open/ather/gleaner.test.ts
import { readFileSync } from 'node:fs'
import { folkOf, seasonNames, seasonRoster, folkCount, RESERVED_NAMES, FOLK_MAX, SEASON_SETTLEMENTS } from './settlement-folk'
import { burrfolkOf, freeNames, stallSpot, BURR_LABEL, BURR_KIND } from './burrfolk'
import { GLEANER_LINES, GLEANER_ASK, GLEANER_POST, GLEANER_NAME, BURR_CAMP, CAMP_LABEL, campStalls, gleanerMem, _resetGleaner, afterSwap, gleanerLeave, isGleaner } from './gleaner'
import { folkTalk, helloFor, _resetHeard, ASK, type FolkTalkState, type FolkTalkActs } from './folk-talk'
import { freshTrust } from './settlement-folk'
import { makeVoids, type IndexLike } from './wilds-voids'
import { withGlade, settlementAt, type Network, type Settlement } from './network'
import { ARRIVAL } from './relief'
let fails = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log(`✗ ${m}`) } }

// ── 1. the BUG: a generated Moglin never carries a reserved name (canon › Names ⛔ Reserved) ──
const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network
ok(net.settlements.length <= SEASON_SETTLEMENTS, `the season has at most ${SEASON_SETTLEMENTS} settlements (${net.settlements.length})`)
const spec = readFileSync('/root/athernyx/CANON/game/shimmer-folds-settlements.md', 'utf8')
for (const nm of ['Angelica', 'Chamomile', 'Borage', 'Feverfew']) ok(new RegExp(`Reserved, never generated:\\*\\*[^\\n]*${nm}`).test(spec) && RESERVED_NAMES.has(nm), `${nm} is reserved in canon and here`)
ok(/\*Gleaner\* reserved/.test(spec) && RESERVED_NAMES.has('Gleaner'), 'Gleaner is reserved in canon and here')
let reservedHit = 0, renamed = 0, swapped = 0, dupSeasons = 0
for (let season = 1; season <= 60; season++) {
  const ss: Settlement[] = net.settlements.map(s => ({ ...s, id: s.id.replace(/^s\d+-/, `s${season}-`) }))
  const { names, order } = seasonNames(season), all: string[] = []
  for (const s of ss) {
    const idx = Number(/-(\d+)$/.exec(s.id)![1])
    folkOf(s, season).forEach((f, k) => {
      all.push(f.name)
      if (RESERVED_NAMES.has(f.name)) reservedHit++
      const drawn = names[order[idx * FOLK_MAX + k]]
      if (RESERVED_NAMES.has(drawn)) swapped++; else if (drawn !== f.name) renamed++   // only reserved draws change
    })
    const b = burrfolkOf(s, season); if (b && b.name !== BURR_KIND) all.push(b.name)
    if (b && RESERVED_NAMES.has(b.name)) reservedHit++
  }
  if (new Set(all).size !== all.length) dupSeasons++
}
ok(reservedHit === 0, `no generated folk or Burrfolk carries a reserved name over 60 seasons (${reservedHit})`)
ok(swapped > 0, `the fix had work to do (${swapped} reserved draws swapped)`)
ok(renamed === 0, `no Moglin whose drawn name was not reserved changed name (${renamed})`)
ok(dupSeasons === 0, `no two living speakers share a name in any season (${dupSeasons} seasons with a clash)`)
// season 1 on prod: the four reserved names WERE live (Feverfew at s1-3, Chamomile + Angelica at s1-8, Borage at s1-10)
const s1 = (i: number) => folkOf(net.settlements.find(s => s.id === `s1-${i}`)!, 1).map(f => f.name)
ok(![3, 8, 10].some(i => s1(i).some(x => RESERVED_NAMES.has(x))), `season 1 is clean (${s1(3)} | ${s1(8)} | ${s1(10)})`)
ok(s1(10).includes('Basil'), 'Bryonydell keeps Basil (m108 checks lean on it)')
ok(burrfolkOf(net.settlements.find(s => s.id === 's1-10')!, 1)!.name === 'Aster' && burrfolkOf(net.settlements.find(s => s.id === 's1-9')!, 1)!.name === 'Chervil', 'season 1 stall-keepers keep their names (m112 checks)')
ok(freeNames(1) === seasonRoster(1).free && folkCount('s1-0', 1) >= 3, 'freeNames is the roster')

// ── 2. Gleaner's SIGNED lines (batch 11-23b › D1-D4, MAIN), word for word ──
const batch = readFileSync('/root/athernyx/CANON/game/shimmer-lines-batch-2026-11-23b.md', 'utf8')
ok(/✅ SIGNED 2026-11-23/.test(batch), 'the batch is signed')
const d = batch.slice(batch.indexOf('### D1.'), batch.indexOf('### D5.'))
const said = (trigger: string) => new RegExp(`\\[trigger: gleaner:${trigger.replace('.', '\\.')} \\|[^\\]]*\\]\\n(?:\\[SCENE:[^\\n]*\\]\\n)?GLEANER: (.+)`).exec(d)?.[1]
const want: [keyof typeof GLEANER_LINES, string][] = [['stall', 'stall'], ['stallEmpty', 'stall.empty'], ['camp', 'camp'], ['campRepeat', 'camp.repeat'], ['ask', 'ask']]
for (const [k, t] of want) ok(said(t) === GLEANER_LINES[k], `${k} = signed ${t} (${said(t)})`)
ok(d.includes(`GLEANER: ${GLEANER_LINES.greet}\n`) && d.includes(`GLEANER: ${GLEANER_LINES.greetRepeat}\n`), 'D1 greet + repeat are the signed text')
ok(d.includes(`> ${GLEANER_ASK.have}\n`) && d.includes(`> ${GLEANER_ASK.look}\n`), 'D1 answers are the signed text')
ok(Object.values(GLEANER_LINES).every(l => !l.includes('—')), 'no em dashes (Ather side)')
ok(!/\b(she|he|her|his|him)\b/i.test(readFileSync('src/app/shimmer/open/ather/gleaner.ts', 'utf8')), 'gleaner.ts is pronoun-free (Magii #16993)')

// ── 3. the talk: greet -> stall (swaps) -> first swap tells the camp once; second visit tells it if no swap; never follows ──
const post = burrfolkOf(GLEANER_POST, 1)!
ok(isGleaner(post.id) && post.name === GLEANER_NAME && post.stock.length >= 1, 'the post keeps Gleaner, with stock')
ok(folkOf(GLEANER_POST, 1).length === 0, 'the post is no settlement: no folk')
ok(Math.hypot(stallSpot(GLEANER_POST).x - GLEANER_POST.x, stallSpot(GLEANER_POST).z - GLEANER_POST.z) < 0.01, 'the stall stands on the post')
_resetHeard(); _resetGleaner()
let st: FolkTalkState = helloFor(post.id), closed = 0, swaps: string[] = []
const act: FolkTalkActs = { go: s => { st = s }, give: () => {}, recruit: () => { throw new Error('Gleaner never follows') }, bye: () => { closed++ }, barter: k => { swaps.push(k) } }
const talk = () => folkTalk({ folk: [], home: [], trust: freshTrust(), have: () => 0, room: 9, burr: post }, st, act)
let node = talk()
ok(node.line === GLEANER_LINES.greet, `first hello = D1 greet (${node.line})`)
ok(node.options.map(o => o.label).join('|') === [GLEANER_ASK.have, ASK.room, GLEANER_ASK.look].join('|'), `answers: ${node.options.map(o => o.label)}`)
node.options[1].pick(); node = talk()
ok(node.line === GLEANER_LINES.ask, 'asked along = D4, and no recruit')
node.options[0].pick(); node = talk()
ok(st.screen === 'hello' && node.line === GLEANER_LINES.greet, 'Back within the first visit is not a second visit')
node.options[0].pick(); node = talk()
ok(node.line === GLEANER_LINES.stall && node.options.some(o => o.label === BURR_LABEL.swap(post.stock[0])), 'stall = D2 + a swap per row')
node.options[0].pick(); ok(swaps[0] === post.stock[0], 'a swap answer asks for that row')
ok(afterSwap(gleanerMem) === GLEANER_LINES.camp && afterSwap(gleanerMem) === null, 'the first swap tells the camp, once')
ok(gleanerLeave(gleanerMem) === GLEANER_LINES.campRepeat, 'then the leave bark is camp.repeat')
st = helloFor(post.id); node = talk()
ok(node.line === GLEANER_LINES.greetRepeat, `second visit after the camp was told = D1 repeat (${node.line})`)
// no swap on the first visit: the second visit's hello is the camp line
_resetHeard(); _resetGleaner(); st = helloFor(post.id); talk().options[2].pick()
ok(closed === 1 && gleanerLeave(gleanerMem) === null, '"Just looking." leaves, no camp bark yet')
st = helloFor(post.id); node = talk(); const again = talk()
ok(node.line === GLEANER_LINES.camp && again.line === GLEANER_LINES.camp, 'second visit, no swap yet = D3 camp (a rebuilt node says the same)')
node.options[0].pick(); ok(gleanerMem.campTold && afterSwap(gleanerMem) === null, 'told on the answer; a later swap does not repeat it')
st = helloFor(post.id); ok(talk().line === GLEANER_LINES.greetRepeat, 'third visit = D1 repeat')

// ── 4. the camp: out in the Wilds on the Glade side, reachable from the arrival, on land, off every settlement ──
const index = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as IndexLike
const V = makeVoids(index, withGlade(net))
const ra = V.regionAt(ARRIVAL.x, ARRIVAL.z)
ok(ra >= 0 && V.regionAt(BURR_CAMP.x, BURR_CAMP.z) === ra, 'the camp is in the arrival\'s own region (no void to cross)')
let w = 0; for (let dz = -20; dz <= 20; dz += 2) for (let dx = -20; dx <= 20; dx += 2) w = Math.max(w, V.weight(BURR_CAMP.x + dx, BURR_CAMP.z + dz))
ok(w === 0, 'no void within 20 m of the camp')
const dist = Math.hypot(BURR_CAMP.x - ARRIVAL.x, BURR_CAMP.z - ARRIVAL.z)
ok(dist > 60 && dist < 200, `a walk, not a hike, from the arrival (${dist.toFixed(0)} m)`)
ok(!settlementAt(net, BURR_CAMP.x, BURR_CAMP.z), 'the camp is no settlement')
const dm = readFileSync('public/open/wilds/first-wilds.bin'), h = (x: number, z: number) => dm.readInt16LE(2 * (Math.round((z + 500) / 4) * 251 + Math.round((x + 500) / 4))) / 10
ok(campStalls().every(s => h(s.x, s.z) > 1) && h(BURR_CAMP.x, BURR_CAMP.z) > 1, 'the camp stands on land')
ok(CAMP_LABEL === 'Burrfolk camp' && /\(the Burrfolk camp\)/.test(spec), 'the label is canon\'s own word for it, no name')
ok(campStalls().length === 3, 'three stalls')

console.log(`${fails ? '✗' : '✓'} gleaner ${n - fails}/${n}`)
if (fails) process.exit(1)
