/**
 * The keeper panel's CHROME: its bodies ask the house game-UI layer, and keep asking.
 * Run: `npx tsx src/app/shimmer/voxel3d/keeper-chrome.test.ts`
 *
 * Alex, 2026-09-04, after walking the three-tab panel: *"next up we should dig into how to make it
 * look more like a game menu"*. The FRAME had been on the layer since 08-26 (`gx-card`, `gx-btn`
 * tabs); the BODIES under it were still `rounded border border-white/10 bg-white/[0.03]` rows with
 * hierarchy carried by the opacity of white — the exact signature `hud-type.test.ts` was written
 * against, one level down. This suite is the chrome pass as asserts, so the bodies cannot drift
 * back to web rows one edit at a time.
 *
 * ★ IT ASSERTS THE DERIVATION, NOT THE PIXELS. Every check is "does the body ASK for the layer's
 * role" — never that a colour matches a number. The layer is read first, and a role the layer no
 * longer defines is reported BLIND rather than passing on a class that styles nothing.
 * ★ THE SEAT IS ASSERTED RIMLESS, ON PURPOSE. The vessel brief says *"the vessel closed around it"*:
 * a dark seat is a dim void in the weave, never a socket with a bezel. The tempting chrome fix is
 * a ring — it is the one this file forbids.
 */
import { readFileSync } from 'node:fs'
import { noComments, declAt, declAfter } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

// ── 1. the layer, before anything is asserted about the users of it ──────────────────────────
const CSS = read('../../gameui.css')
for (const role of ['.gx-plate', '.gx-plate.is-lit', '.gx-label', '.gx-value', '.gx-title', '.gx-btn']) {
  ok(new RegExp('^' + role.replace(/[.]/g, '\\.') + '\\s*\\{', 'm').test(CSS),
     `BLIND: ${role} is not defined in gameui.css — every assert below about it would be about a class that styles nothing`)
}
const plate = CSS.match(/^\.gx-plate\s*\{([^}]*)\}/m)?.[1] ?? ''
ok(/border-radius:\s*[0-3]px/.test(plate), 'BLIND: .gx-plate is no longer near-sharp — a soft radius is the web-card tell the plate exists to kill')
ok(/inset/.test(plate), 'BLIND: .gx-plate lost its inset shadow — it is meant to read as RECESSED into the card, not laid on it')

// ── 2. the shell owns the section head, once ────────────────────────────────────────────────
const SHELL = noComments(read('./keeper-panel.tsx'))
const headAt = SHELL.indexOf('export function SectionHead(')
ok(headAt >= 0, 'keeper-panel exports SectionHead — the one spelling of a section head')
const head = headAt >= 0 ? SHELL.slice(headAt, SHELL.indexOf('\n}\n', headAt)) : ''
ok(/className="gx-label /.test(head), 'SectionHead asks gx-label for its title')
ok(/h-px/.test(head), 'SectionHead draws the hairline — bodies must not draw their own')

// ── 3. the host's panel region ─────────────────────────────────────────────────────────────
const HOST = noComments(read('./VoxelWorld.tsx'))
const from = declAt(HOST, 'BirthLean')
const to = declAfter(HOST, 'World', from)
ok(from >= 0 && to > from, 'BirthLean … World anchors present, in that order (the region below needs both)')
const R = from >= 0 && to > from ? HOST.slice(from, to) : ''

const WEB_ROW = /border border-white\/10 bg-white\/\[0\.03\]/g
ok(count(R, WEB_ROW) === 0,
   `★ no web row left in the panel bodies (${count(R, WEB_ROW)} × "border border-white/10 bg-white/[0.03]") — ask gx-plate`)
// 7 → 6 on 2026-09-04: the bag + imbue CARDS became GRID CELLS (Alex: "a second inventory under the hotbar").
// A cell is the bag's own idiom, not a plate; the floor drops by exactly the two cards that stopped existing.
const PLATE_FLOOR = 6
ok(count(R, /className=[{"][^"}]*\bgx-plate\b/g) >= PLATE_FLOOR,
   `the bodies stand on plates (${count(R, /className=[{"][^"}]*\bgx-plate\b/g)} gx-plate uses, floor ${PLATE_FLOOR})`)

for (const label of ['Gems', 'Vessels', 'Cast bar', 'Innate', 'Gathering focuses', 'Satchel', 'Hotbar']) {
  ok(new RegExp(`<SectionHead label="${label}"`).test(R), `section "${label}" is headed by SectionHead`)
}
ok(/<SectionHead label=\{`in the chest/.test(R), 'the chest is headed by SectionHead too')
ok(count(R, /h-px flex-1/g) === 0,
   `★ no hand-rolled hairline head in the bodies (${count(R, /h-px flex-1/g)}) — SectionHead owns the hairline`)

// the seat: rimless, per the brief
const seatCls = /aria-label="empty seat"[\s\S]{0,200}?className="([^"]*)"/.exec(R)?.[1] ?? ''
ok(seatCls.length > 0, 'the dark seat is still drawn with an aria-label so it can be found')
ok(!/\bborder\b|\bring-|\boutline/.test(seatCls),
   `★ the dark seat has no rim — no border, ring or outline (brief: "the vessel closed around it"); got "${seatCls}"`)
ok(/rounded-full/.test(seatCls) && /shadow-\[inset/.test(seatCls), 'the dark seat is a rounded void with an inset shadow — dark and visibly empty')

// the cast bar: key caps are HUD switches, the word carries its price off the spec
ok(count(R, /gx-btn flex h-5 w-5/g) === 1, 'the cast-bar key cap is a gx-btn (one key-cap spelling)')
ok(/\{spec\.manaCost\} mana/.test(R) && /spec\.cooldownMs \/ 1000/.test(R),
   '★ the bound word shows its price read off the CastSpec — mana and cooldown, derived, never restated')
ok(/gx-plate \$\{spec && isBuilt\(bound\) \? 'is-lit' : ''\}/.test(R),
   'a bound, built word lights its plate; an empty or unbuilt slot stays dark')

// the innate traits: the birth lean is mounted again, inside Gear, beside the passive
const gearAt = declAfter(R, 'GearTab', 0)
const gear = gearAt >= 0 ? R.slice(gearAt) : ''
ok(count(R, /<BirthLean birth=/g) === 1, `★ BirthLean is mounted exactly once (${count(R, /<BirthLean birth=/g)}) — it went dark when the Runes tab retired, and nothing said so`)
ok(count(gear, /<BirthLean birth=/g) === 1, '… and that mount is inside GearTab, under the Innate head')
ok(/\(passive \|\| birth\) && \(/.test(gear), 'the Innate section renders when EITHER trait exists — the lean without a passive still shows')

// ── 3b. the icon pass (2026-09-04): a gem is a stone, a focus is its painted sprite ────────────
const seatsAt = declAt(R, 'Seats')
const seats = seatsAt >= 0 ? R.slice(seatsAt, R.indexOf('\n}\n', seatsAt)) : ''
ok(count(seats, /<GemStone /g) === 1 && /lit/.test(seats), '★ a seated gem is the STONE, lit — not a text chip')
const chipAt = declAt(R, 'GemChip')
const chip = chipAt >= 0 ? R.slice(chipAt, R.indexOf('\n}\n', chipAt)) : ''
ok(count(chip, /<GemStone /g) === 1, 'a loose gem in the bag is the stone, then its name')
const stoneAt = declAt(R, 'GemStone')
const stone = stoneAt >= 0 ? R.slice(stoneAt, R.indexOf('\n}\n', stoneAt)) : ''
ok(/<svg/.test(stone) && /fill=\{glow\}/.test(stone), 'the stone is drawn from code and tinted by the rune\'s canon glow (the derived tier)')
ok(!/<rect|stroke=/.test(stone), '★ no setting drawn around the stone — no rect, no stroke (the seat is the vessel closed around it)')
const gfAt2 = declAt(R, 'GatheringFocuses')
const gf = gfAt2 >= 0 ? R.slice(gfAt2, R.indexOf('\n}\n', gfAt2)) : ''
ok(/<ItemChip itemId=\{held\.toolId\}/.test(gf), '★ a gathering focus row draws the SAME painted sprite the bag draws — ItemChip, no second source')
const rackAt2 = declAt(R, 'VesselRack')
const rack2 = rackAt2 >= 0 ? R.slice(rackAt2, declAfter(R, 'GatheringFocuses', rackAt2)) : ''
// ★ RE-POINTED 2026-09-04 (the tier model): the id is built by ONE helper, `vesselIconId(kind, tier)`, and the
// noun rule lives there. The rack, the satchel grid and the part strip all go through it.
ok(/<ItemChip itemId=\{vesselIconId\(kind, /.test(rack2), '★ the rack draws each vessel\'s icon through ItemChip via vesselIconId — one spelling for every host')
const iconFnAt = declAt(R, 'vesselIconId')
const iconFn = iconFnAt >= 0 ? R.slice(iconFnAt, R.indexOf('\n}\n', iconFnAt)) : ''
ok(/`vessel_\$\{VESSEL_NOUN\[kind\]\}_t\$\{tier\}`/.test(iconFn) && !/vessel_\$\{kind\}/.test(iconFn),
   '★ vesselIconId keys by the NOUN (glove), never the kind id (focus) — `vessel_focus_t1` is a grey chip')
ok(/itemIcon\(id\) \? id : `vessel_\$\{VESSEL_NOUN\[kind\]\}_t1`/.test(iconFn),
   '★ and falls back to the tier-1 art when a tier has none yet — a missing t0/t2/t3 sprite is a placeholder, not a grey chip')
ok(count(R, /vessel_\$\{VESSEL_NOUN\[[a-z.]+\]\}_t1/g) === 1, `★ the literal _t1 spelling appears ONCE, inside the helper (${count(R, /vessel_\$\{VESSEL_NOUN\[[a-z.]+\]\}_t1/g)}) — a host that restates it pins itself to goldwood`)
// and the ids the rack can build must exist in the sprite table — the headless half of the screenshot that caught this
import { ITEM_ICONS } from '../sprites/items'
for (const noun of ['bracelet', 'glove']) ok(!!ITEM_ICONS[`vessel_${noun}_t1`], `ITEM_ICONS has vessel_${noun}_t1`)
ok(!ITEM_ICONS['vessel_focus_t1'], 'no sprite is registered under the kind id — the noun is the only spelling')
ok(!/'held'/.test(R) && /hand/.test(VESSEL_COPY(R)) && /wrist/.test(VESSEL_COPY(R)),
   '★ the vessel copy follows the 09-03 amendment: HAND vs WRIST, never "held" (a glove is worn)')
function VESSEL_COPY(src: string) { return /const VESSEL_LANE_LABEL[^\n]*/.exec(src)?.[0] ?? '' }

// ── 3c. the ruling (2026-09-04): parts in the satchel, written vessels in Gear, a cast bar that reads ─
ok(count(R, /<VesselParts /g) === 1, '★ the satchel mounts VesselParts once — vessels are parts until written')
const partsAt = declAt(R, 'VesselParts')
const parts = partsAt >= 0 ? R.slice(partsAt, declAfter(R, 'VesselRack', partsAt)) : ''
ok(/placeGems\(/.test(parts) && /shortOf\(/.test(parts) && /isComplete\(/.test(parts), 'a part places what the bag holds, says what it is short, and knows when it is written')
ok(/<Seats gems=\{v\.gems\} seats=\{seats\}/.test(parts), '★ a part draws as many seats as its WORD needs')
const gearAt3 = declAt(R, 'GearTab')
const gear3 = gearAt3 >= 0 ? R.slice(gearAt3, R.indexOf('\nfunction BagPanel(', gearAt3)) : ''
ok(!/setPicking|leave this slot empty|eligibleMoves\(/.test(gear3), '★ the cast bar is a READOUT — no picker, no bind, writing happens on the vessel')
ok(/<select /.test(rack2) && /dismantleWorn\(/.test(rack2), 'the rack equips written spares from a dropdown and can dismantle the worn one')

// ── 4. label / value must not collapse to one tone, region-wide ─────────────────────────────
const pairRe = /<span className="gx-label([^"]*)">[\s\S]{0,220}?<span className="gx-value([^"]*)">/g
const tone = (s: string) => (s.match(/text-(?:white|amber|slate|sky)\/?\[?[\w./]*\]?/g) ?? []).join(' ')
const pairs = [...R.matchAll(pairRe)]
ok(pairs.length >= 2, `label/value pairs found in the bodies (${pairs.length}, want ≥ 2 — the focuses row and the cast bar)`)
for (const [i, m] of pairs.entries()) {
  const l = tone(m[1]), v = tone(m[2])
  ok(!!l && !!v && l !== v, `pair ${i}: label and value read alike (label="${l}" value="${v}") — the flat row again`)
}

// ⚠ THE WINDOW ABOVE CANNOT SEE THE CAST BAR'S PAIR. The band label and the price sit either side of
// the move name AND a comment, and `noComments` blanks a comment to spaces (layout kept), so the
// two are > 220 chars apart and the pair regex walks past them. Found by mutation: collapsing the
// price onto the band's tone SURVIVED. So that one pair is pinned by anchor, not by distance.
const bandTone = tone(/className="gx-label w-\[68px\][^"]*"/.exec(R)?.[0] ?? '')
const priceTone = tone(/className="gx-value[^"]*">\{spec\.manaCost\}/.exec(R)?.[0] ?? '')
ok(!!bandTone && !!priceTone, `the cast bar's band label and price both carry a tone (band="${bandTone}" price="${priceTone}")`)
ok(bandTone !== priceTone, `★ the cast bar's band label and its price must not read alike (both "${bandTone}")`)

// ── 5. the grimoire, same rules ────────────────────────────────────────────────────────────
const G = noComments(read('./grimoire-tab.tsx'))
ok(count(G, WEB_ROW) === 0, `no web row left in the grimoire (${count(G, WEB_ROW)})`)
ok(count(G, /<SectionHead /g) >= 2, `the grimoire heads its lists with SectionHead (${count(G, /<SectionHead /g)})`)
ok(/gx-btn px-2\.5 py-1 text-\[10px\] \$\{face === id \? 'gx-active' : 'gx-inactive'\}/.test(G),
   'the Yours / Species switch is a gx-btn with brutal on/off, not a tinted div')
ok(count(G, /className="[^"]*\buppercase\b[^"]*"/g) === 0, `no hand-rolled uppercase role left in the grimoire (${count(G, /className="[^"]*\buppercase\b[^"]*"/g)})`)

console.log(`keeper-chrome: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
