/**
 * Where a vessel turns up: the FOUND door (dig) and the WON door (trial), as tables.
 * Run: `npx tsx src/app/shimmer/play3d/vessel-drops.test.ts`
 *
 * ★ WHAT THIS SUITE EXISTS TO CATCH: a found vessel cut for a word this keeper could never bind (off
 * their lane, body-held, or more seats than the tier bears) — a brick with a story. And the hosts:
 * a dig that never rolls, a pickup that puts a vessel in the BAG, a trial that pays twice for one clear.
 */
import { readFileSync } from 'node:fs'
import {
  DROP_TUNING, TRIALS_KEY, vesselItemId, parseVesselItem, isVesselItem, vesselRoom, rollDig, wordPool, chooseWord,
  takeVessel, trialPays, clearTrial, loadTrials, clearTrials,
} from './vessel-drops'
import { loadStowed, isFloor, grantVessel, MAX_PER_KIND, seatCapOf, BAND_FOR_VESSEL, VESSEL_NOUN } from './vessels'
import { lettersOf, isBodyHeld, VESSELS } from './gems'
import { ALL_BANDS, LANE_FOR_KIND, laneRunes } from './cast'
import { KEEPER_MOVES } from './keeper-moves'
import { ELEMENTS, runesOf } from './birth/runes.data'
import { setBirthRune, grantRune, saveRuneInventory, EMPTY_INVENTORY } from './rune-inventory'
import { MAT } from '../voxel/depth'
import { KEEPER_KEYS } from '@/lib/keeper-local'
import { noComments, declAt, declAfter } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const store: Record<string, string> = {}
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem: (k: string) => { delete store[k] },
}
const wipe = () => { for (const k of Object.keys(store)) delete store[k] }
const acquired = () => loadStowed().filter(v => !isFloor(v))
const always = () => 0            // an rng that always says yes / picks the first
const never = () => 0.999999      // an rng that always says no / picks the last
/** an rng that yields the given values in order, then 0.5 */
const seq = (...vals: number[]) => { let i = 0; return () => (i < vals.length ? vals[i++]! : 0.5) }

ok(KEEPER_KEYS.includes(TRIALS_KEY), 'the trial ledger key is registered per keeper')

// ── A. the drop id is the icon family, keyed by the NOUN ────────────────────────────────────
{
  ok(vesselItemId('focus', 2) === 'vessel_glove_t2' && vesselItemId('bracelet', 3) === 'vessel_bracelet_t3', 'ids are vessel_<noun>_t<tier> — the glove, never `focus`')
  for (const k of VESSELS) for (const t of [0, 1, 2, 3] as const) {
    const p = parseVesselItem(vesselItemId(k, t))
    ok(!!p && p.kind === k && p.tier === t, `round-trips ${k} t${t}`)
  }
  ok(parseVesselItem('vessel_focus_t2') === null, '★ the kind id is NOT a vessel item — `vessel_focus_t2` is the grey-chip spelling and parses to nothing')
  ok(parseVesselItem('vessel_glove_t4') === null && parseVesselItem('goldwood_plank') === null && !isVesselItem('stone'), 'a tier past 3 or any ordinary item is not a vessel')
}

// ── B. the dig roll: deep rock only, at its number ──────────────────────────────────────────
{
  ok(rollDig(MAT.DEEP_STONE, always)?.tier === DROP_TUNING.digTier && rollDig(MAT.STONE, always)?.tier === DROP_TUNING.digTier, 'deep stone and stone can give one up, at the dig tier')
  ok(rollDig(MAT.TOPSOIL, always) === null && rollDig(MAT.SAND, always) === null && rollDig(MAT.CUT_STONE, always) === null, '★ soil, sand and cut stone NEVER yield — a vessel is buried in rock, not lying in a garden bed')
  ok(rollDig(MAT.DEEP_STONE, never) === null, 'and rock almost always gives nothing')
  const kinds = new Set([rollDig(MAT.STONE, seq(0, 0))?.kind, rollDig(MAT.STONE, seq(0, 0.99))?.kind])
  ok(kinds.has('bracelet') && kinds.has('focus'), 'the second roll picks the kind — both kinds can turn up')
  // ★ the numbers, so a nudge is a diff: 1/250 deep, 1/800 stone
  ok(DROP_TUNING.dig[MAT.DEEP_STONE]! > DROP_TUNING.dig[MAT.STONE]!, 'deeper rock is likelier — depth is the cost')
  let n = 0; const rng = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647 } })()
  for (let i = 0; i < 20000; i++) if (rollDig(MAT.DEEP_STONE, rng)) n++
  ok(n > 40 && n < 130, `at 1/250, 20k deep blocks give ~80 (got ${n}) — a table that never fires is decoration`)
}

// ── C. ★ the word a found vessel is cut for is one THIS keeper could ever bind ──────────────
{
  wipe()
  // a birth with a stretch word available: a two-rune element-lane tactical the keeper does not fully own
  let pick: { birth: string; ready: string; stretch: string } | null = null
  for (const e of ELEMENTS) for (const r of runesOf(e.id)) {
    const lane = laneRunes(r.id, 'element')
    const pool = KEEPER_MOVES.filter(m => m.tier === 'tactical' && !isBodyHeld(m, r.id) && !m.birthExclusive && m.runes.every(x => lane.has(x)))
    const ready = pool.find(m => m.runes.length === 1)
    const stretch = pool.find(m => m.runes.length === 2 && ready && !m.runes.includes(ready.runes[0]!))
    if (ready && stretch) { pick = { birth: r.id, ready: ready.id, stretch: stretch.id }; break }
  }
  ok(!!pick, `fixture: a birth with a ready one-letter word and a stretch two-letter word on its element lane (${pick ? `${pick.birth}: ${pick.ready} / ${pick.stretch}` : 'none'})`)
  if (pick) {
    const { birth, ready, stretch } = pick
    const readyRune = KEEPER_MOVES.find(m => m.id === ready)!.runes[0]!
    let inv = setBirthRune(EMPTY_INVENTORY, birth); inv = grantRune(inv, readyRune); saveRuneInventory(inv)
    const lane = laneRunes(birth, 'element')
    const pool = wordPool('bracelet', 2, birth)
    ok(pool.length > 0 && pool.every(m => m.tier === 'tactical'), 'the bracelet pool is tacticals')
    ok(pool.every(m => m.runes.every(r => lane.has(r))), '★ every word is ON THE LANE — an off-lane word could never be bound, so it is never cut')
    ok(pool.every(m => lettersOf(m, birth).length >= 1), '★ no body-held word — it needs no paper')
    ok(pool.every(m => !m.birthExclusive || m.birthExclusive === birth), 'no other birth\'s exclusive')
    ok(wordPool('bracelet', 0, birth).every(m => lettersOf(m, birth).length <= seatCapOf(0)), '★ the floor tier\'s pool is one-letter words only — seats fit the tier')
    ok(wordPool('focus', 2, birth).every(m => m.tier === 'ultimate'), 'the glove pool is ultimates — the kind gates the band')
    // weighting: with the roll at 0 the FIRST pool entry wins; ready words weigh more, so a roll just past the
    // ready mass lands on a stretch word. Assert the mechanism, not a particular word.
    const weights = pool.map(m => (m.runes.every(r => inv.owned.includes(r)) ? DROP_TUNING.readyWeight : DROP_TUNING.stretchWeight))
    const total = weights.reduce((a, b) => a + b, 0)
    ok(weights.includes(DROP_TUNING.readyWeight) && weights.includes(DROP_TUNING.stretchWeight), 'fixture: the pool holds both ready and stretch words')
    const picks = new Set<string>()
    for (let i = 0; i < 40; i++) picks.add(chooseWord('bracelet', 2, inv.owned, birth, () => i / 40)!)
    ok(picks.size > 1, '★ different rolls choose different words — the pool is weighted, not fixed')
    ok([...picks].every(id => pool.some(m => m.id === id)), 'and every choice is from the pool')
    ok(pool.some(m => m.id === stretch) && [...picks].includes(stretch), '★ a STRETCH word (runes not yet owned) CAN be chosen — "some of which they grow into"')
    // a word that already has a vessel is avoided while another is possible
    wipe(); saveRuneInventory(inv)
    const first = chooseWord('bracelet', 2, inv.owned, birth, always)!
    ok(grantVessel('bracelet', 1, first, 'bought').ok, `a vessel for ${first} exists`)
    const second = chooseWord('bracelet', 2, inv.owned, birth, always)
    ok(second !== null && second !== first, '★ the same roll now avoids the word that already has a vessel')
    // the whole pool taken → duplicates allowed rather than nothing
    wipe(); saveRuneInventory(inv)
    ok(chooseWord('bracelet', 2, inv.owned, birth, never) !== null, 'the last roll still returns a word')

    // ── D. taking one off the ground: satchel, tier, door line, the cap ──
    wipe(); saveRuneInventory(inv)
    const t = takeVessel(vesselItemId('bracelet', 2), 'dig', inv.owned, birth, always)
    ok(t.ok && acquired().length === 1 && acquired()[0]!.tier === 2 && acquired()[0]!.kind === 'bracelet', '★ a dug vessel lands in the SATCHEL at tier 2 — never in the bag')
    ok(!!acquired()[0]!.move && pool.some(m => m.id === acquired()[0]!.move), 'cut for a word from the pool — finding one is inheriting an intention')
    ok(/^Dug out of the rock — a bracelet of shimmerscale/.test(t.say) && /found/.test(t.say), `the line says the door and the material (${t.say})`)
    ok(takeVessel('goldwood_plank', 'dig', inv.owned, birth).ok === false, 'an ordinary item is refused by name')
    ok(vesselRoom('bracelet') && grantVessel('bracelet', 1, null, 'bought').ok && grantVessel('bracelet', 1, null, 'bought').ok && !vesselRoom('bracelet'),
       'three acquired bracelets: no room')
    ok(takeVessel(vesselItemId('bracelet', 2), 'dig', inv.owned, birth).why === 'at-cap' && acquired().length === MAX_PER_KIND, '★ at the cap the pickup is refused — the drop stays on the ground')
    ok(vesselRoom('focus'), 'and the glove has its own room')

    // ── E. the trial: first clear sure, then a roll; once per clear; the ledger survives ──
    wipe(); saveRuneInventory(inv)
    ok(trialPays(0, never) === true, '★ the FIRST clear is a sure prize')
    ok(trialPays(1, never) === false && trialPays(1, always) === true, 'later clears roll trialAgain')
    const c1 = clearTrial('puppet-guards', inv.owned, birth, 'focus', never)
    ok(c1.paid && c1.clears === 1 && acquired().some(v => v.kind === 'focus' && v.tier === 3), '★ the first clear hands a tier-3 GLOVE through the won door')
    ok(/^The trial's prize — a glove of starwillow/.test(c1.say) && /won/.test(c1.say), `the line says the door and the material (${c1.say})`)
    ok(loadTrials()['puppet-guards'] === 1, 'the ledger counts the clear')
    const c2 = clearTrial('puppet-guards', inv.owned, birth, 'focus', never)
    ok(!c2.paid && c2.clears === 2 && acquired().filter(v => v.kind === 'focus').length === 1, '★ a second clear on a bad roll pays nothing — and still counts')
    const c3 = clearTrial('puppet-guards', inv.owned, birth, 'focus', always)
    ok(c3.paid && acquired().filter(v => v.kind === 'focus' && v.tier === 3).length === 2, 'a second clear on a good roll pays')
    ok(clearTrial('puppet-guards', inv.owned, birth, 'focus', always).paid && !vesselRoom('focus'), 'a third — at the cap now')
    const c5 = clearTrial('puppet-guards', inv.owned, birth, 'focus', always)
    ok(!c5.paid && /all the gloves a keeper can/.test(c5.say) && loadTrials()['puppet-guards'] === 5, '★ at the cap the prize is SAID and not given, and the clear still counts')
    clearTrials(); ok(loadTrials()['puppet-guards'] === undefined, 'clearTrials wipes the ledger (a rebirth)')
    store[TRIALS_KEY] = '{"puppet-guards":"three"}'
    ok(loadTrials()['puppet-guards'] === undefined, 'a corrupt ledger reads as no clears, not a crash')
  }
}

// ── F. the hosts: the dig in the voxel world, the pickup into the satchel, the trial in the range ──
{
  const W = noComments(readFileSync(new URL('../voxel3d/VoxelWorld.tsx', import.meta.url), 'utf8'))
  // ⚠ THE COORDINATE TAIL IS MATCHED LOOSELY ON PURPOSE. This pinned `hit.z)` exactly and went red
  // the day the drop grew a provenance argument (`hit.z, 'dig')`) — a red that was entirely about
  // punctuation while the behaviour it guards never moved. A test that goes red for that reason
  // teaches its readers to discount red, which costs more than the precision was worth.
  ok(/const dug = rollDig\(hit\.material\)/.test(W) && /spawnDrop\(vesselItemId\(dug\.kind, dug\.tier\), 1, hit\.x, hit\.y, hit\.z[,)]/.test(W),
     '★ breaking a block ROLLS the dig and spawns the vessel as a drop, through the real drop system')
  // ★ THE CACHE — the FOUND road's other door. A cache always gives, so there is no roll to assert;
  // what must be true is that it goes through the SAME drop system rather than teleporting a vessel
  // into the satchel, and that it is tagged so the pickup can tell the two doors apart.
  ok(/hit\.material === MAT\.CACHE/.test(W) && /spawnDrop\(vesselItemId\(held\.kind, held\.tier\), 1, hit\.x, hit\.y, hit\.z, 'cache'\)/.test(W),
     '★ breaking a cache spawns its vessel as a drop, tagged `cache`, through the real drop system')
  const digAt = W.indexOf('const dug = rollDig(')
  const dropsForAt = W.lastIndexOf('dropsFor(hit.material)', digAt)
  ok(dropsForAt >= 0 && digAt - dropsForAt < 400, 'and the roll sits beside the ordinary block drops, not in a second break path')
  ok(/parseVesselItem\(itemId\); return v \? \(vesselRoom\(v\.kind\) \? 1 : 0\) : roomFor\(/.test(W),
     '★ the pickup CAPACITY gate asks the satchel for a vessel and the bag for everything else — at the cap the drop stays')
  const pickAt = W.indexOf('for (const it of res.picked)')
  const pick = pickAt >= 0 ? W.slice(pickAt, pickAt + 900) : ''
  ok(/if \(parseVesselItem\(it\.itemId\)\)/.test(pick) && /takeVessel\(it\.itemId,/.test(pick) && /continue/.test(pick),
     '★ a picked-up vessel is TAKEN into the satchel and never reaches `give` — the bag would have stacked a glove like a plank')
  // ★★ AND THE DOOR RIDES ON THE DROP RATHER THAN BEING ASSUMED. This was the literal `'dig'` until
  // the cache road landed, at which point every cached vessel would have been announced as dug out
  // of rock — the copy is the only place the two roads differ to a player, so hardcoding the door
  // silently deletes the difference. The `?? 'dig'` fallback keeps a pre-provenance drop behaving
  // exactly as it did.
  ok(/takeVessel\(it\.itemId, \(it\.from \?\? 'dig'\)/.test(pick),
     "★ the pickup relays the DROP's own door, so a cache does not announce itself as a dig")
  ok(pick.indexOf('takeVessel(') < pick.indexOf('give(inv.current!'), 'the vessel branch comes BEFORE the bag branch')
  ok(/if \(r\.ok\) onVesselFound\(\)/.test(pick) && /onVesselFound=\{\(\) => setRuneTick\(t => t \+ 1\)\}/.test(W),
     'and the host bumps runeTick so the satchel re-reads the stowed list')
  ok(count(W, /VESSEL_NOUN: Record<Vessel, string>/g) === 0 && /VESSEL_NOUN,? .*from '\.\.\/play3d\/vessels'/.test(W.split('\n').find(l => /from '\.\.\/play3d\/vessels'/.test(l) && /VESSEL_NOUN/.test(l)) ?? ''),
     '★ the noun is IMPORTED from the model, not declared again in the host — one spelling')

  const S = noComments(readFileSync(new URL('./Shimmer3D.tsx', import.meta.url), 'utf8'))
  const rangeAt = declAt(S, 'FiringRange')
  const range = rangeAt >= 0 ? S.slice(rangeAt, declAfter(S, 'GunBenches', rangeAt)) : ''
  ok(range.length > 0, 'Shimmer3D has a FiringRange')
  ok(/gs\.enc = stepEncounter\(/.test(range) && /if \(gs\.enc\.cleared && !gs\.prized\)/.test(range) && /gs\.prized = true/.test(range),
     '★ the trial pays on the EDGE into cleared, once — `prized` latches so a cleared encounter stepping every frame cannot pay every frame')
  ok(/clearTrial\('puppet-guards'/.test(range), 'through clearTrial, the won door')
  ok(count(range, /gs\.prized = false/g) >= 1 && range.indexOf('gs.prized = false') < range.indexOf('gs.enc = stepEncounter('),
     'and the latch is released when the encounter is re-armed, so the NEXT clear can pay (and is counted)')
  ok(/onTrial\(/.test(range), 'the range hands the line up — it has no banner of its own')
}
function count(s: string, re: RegExp): number { return (s.match(re) ?? []).length }

console.log(`vessel-drops: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
