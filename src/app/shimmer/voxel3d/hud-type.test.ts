// ── The fold HUD asks the house game-UI layer, and keeps asking ───────────────────────────────
// Run: npx tsx src/app/shimmer/voxel3d/hud-type.test.ts
//
// WHY. Measured on the running prod page 2026-08-23: 27 visible text elements, 2 font weights
// (nearly all 400), effectively one size (11px), tracking on 2 of 27, and hierarchy carried
// ENTIRELY by the opacity of white — .95 .8 .55 .45 .45 .45 .4 .4. That is a debug overlay, not a
// game HUD. `GAME_UI_LAYER.md` had already ruled on it in June ("dim label + bright value is the
// game signature") and `gameui.css` already IMPLEMENTS it. Eight surfaces had opted in — seedfall,
// atherdash, nolmir, arcade, lucernyx, manana, ward, grimoire. Shimmer was at ZERO. Nothing was
// missing except adoption.
//
// ⚠ AND THE DEFECT THIS FILE IS NAMED IN. The objective chip's comment claimed the tool row and the
// hotbar counts "already follow" the same rule. The tool row was one `text-white/40` div whose
// spans carried only `mr-3` — label and value identical, nothing emphasised. One of three
// implemented it. A comment asserting coverage is a claim, and an unread claim retires the question
// instead of answering it. That comment now cites THIS file, which is only an improvement if this
// file can actually fail.
//
// ★ IT ASSERTS THE DERIVATION, NOT THE VALUES. A test holding its own copy of the expected tracking
// or colours is a hand-kept mirror: it agrees with itself while drifting from the layer, and it
// produces a green at exactly the moment someone goes looking. So it READS `gameui.css` and checks
// that the HUD ASKS for the classes — never that a number matches a number.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const CSS = readFileSync(join(ROOT, 'src/app/gameui.css'), 'utf8')
const HUD = readFileSync(join(ROOT, 'src/app/shimmer/voxel3d/VoxelWorld.tsx'), 'utf8')

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { c ? pass++ : fails.push(m) }

// ── 1. BLIND CHECK — the classes we depend on must still be DEFINED ───────────────────────────
// "I found no drift" and "I could not look" must not share an exit code. If `.gx-label` is renamed
// in gameui.css, every assert below would pass vacuously against a class that styles nothing.
const REQUIRED = ['.gx-label', '.gx-value', '.gx-title', '.gx-chrome']
for (const cls of REQUIRED) {
  ok(new RegExp(`^\\${cls}[\\s,{]`, 'm').test(CSS),
     `BLIND: ${cls} is no longer defined in gameui.css — this guard cannot see its subject`)
}
// and they must carry the properties the doctrine rests on, read OUT of the css, not restated here
const labelBlock = CSS.match(/^\.gx-label\s*\{([^}]*)\}/m)?.[1] ?? ''
ok(/text-transform:\s*uppercase/.test(labelBlock), 'BLIND: .gx-label no longer uppercases — the label role changed under us')
ok(/letter-spacing:/.test(labelBlock), 'BLIND: .gx-label no longer tracks')
ok(/font-family:.*--font-game/.test(labelBlock), 'BLIND: .gx-label no longer uses the display face')

// ── 2. the HUD block, located not assumed ─────────────────────────────────────────────────────
// The container must still opt in — that is what kills the web tells (tap flash, text selection,
// the system focus ring) for everything inside it.
ok(HUD.includes('gx-chrome absolute top-3 left-3'),
   'the HUD container no longer opts into gx-chrome')
// ⚠ SCANNED FILE-WIDE, NOT OVER A WINDOW. The first version of this sliced 4200 chars from the
// container and found ONE pair, because the objective chip is a sibling of that div, not a child.
// A window that does not contain the subject reports "nothing wrong" about code it never read —
// and the rule is file-wide anyway: nowhere in this HUD may a label and its value read alike.
const block = HUD

// ── 3. THE COLLAPSE CHECK — a label and its value must not read the same ──────────────────────
// This is the original defect stated as a rule. A pair whose two halves carry the same colour is
// exactly the flat tool row, whatever classes it wears.
const pairRe = /<span className="gx-label([^"]*)">[\s\S]{0,220}?<span className="gx-value([^"]*)">/g
const pairs = [...block.matchAll(pairRe)]
ok(pairs.length >= 2, `only ${pairs.length} label/value pair(s) found in the HUD — expected the tool row and the objective chip`)
const tone = (s: string) => (s.match(/text-(?:white|amber|slate|sky)\/?\[?[\w./]*\]?/g) ?? []).join(' ')
for (const [i, m] of pairs.entries()) {
  const l = tone(m[1]), v = tone(m[2])
  ok(!!l && !!v, `pair ${i}: a half carries no colour at all (label="${m[1].trim()}" value="${m[2].trim()}")`)
  ok(l !== v, `pair ${i}: label and value collapse to the same tone (${l}) — that is the flat tool row again`)
}

// ── 4. NO SECOND SPELLING of what the layer already says ──────────────────────────────────────
// The objective chip used to hand-roll `uppercase tracking-[.16em]`, a second spelling of
// .gx-label's 0.22em. Two spellings of one intent is how the colour census reached 761.
//
// ⚠ THIS IS A RATCHET, NOT A PASS. Scanning file-wide found **29 hand-rolled label roles** in this
// one file, spelling ONE role with **9 different tracking values** — `.14em` `.16em` `.18em`
// `.2em` `.22em` `0.14em` `0.16em` `tracking-wider` `tracking-widest`. Note `.14em` and `0.14em`
// are the same value spelled twice, as are `.16em`/`0.16em`: two spellings of one intent, which is
// precisely the `#8fa8a0`/`#8aa9a0` pathology on the type axis rather than the colour one.
//
// Converting all 29 in one pass would be 29 simultaneous pixel changes for Alex to judge at once,
// so the number is recorded and RATCHETED instead. It is an EXACT match on purpose: add a 30th and
// this goes red, convert one and it goes red until you lower the number. The count can only travel
// downwards, and it cannot rot into a silent exemption the way a "known issues" list does.
//
// ── ★★ AND IT MUST NAME THEM, NOT COUNT THEM (2026-08-26) ─────────────────────────────────────
// This reported `33 vs 29` and stopped. A red count that names nothing invites the cheapest green
// there is — edit the 29 to a 33 — and that edit is indistinguishable from banking a conversion,
// which is the one direction this ratchet exists to forbid. It went red on 08-26 and sat red for
// nineteen hours with three commits landing on top, which is what an unactionable alarm earns: a
// reader who cannot see what to do discounts it, and the next red is discounted faster.
// So the ratchet stays exactly as designed and the REPORT changes: every offender is printed with
// its line number and the tracking value it hand-rolls, and the spellings are tallied, because
// "one role spelled nine ways" is the actual defect and a bare total cannot show it.
const HAND_ROLLED_BASELINE = 20
const hudLines = HUD.split('\n')
const handRolled = [...block.matchAll(/className="[^"]*\buppercase\b[^"]*"/g)]
  .filter(m => !m[0].includes('gx-label'))
const roleAt = (m: RegExpMatchArray) => {
  const lineNo = HUD.slice(0, m.index ?? 0).split('\n').length
  const track = /tracking-\[([^\]]+)\]|tracking-(wider|widest)/.exec(m[0])
  return { lineNo, track: track ? (track[1] ?? track[2]) : '(none)', text: (hudLines[lineNo - 1] ?? '').trim() }
}
const roles = handRolled.map(roleAt)
if (handRolled.length !== HAND_ROLLED_BASELINE) {
  const spellings = [...new Set(roles.map(r => r.track))].sort()
  console.log(`\n  hand-rolled label roles, all ${roles.length} of them, in ${'VoxelWorld.tsx'}:`)
  for (const r of roles) console.log(`    ${r.lineNo}  tracking ${r.track}  ${r.text.slice(0, 96)}`)
  console.log(`  ${spellings.length} spellings of ONE role: ${spellings.join(' ')}`)
  console.log(`  ⚠ the fix is .gx-label on these lines — NOT a new number on HAND_ROLLED_BASELINE.\n`)
}
ok(handRolled.length === HAND_ROLLED_BASELINE,
   handRolled.length > HAND_ROLLED_BASELINE
     // ⚠ It says how many MORE there are than the ratchet allows, and does NOT claim to know
     // WHICH arrived last — it has no per-role baseline to diff against, only a count. Listing all
     // 33 line numbers behind the words "4 NEW" would assert something this check cannot see.
     // `git diff <the commit that set the baseline> -- VoxelWorld.tsx` is what names the newcomers.
     ? `${handRolled.length - HAND_ROLLED_BASELINE} more hand-rolled label role(s) than the ratchet allows (${handRolled.length} vs ${HAND_ROLLED_BASELINE}) — ask for .gx-label instead of restating uppercase+tracking. All ${handRolled.length} are listed above with line numbers; this check cannot tell which are new, so diff VoxelWorld.tsx against the commit that set the baseline. Do NOT raise the baseline.`
     : `${HAND_ROLLED_BASELINE - handRolled.length} label role(s) converted — lower HAND_ROLLED_BASELINE to ${handRolled.length} to bank it`)

// ── 5. the instruments are left alone, deliberately ───────────────────────────────────────────
// `data-perf`/`data-stats` are scraped by scripts/world-shot.mts via textContent. They are
// instruments, not chrome; restyling them buys little and can break a headless probe silently.
ok(/data-stats/.test(HUD) && /data-perf/.test(HUD),
   'a data-perf/data-stats handle vanished — world-shot.mts scrapes those by textContent')

// ⚠ THE STATS ROW MUST BE HIDDEN, NEVER UNMOUNTED. It is gated off for players now, and the
// tempting way to do that is a conditional render — but `textContent` sees through `display:none`
// and returns NULL for a node that is not in the tree. Unmounting it would break every headless
// world shot with the instrument's own "no [data-stats] node — old build?" message, which reads as
// a bad deploy rather than as a UI decision. This asserts the node is always emitted and that its
// visibility rides a className.
const statsLine = HUD.match(/<div data-stats[^>]*>/)?.[0] ?? ''
ok(/className=\{/.test(statsLine),
   `the stats row must toggle via className, not by unmounting — world-shot.mts would report a dead build. Found: ${statsLine}`)
ok(!/\{\s*diagnostics\s*&&\s*<div data-stats/.test(HUD) && !/\{\s*\w+\s*&&\s*\(?\s*<div data-stats/.test(HUD),
   'the stats row is behind a && guard — that unmounts it and blinds world-shot.mts')

// ── report ───────────────────────────────────────────────────────────────────────────────────
console.log(`\nhud-type — ${pairs.length} label/value pairs · ${REQUIRED.length} layer classes verified present`)
if (fails.length) {
  console.log(`\n❌ ${pass} passed, ${fails.length} FAILED\n`)
  fails.forEach(f => console.log('  · ' + f))
  process.exit(1)
}
console.log(`✅ ${pass} asserts passed\n`)
