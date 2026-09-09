/**
 * THE PANEL FIXTURE — a keeper, fabricated, so the inventory panel can be LOOKED AT.
 *
 * ★ WHY THIS EXISTS. Every GBOARD block written between 2026-09-03 and 2026-09-04 carries the same
 * stamp: **NOT LOOKED AT**. The vessels ruling, the letters card split, the three-tab shell, the
 * seats — all of it is covered by headless asserts and none of it has been seen rendered. The reason
 * was mechanical, not neglect: the only road to a written vessel ran through play. Earn 75 Marks,
 * buy a bracelet at the Passage, imbue a crystal, bind a word. That is a twenty-minute round trip to
 * answer a question that takes two seconds of looking — *does a dark seat read as UNWRITTEN?*
 *
 * The brief asks for a read, and a read can only be checked by a human eye:
 *   "an empty seat is dark and visibly empty — a player reads how loaded a keeper is from across
 *    the square."
 * No assert in this repo can answer that. This file removes the twenty minutes.
 *
 * ★ IT SEEDS THROUGH THE REAL SAVE FUNCTIONS AND RENDERS THE REAL COMPONENTS. Nothing here draws a
 * seat, prices a vessel, or decides which lane a rune sits in. `seedPanel` writes state with
 * `saveLetters` / `saveStowed` / `saveLoadout` / `saveRuneInventory` and then the shipped panel reads
 * it back the way it reads any keeper. ⚠ That is deliberate and it is the whole point: a fixture that
 * drew its own seats would be a second dialect of the render, agreeing with itself and drifting from
 * what ships — the 2026-08-22 hand-kept-mirror shape, which manufactures a green precisely when
 * somebody goes looking. What you see on this page is the panel, or it is a bug in the panel.
 *
 * ⚠ NOTHING IS HAND-PICKED. Every rune, move and word below is SEARCHED out of the live registries.
 * This lane already paid for the alternative on 2026-09-03: a fixture assumed tempest+freeze had a
 * written element-lane tactical, the registry said otherwise, and the assert was testing a world that
 * does not exist. `planPanel` searches; if the registry cannot satisfy a scenario it says so in
 * `why` and returns the closest honest thing, rather than naming an id and hoping.
 *
 * ★ PURE PLAN, THIN WRITE — the split is load-bearing. `planPanel` touches no storage, so a headless
 * test asserts exactly the keeper a scenario claims to build; `seedPanel` only writes what the plan
 * decided. The two cannot describe different keepers, which is the same reasoning `resolveLoadout`
 * uses to keep a slot's binds and its reasons in one pass.
 *
 * Run the guard: `npx tsx src/app/shimmer/play3d/panel-fixture.test.ts`
 */
import {
  EMPTY_LETTERS, VESSEL_CAP, VESSELS, addGems, bindLetters, isBodyHeld, lettersOf, saveLetters,
  type GemStock, type Letters, type Vessel,
} from './gems'
import { BAND_FOR_VESSEL, emptyVessel, saveStowed, type StowedVessel } from './vessels'
import { KEEPER_MOVES, moveById } from './keeper-moves'
import { ALL_BANDS, laneRunes } from './cast'
import { saveLoadout, type Loadout } from './loadout'
import { saveRuneInventory } from './rune-inventory'
import { saveBook } from './book'
import { ELEMENTS, runesOf } from './birth/runes.data'

export type PanelScenarioId = 'fresh' | 'loose' | 'dark' | 'partial' | 'written' | 'rack'

export interface PanelScenario {
  id: PanelScenarioId
  label: string
  /** the question this scenario exists so a human can answer by looking. Rendered on the page. */
  asks: string
}

/**
 * ★ THE ORDER IS THE ARGUMENT, and it runs from empty to full on purpose. `fresh` is the pure form
 * of the question (six dark seats and nothing else), `partial` is the hardest read (one lit beside
 * two dark, in one row, which is where a placeholder either works or does not), and `written` is the
 * control that proves a lit seat looks like anything at all. Read them in order and the seat either
 * carries the count or it does not.
 */
export const PANEL_SCENARIOS: readonly PanelScenario[] = [
  // ⚠ `fresh` NO LONGER ASKS THE SEAT QUESTION, and that is the 2026-09-04 amendment landing.
  // A vessel bears the seats its word needs, so a keeper who owns no vessel has no seats to draw —
  // this scenario used to promise "six dark seats" and now honestly shows none. The seat question
  // moved to `dark`, which is a vessel that EXISTS with nothing written in it.
  { id: 'fresh',   label: 'fresh keeper',      asks: 'No vessel owned yet. Does the panel read as NOTHING YET, or as something missing?' },
  { id: 'loose',   label: 'letters, unwritten', asks: 'Gems in the bag, none seated. Is it obvious the letters are held but not written?' },
  { id: 'dark',    label: 'a vessel, unwritten', asks: 'A vessel made for a word, every seat dark. Does a dark seat read as UNWRITTEN, or as broken?' },
  { id: 'partial', label: 'one letter seated', asks: 'One lit beside the rest dark, in one row. THE hard read: does the row say 1 OF ITS OWN NUMBER?' },
  { id: 'written', label: 'a word written',    asks: 'Three lit, no dark. Does a full vessel look full at a glance?' },
  { id: 'rack',    label: 'a rack of spares',  asks: 'Worn plus spares at different fills. Can you pick a vessel by reading its word?' },
]

export interface PanelPlan {
  id: PanelScenarioId
  birth: string
  owned: string[]
  /** what sits in each WORN vessel. Fewer than `VESSEL_CAP` entries means the rest render dark. */
  worn: Record<Vessel, string[]>
  /** every other vessel of that kind, with what is written on it — the rack's spare row. */
  spares: StowedVessel[]
  /** loose letters, held and unwritten */
  bag: GemStock
  /** the word bound per band, parallel to `ALL_BANDS` */
  slots: Loadout
  /**
   * The word each WORN vessel was made for, whether or not the loadout currently binds it.
   *
   * ★ WHY THIS IS NOT `slots` (2026-09-09). The brief was amended 2026-09-04: *"each vessel is
   * unique with a job … if the move it's meant to represent has one slot then it only needs the one
   * slot."* Seats come from the WORD, so anything drawing seats has to know the word — and `slots`
   * is the wrong source, because a vessel keeps its word while the loadout is unbound. `partial`
   * is exactly that case: one letter of a three-letter word, deliberately unbound, in a vessel that
   * still bears three seats. Reading `slots` there gives ZERO seats and one gem floating in a
   * vessel that cannot hold it — the impossible state this file's header forbids.
   */
  wordFor: Record<Vessel, string | null>
  /** what the registry actually allowed, in words — read it before believing the scenario. */
  why: string
}

/** a birth rune and the words its two lanes can actually write, SEARCHED out of the registry. */
interface Birthable {
  birth: string
  /** a tactical written entirely in the element lane — the bracelet's word */
  tac: string | null
  /** an ultimate written entirely in the state lane — the focus's word */
  ult: string | null
}

/**
 * Find a birth whose lanes hold real words, preferring one that can write BOTH vessels.
 *
 * ⚠ A move written in the birth rune alone is deliberately rejected here (`isBodyHeld`): it needs no
 * gem and no vessel, which is canon's floor keeping the gem economy from eating selfhood — and a
 * scenario built on one would seat nothing and quietly show six dark seats under the label "a word
 * written". The whole page would then be lying in the one place it is supposed to be looked at.
 */
function findBirthable(): Birthable {
  let best: Birthable | null = null
  let bestScore = -1
  for (const e of ELEMENTS) for (const r of runesOf(e.id)) {
    const birth = r.id
    const tac = richestIn(birth, 'tactical', 'element')
    const ult = richestIn(birth, 'ultimate', 'state')
    const cand: Birthable = { birth, tac: tac?.id ?? null, ult: ult?.id ?? null }
    // ★ SCORED BY SEATS FILLED, NOT BY "a word exists". The first cut took the first move each lane
    // offered, and for `manalic` that was a ONE-letter word — so the scenario labelled *a word
    // written* rendered one lit seat beside two dark, a picture identical to `partial`. Two scenarios
    // showing the same thing under different labels is precisely the fixture lying at the moment
    // someone looks. Both vessels must be writable first, then as full as the registry allows.
    const seats = (tac ? lettersOf(tac, birth).length : 0) + (ult ? lettersOf(ult, birth).length : 0)
    const score = (cand.tac && cand.ult ? 1000 : 0) + seats
    if (score > bestScore) { best = cand; bestScore = score }
  }
  return best ?? { birth: ELEMENTS[0] ? runesOf(ELEMENTS[0].id)[0]!.id : 'ember', tac: null, ult: null }
}

/**
 * The word of this tier and lane that seats the MOST letters for this birth, up to the cap.
 *
 * ⚠ `> most` and not `>=` on purpose: ties keep the registry's own order, so the choice is stable
 * across runs and a scenario does not silently change picture when an unrelated move is added.
 */
export function richestIn(birth: string, tier: string, lane: 'element' | 'state') {
  const allowed = laneRunes(birth, lane)
  let best: (typeof KEEPER_MOVES)[number] | null = null
  let most = 0
  for (const m of KEEPER_MOVES) {
    if (m.tier !== tier || isBodyHeld(m, birth) || m.runes.length === 0) continue
    if (!m.runes.every(x => allowed.has(x))) continue
    const n = lettersOf(m, birth).length
    if (n > most && n <= VESSEL_CAP) { best = m; most = n }
  }
  return best
}

/** the band a vessel's word occupies, or -1 — asked of the registry, never restated as a number. */
const bandOf = (kind: Vessel) => BAND_FOR_VESSEL[kind]

/**
 * Build the keeper a scenario describes. PURE — no storage, no React, no clock.
 *
 * ★ THE LETTERS ARE DERIVED FROM THE WORD, never invented: `lettersOf` is what the bind itself reads,
 * so a seated gem here is a gem the real `bindLetters` would have seated. A scenario that hardcoded
 * three rune ids would seat letters no word needs and the panel would render a vessel no keeper can
 * reach — which is exactly the kind of impossible state a fixture must never teach an eye to accept.
 */
export function planPanel(id: PanelScenarioId): PanelPlan {
  const { birth, tac, ult } = findBirthable()
  const owned = [birth]
  const slots: Loadout = ALL_BANDS.map(() => null)
  const worn: Record<Vessel, string[]> = { bracelet: [], focus: [] }
  const wordFor: Record<Vessel, string | null> = { bracelet: null, focus: null }
  const spares: StowedVessel[] = []
  let bag: GemStock = {}
  const notes: string[] = [`birth ${birth}`]

  /** seat a word's letters in its vessel and bind it, exactly as a keeper would have. */
  const write = (kind: Vessel, moveId: string | null): string[] => {
    const m = moveId ? moveById(moveId) : null
    if (!m) { notes.push(`no ${kind} word in the registry for ${birth} — that vessel stays dark`); return [] }
    const need = lettersOf(m, birth)
    let l: Letters = EMPTY_LETTERS
    for (const r of need) l = addGems(l, r)
    const bound = bindLetters(l, kind, m, birth)
    if (!bound) { notes.push(`${m.id} would not bind to the ${kind} — left dark rather than faked`); return [] }
    // ★★ THE KEEPER MUST KNOW THE WORD, NOT MERELY HOLD ITS LETTERS (found by LOOKING, 2026-09-04).
    // The first cut seated the letters and set the band, and every assert passed — but `owned` was
    // the birth rune alone, so `keeperBook` never contained the move and the shipped panel resolved
    // the slot to EMPTY. On screen: two lit seats, "no word", and the cast bar reading *"what was
    // here no longer fits, so it was unbound"* under a scenario labelled *a word written*. A keeper
    // holding letters for a word they cannot know is exactly the impossible state this file's header
    // forbids teaching an eye to accept. The runes ARE the knowing; grant them with the letters.
    for (const r of m.runes) if (!owned.includes(r)) owned.push(r)
    const band = bandOf(kind)
    if (band >= 0) slots[band] = m.id
    // ★ The vessel bears this word from here on, even if a scenario later unbinds the BAND.
    wordFor[kind] = m.id
    // ⚠ NOT `/${VESSEL_CAP}`. Three is the most a word can ask for, not a property every vessel
    // has (brief, amended 2026-09-04) — so the word's own letter count IS the seat count, and a
    // denominator of 3 was this note asserting the pre-amendment shape.
    notes.push(`${kind}: ${m.id} (${need.length} seat${need.length === 1 ? '' : 's'})`)
    return bound.vessels[kind]
  }

  if (id === 'loose') {
    // held but unwritten: the letters a word WOULD need, sitting in the bag with nothing seated.
    const m = (tac && moveById(tac)) || null
    const need = m ? lettersOf(m, birth) : [birth]
    let l: Letters = EMPTY_LETTERS
    for (const r of need) l = addGems(l, r)
    bag = l.bag
    notes.push(`bag holds ${need.length} letter${need.length === 1 ? '' : 's'}, none seated`)
  }

  if (id === 'dark') {
    // ★ THE SEAT QUESTION, PURE: the vessel bears its word's seats and NOT ONE of them is filled.
    // `write` is what decides the seat count, so the vessel is built exactly as a keeper's would be
    // and then emptied — rather than fabricating a seat count this fixture does not have to derive.
    // ⚠ The bands go back to null on purpose: the brief calls a vessel FINISHED only when every seat
    // is filled, so an unwritten vessel binds nothing and the cast bar must say so.
    // ⚠ `write` binds the word and RETURNS the letters it would seat — and here we drop them on the
    // floor. `worn` is never assigned, which is the whole scenario. An earlier cut of this block
    // "cleared" `worn` afterwards; those two lines were dead, and a mutation that deleted them was
    // indistinguishable from one that worked. Dead code in a fixture reads as an invariant being
    // enforced when nothing is enforcing it.
    write('bracelet', tac)
    write('focus', ult)
    for (const kind of VESSELS) { const b = bandOf(kind); if (b >= 0) slots[b] = null }
    notes.push('both vessels bear their word and hold nothing — every seat dark')
  }

  if (id === 'partial') {
    // ★ THE HARD READ: exactly ONE seated, the rest dark, in a vessel that can hold three.
    const full = write('bracelet', tac)
    worn.bracelet = full.slice(0, 1)
    if (full.length > 1) { slots[bandOf('bracelet')] = null; notes.push('bracelet word UNBOUND — one letter is not a word, and the row should say so') }
    if (worn.bracelet.length === 1) notes.push(`bracelet: 1 of ${full.length} seated`)
  }

  if (id === 'written' || id === 'rack') {
    worn.bracelet = write('bracelet', tac)
    worn.focus = write('focus', ult)
  }

  if (id === 'rack') {
    // ★ spares at DIFFERENT fills, so the row is picked by reading a word rather than a number.
    const alt = KEEPER_MOVES.find(m => m.tier === 'tactical' && m.id !== tac && !isBodyHeld(m, birth)
      && m.runes.length > 0 && m.runes.every(x => laneRunes(birth, 'element').has(x)))
    const second = alt ? write2(alt.id, 'bracelet', birth) : null
    spares.push(second ?? emptyVessel('bracelet'))
    spares.push(emptyVessel('bracelet'))
    notes.push(second ? `spares: ${alt!.id} + one blank bracelet` : 'spares: two blank bracelets — the registry held no second element word')
  }

  return { id, birth, owned, worn, spares, bag, slots, wordFor, why: notes.join(' · ') }
}

/** a stowed vessel carrying a written word — the spare-row form of `write`. */
function write2(moveId: string, kind: Vessel, birth: string): StowedVessel | null {
  const m = moveById(moveId)
  if (!m) return null
  let l: Letters = EMPTY_LETTERS
  for (const r of lettersOf(m, birth)) l = addGems(l, r)
  const bound = bindLetters(l, kind, m, birth)
  return bound ? { kind, gems: bound.vessels[kind], move: m.id, tier: 1 } : null
}

/**
 * Write the plan to storage through the SHIPPED save functions, then hand the plan back so the page
 * can print what it believes it built. Browser only.
 *
 * ⚠ `saveLetters` is what pins the worn seats. Without it `loadLetters` falls back to `seedLetters`,
 * which derives letters from the BOUND MOVES — so an "empty" scenario would quietly seed itself full
 * from the loadout and the dark seat would never appear. The one call that makes the empty cases
 * honest is the one that looks most redundant.
 */
export function seedPanel(id: PanelScenarioId): PanelPlan {
  const plan = planPanel(id)
  saveRuneInventory({ birth: plan.birth, owned: [...plan.owned] })
  // ★★★ THE BOOK IS A KEEPER KEY TOO, AND NOT WRITING IT MADE THIS FIXTURE NON-HERMETIC (2026-09-04).
  // Found by opening the bench in ALEX'S browser, where a real saved book already existed. Every
  // other key was seeded, so the scenario looked right on a clean profile and rendered "no word" plus
  // "what was here no longer fits" on his — `resolveLoadout` reading a book that does not contain the
  // word this fixture just bound, and being CORRECT to unbind it.
  //
  // ⚠⚠ THE VERIFICATION WAS TAKEN IN THE ONE ENVIRONMENT WHERE THE BUG CANNOT APPEAR. A headless
  // shot runs on a fresh profile with no keeper state, so the book fell back to a derivation of the
  // loadout I had just written and agreed with it. A fixture must OWN every key its render reads;
  // anything it leaves alone is inherited from whoever used this browser last.
  saveBook({ learned: plan.slots.filter((id): id is string => !!id) })
  saveLoadout(plan.slots)
  saveLetters({ bag: { ...plan.bag }, vessels: { bracelet: [...plan.worn.bracelet], focus: [...plan.worn.focus] } })
  saveStowed(plan.spares)
  return plan
}

/** every key this fixture writes — so the page can offer an honest "put it back" and a guard can check the set. */
export const FIXTURE_WRITES: readonly Vessel[] = VESSELS
