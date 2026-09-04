/**
 * THE FIXTURE'S OWN GUARD — because a fixture that lies does so at the exact moment someone looks.
 *
 * ★ THE POINT OF THIS FILE. `panel-fixture.ts` exists so a human can answer a question no assert can
 * ("does a dark seat read as unwritten?"). That inverts the usual risk: nobody will be checking the
 * numbers while they look at the picture, so a scenario labelled *one letter seated* that actually
 * seats three would be believed, and the wrong read would be banked as a design finding. Every
 * scenario therefore has to prove it builds the keeper its label claims.
 *
 * ★ AND THE ROUND-TRIP IS THE ONE THAT MATTERS: section E seeds through the real save functions and
 * reads back through `keeperLetters` — the exact call the rack makes. A fixture that agrees only with
 * itself is the 2026-08-22 hand-kept-mirror; this asserts the shipped READER sees what was written.
 *
 * Run: `npx tsx src/app/shimmer/play3d/panel-fixture.test.ts`
 */
import { PANEL_SCENARIOS, planPanel, seedPanel, type PanelScenarioId } from './panel-fixture'
import { VESSEL_CAP, VESSELS, isBodyHeld, lettersOf } from './gems'
import { KEEPER_MOVES, moveById } from './keeper-moves'
import { ALL_BANDS, laneRunes } from './cast'
import { resolveLoadout } from './loadout'
import { BAND_FOR_VESSEL } from './vessels'
import { keeperBook, keeperLetters } from './book'
import { loadStowed } from './vessels'
import { loadRuneInventory } from './rune-inventory'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const store: Record<string, string> = {}
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
}
const wipe = () => { for (const k of Object.keys(store)) delete store[k] }

// ── A. the roster is whole ───────────────────────────────────────────────────────────────────
{
  const ids = PANEL_SCENARIOS.map(s => s.id)
  ok(new Set(ids).size === ids.length, 'no scenario id appears twice')
  ok(PANEL_SCENARIOS.every(s => s.asks.trim().length > 0 && s.asks.includes('?')),
     '★ every scenario states the QUESTION it exists to have answered — a page of pictures with no question is decoration')
  for (const s of PANEL_SCENARIOS) {
    const p = planPanel(s.id)
    ok(p.id === s.id, `${s.id}: the plan answers to its own id`)
    ok(!!p.birth, `${s.id}: a birth rune was found in the registry`)
    ok(p.slots.length === ALL_BANDS.length, `${s.id}: the loadout is band-shaped`)
    for (const k of VESSELS) ok(p.worn[k].length <= VESSEL_CAP, `${s.id}: the ${k} never exceeds the cap`)
  }
}

// ── B. ★ each scenario builds the keeper its LABEL claims ────────────────────────────────────
{
  const fresh = planPanel('fresh')
  ok(VESSELS.every(k => fresh.worn[k].length === 0), '★ fresh: nothing seated — this is the six-dark-seats case, and an empty one is the whole read')
  ok(Object.keys(fresh.bag).length === 0, 'fresh: the bag is empty too')
  ok(fresh.slots.every(s => s === null), 'fresh: no word is bound')

  const loose = planPanel('loose')
  ok(Object.values(loose.bag).reduce((a, b) => a + b, 0) > 0, '★ loose: letters ARE held — otherwise it is just `fresh` under a second name')
  ok(VESSELS.every(k => loose.worn[k].length === 0), 'loose: and none of them are seated')

  const partial = planPanel('partial')
  ok(partial.worn.bracelet.length === 1, '★★ partial: EXACTLY one letter seated — the hard read this page exists for')
  ok(VESSEL_CAP > 1, 'partial: the cap leaves dark seats beside it')
  ok(partial.worn.focus.length === 0, 'partial: the focus stays dark, so one row is mixed and one is empty')

  const written = planPanel('written')
  ok(written.worn.bracelet.length > 0 || written.why.includes('no bracelet word'),
     '★ written: a word is actually seated, or the plan SAYS the registry held none — never silently dark under this label')
  const anyWord = written.slots.some(s => s !== null)
  ok(anyWord || written.why.includes('no '), 'written: a word is bound, or the reason is stated')

  const rack = planPanel('rack')
  ok(rack.spares.length >= 2, '★ rack: there are spares to choose between')
  ok(rack.spares.every(v => v.gems.length <= VESSEL_CAP), 'rack: no spare exceeds the cap')
  ok(new Set(rack.spares.map(v => v.gems.length)).size > 1 || rack.why.includes('no second element word'),
     '★ rack: the spares differ in fill (or the plan says the registry could not) — identical spares cannot show that a word is what you read')
}

// ── C. ★★ NOTHING IS INVENTED — every seated gem is a letter a real move needs ────────────────
{
  // The anti-mirror assert. A fixture free to seat arbitrary rune ids would render vessels no keeper
  // can reach, and an eye trained on an impossible state is worse than no eye at all.
  for (const s of PANEL_SCENARIOS) {
    const p = planPanel(s.id)
    for (const k of VESSELS) for (const g of p.worn[k]) {
      const needed = KEEPER_MOVES.some(m => !isBodyHeld(m, p.birth) && lettersOf(m, p.birth).includes(g))
      ok(needed, `★★ ${s.id}: the ${k}'s ${g} is a letter some real move needs — not an id picked by hand`)
    }
    for (const v of p.spares) for (const g of v.gems) {
      const needed = KEEPER_MOVES.some(m => !isBodyHeld(m, p.birth) && lettersOf(m, p.birth).includes(g))
      ok(needed, `★★ ${s.id}: the spare's ${g} is a real letter`)
    }
    for (const v of p.spares) if (v.move) ok(!!moveById(v.move), `${s.id}: the spare's word ${v.move} exists in the registry`)
    p.slots.forEach((id, i) => { if (id) ok(!!moveById(id), `${s.id}: band ${i}'s word ${id} exists`) })
  }
}

// ── D. a bound word sits in ITS OWN vessel's band ────────────────────────────────────────────
{
  const p = planPanel('written')
  for (const k of VESSELS) {
    const band = BAND_FOR_VESSEL[k]
    if (band >= 0 && p.worn[k].length > 0 && p.slots[band]) {
      const m = moveById(p.slots[band]!)!
      ok(lettersOf(m, p.birth).every(r => p.worn[k].includes(r)),
         `★ written: the ${k}'s word is spelled by the letters seated IN the ${k} — the vessel is the paper`)
    }
  }
}

// ── E. ★★★ THE ROUND TRIP: what the fixture writes is what the SHIPPED reader reads back ─────
{
  for (const id of ['fresh', 'partial', 'written', 'rack'] as PanelScenarioId[]) {
    wipe()
    const plan = seedPanel(id)
    // `keeperLetters` is the exact call VesselRack makes for the worn seats.
    const read = keeperLetters(plan.owned, plan.birth)
    for (const k of VESSELS) {
      ok(read.vessels[k].join(',') === plan.worn[k].join(','),
         `★★★ ${id}: the ${k}'s seats read back exactly as seeded (${read.vessels[k].length} of ${VESSEL_CAP}) — the panel will show this keeper, not another`)
    }
    ok(loadStowed().length === plan.spares.length, `${id}: the rack reads back ${plan.spares.length} spare(s)`)
    const inv = loadRuneInventory()
    ok(inv.birth === plan.birth, `${id}: the birth rune reads back`)
  }
  wipe()
}

// ── F. ★ planPanel is PURE — it must not read or write storage ───────────────────────────────
{
  // Structural, not by inspection: hand it a storage that THROWS. If the plan touches it, this dies.
  const real = (globalThis as unknown as { localStorage: unknown }).localStorage
  ;(globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: () => { throw new Error('planPanel read storage') },
    setItem: () => { throw new Error('planPanel wrote storage') },
    removeItem: () => { throw new Error('planPanel cleared storage') },
  }
  let threw: string | null = null
  try { for (const s of PANEL_SCENARIOS) planPanel(s.id) } catch (e) { threw = (e as Error).message }
  ;(globalThis as unknown as { localStorage: unknown }).localStorage = real
  ok(threw === null, `★ planPanel touches no storage (${threw ?? 'clean'}) — the plan is assertable without a browser, which is why the guard above can exist`)
}

// ── G. ★★ THE SCENARIOS MUST LOOK DIFFERENT FROM EACH OTHER ─────────────────────────────────
{
  // ★★ THIS SECTION EXISTS BECAUSE THE FIRST CUT FAILED IT SILENTLY. `written` took the first word
  // each lane offered; for that birth it was a ONE-letter word, so `written` and `partial` rendered
  // the SAME picture — one lit seat beside two dark — under two labels claiming opposite things. All
  // 71 asserts were green, because each only checked its own scenario in isolation. A fixture whose
  // scenarios cannot be told apart teaches an eye nothing, and the label is what gets believed.
  const partial = planPanel('partial')
  const written = planPanel('written')
  const seats = (p: ReturnType<typeof planPanel>) => VESSELS.reduce((n, k) => n + p.worn[k].length, 0)
  ok(seats(written) > seats(partial),
     `★★ written (${seats(written)} seated) and partial (${seats(partial)}) are DIFFERENT pictures — two labels showing one image is the failure this file was written after`)

  // An INDEPENDENT derivation of the richest word available, computed here rather than by calling the
  // fixture's own `richestIn` — comparing a thing to itself proves only that it is itself.
  const maxFor = (birth: string, tier: string, lane: 'element' | 'state') => {
    let most = 0
    for (const m of KEEPER_MOVES) {
      if (m.tier !== tier || isBodyHeld(m, birth) || m.runes.length === 0) continue
      if (!m.runes.every(x => laneRunes(birth, lane).has(x))) continue
      const n = lettersOf(m, birth).length
      if (n > most && n <= VESSEL_CAP) most = n
    }
    return most
  }
  ok(written.worn.bracelet.length === maxFor(written.birth, 'tactical', 'element'),
     `★ written seats every letter the richest bracelet word for ${written.birth} allows (${written.worn.bracelet.length} of a possible ${maxFor(written.birth, 'tactical', 'element')})`)
  ok(written.worn.focus.length === maxFor(written.birth, 'ultimate', 'state'),
     `★ written seats every letter the richest focus word allows (${written.worn.focus.length} of a possible ${maxFor(written.birth, 'ultimate', 'state')})`)
  ok(VESSELS.some(k => written.worn[k].length === VESSEL_CAP),
     `★★ at least one vessel in 'written' is FULL — otherwise no scenario on this page ever shows a vessel with no dark seat, and "full" is the control the dark read is judged against`)
}

// ── H. ★★★ THE WORD ACTUALLY HOLDS — asserted through the SHIPPED resolver ──────────────────
{
  // ★★★ THIS SECTION EXISTS BECAUSE A SCREENSHOT FOUND WHAT 80 ASSERTS COULD NOT. Sections B-E all
  // passed on a `written` keeper whose vessels said "no word": the letters were seated, the band was
  // set, and the fixture owned only its birth rune — so `keeperBook` never held the move and
  // `resolveLoadout` unbound it on read. Every assert was about what the fixture WROTE; none asked
  // the shipped resolver what a keeper would actually get back. Ask it here, in world terms.
  for (const id of ['written', 'rack'] as PanelScenarioId[]) {
    wipe()
    const plan = seedPanel(id)
    const resolved = resolveLoadout([...plan.owned], plan.birth, keeperBook(plan.owned))
    plan.slots.forEach((want, band) => {
      if (!want) return
      ok(resolved.slots[band] === want,
         `★★★ ${id}: band ${band} still holds ${want} after the real resolve (got ${resolved.slots[band] ?? 'EMPTY'}) — a seated letter with no word is the picture this caught`)
    })
    for (const k of VESSELS) if (plan.worn[k].length > 0) {
      const band = BAND_FOR_VESSEL[k]
      ok(band >= 0 && resolved.slots[band] !== null,
         `★★ ${id}: the ${k} carries a word, not just letters`)
    }
  }
  wipe()
}

console.log(`panel-fixture: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
