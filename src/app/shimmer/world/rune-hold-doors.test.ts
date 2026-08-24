/**
 * RUNE HOLD'S DOORS — the SHIPPED town, checked against canon.
 *
 * ★ WHY THIS EXISTS, AND IT IS NOT THE GREYBOX'S ORACLE. `play3d/rune-hold.ts` is an authoring
 * INSTRUMENT — it answers how big the Mug is and where the Passage hides, and nothing in the game
 * imports it. The town a player actually stands in is the 100x100 tile map in `zones.ts`, and until
 * now **nothing checked that map against canon at all.** Finding out which of the town's doors were
 * built took six greps and produced one false alarm on the way (below). That is a job for a file.
 *
 * ── ⚠ THE FALSE ALARM, KEPT BECAUSE THE NEXT PERSON WILL WRITE THE SAME CHECK ────────────────
 * My first pass collected every gate's `toZone` and tested it against the set of zone ids. It
 * reported **two dangling destinations** on the home plot — which reads as a broken door in the
 * shipped game, and that is the direction that gets ACTED ON. They were `spirit-corner`, a LEGACY
 * id the Spirit Corner fold retired in 2026-08-05, and `LEGACY_ZONE_ALIASES` resolves it to
 * `rune-hold` exactly as it is supposed to. ★ The instrument was the wrong shape: the game reaches
 * a zone through `resolveZoneId`, so a check that skips the resolver is testing a world that does
 * not exist. **Everything below goes through the resolver, the way the game does.**
 *
 * ── ★★ PENDING IS NOT FAILING, AND THEY MUST NOT SHARE AN EXIT CODE ─────────────────────────
 * The square's public gate-landing is canon (`world/gates.md` › *WHERE IT LETS OUT*, ruled
 * 2026-08-12) and is not built, because gate data follows the map here and the footprint is Alex's
 * to paint. A hard red for work that is correctly not-done-yet teaches everyone to discount red —
 * the lesson this repo paid for twice. So it PRINTS as pending, and the moment a gate with that
 * label appears it is asserted like every other door. **A door nobody has painted and a door that
 * is broken are different claims.**
 *
 * Run: `npx tsx src/app/shimmer/world/rune-hold-doors.test.ts`
 */
import { ALL_ZONES } from './all-zones'
import { getZone, resolveZoneId, gateFootprint, type Gate, type Zone } from './zones'

let pass = 0
const fails: string[] = []
const pending: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

const town = getZone(ALL_ZONES, 'rune-hold')
ok(!!town, 'the shipped town exists')
const gates: Gate[] = (town as Zone & { gates?: Gate[] })?.gates ?? []

/**
 * The doors canon gives Rune Hold, and the file that rules each one.
 *
 * ⚠ `built` IS NOT A WISH LIST — it records which of these canon doors the map has a footprint for
 * today. Flipping one to true without a painted gate is how a checklist starts lying; the assert
 * below reads the MAP, never this column.
 */
const CANON_DOORS = [
  { label: 'THE SPIRIT CORNER', why: "Gregory's door — stepping through IS the crossing (rune-hold.md > NO INTERIOR OPENS, 08-24)", built: true },
  { label: 'THE PASSAGE',       why: 'the hidden tunnel market under the town (locations.md: "Under Rune Hold")',                 built: true },
  { label: 'TRAVELERS STATION', why: 'the way OUT — a sky-port at the town\'s edge (rune-hold.md, ruled 08-05)',                  built: true },
  { label: 'THE LANDING',       why: "the square's public gate-landing (gates.md > WHERE IT LETS OUT, ruled 08-12)",              built: false },
] as const

const byLabel = (l: string) => gates.find(g => g.label.toUpperCase() === l)

for (const door of CANON_DOORS) {
  const g = byLabel(door.label)
  if (!g) {
    // ★ REPORTED, NOT SWALLOWED, AND NOT COUNTED AS A PASS. "I could not check" and "I checked and
    // it is fine" must never share an exit code — the BLIND severity the holds gate learned.
    if (door.built) fails.push(`${door.label} is recorded as built and the map has no such gate — ${door.why}`)
    else pending.push(`${door.label} — not painted yet. ${door.why}`)
    continue
  }
  ok(true, `${door.label} exists on the map`)
  // ★ THE DESTINATION IS RESOLVED THE WAY THE GAME RESOLVES IT, aliases included.
  const dest = getZone(ALL_ZONES, resolveZoneId(g.toZone))
  ok(!!dest, `${door.label} leads somewhere real (${g.toZone} -> ${resolveZoneId(g.toZone)})`)
  // ⚠ A DOOR THAT LANDS YOU INSIDE ANOTHER DOOR BOUNCES YOU STRAIGHT BACK. zones.ts warns about
  // this in the Gate type's own comment; asserting it is cheaper than discovering it in play.
  if (dest) {
    const there: Gate[] = (dest as Zone & { gates?: Gate[] }).gates ?? []
    const landedOn = there.find(o => {
      const fp = gateFootprint(o)
      return g.toX >= o.x && g.toX < o.x + fp.w && g.toY >= o.y && g.toY < o.y + fp.h
    })
    ok(!landedOn, `${door.label} does not land you inside ${landedOn?.label ?? 'another door'}`)
  }
}

// ── every door in the whole game reaches a real zone ─────────────────────────────────────────
// ★ THE SWEEP THAT WOULD HAVE ANSWERED MY QUESTION IN ONE SECOND, and the one whose first draft
// lied. Scoped to every zone, not just the town, because a door is only half of a round trip.
{
  const broken: string[] = []
  for (const z of ALL_ZONES) {
    const zz = z as Zone & { gates?: Gate[]; warps?: { toZone: string }[] }
    for (const [kind, list] of [['gate', zz.gates ?? []], ['warp', zz.warps ?? []]] as const)
      for (const w of list as { toZone: string; label?: string }[])
        if (!getZone(ALL_ZONES, resolveZoneId(w.toZone)))
          broken.push(`${z.id} ${kind} "${w.label ?? ''}" -> ${w.toZone}`)
  }
  ok(broken.length === 0, `every door and warp in the game reaches a real zone${broken.length ? ` — ${broken.join(' · ')}` : ''}`)
}

// ── the town keeps a way out ─────────────────────────────────────────────────────────────────
// ⚠ THIS HAS BEEN FALSE BEFORE. zones.ts records a period when the gate array was deliberately
// emptied and "the town has no way out" — recoverable only because someone remembered. It is a
// check now.
ok(gates.some(g => !g.ownerOnly && !g.requiredFlag), 'the town has at least one door a player can actually use')

console.log(`rune-hold doors: ${pass} passed, ${fails.length} failed, ${pending.length} pending`)
for (const p of pending) console.log('  ⋯ ' + p)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
