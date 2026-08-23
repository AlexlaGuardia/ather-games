// Does the games board still claim a canon question is OPEN that canon has since RULED?
//
// ★ WHY THIS EXISTS: `canon_holds.py` guards the CANON side and says in its own output that it
// cannot see the build. That blind spot is exactly where this failed — `GBOARD.md` asserted
// *"flow… stays an `[OPEN]` canon gap… needs a `/magii` ruling, not a build call"* in two places for
// a day after `DOES ATHER WATER MOVE?` was RULED. A row that says "blocked" keeps saying it after
// the block clears, and the better it is written the longer it is believed. Nobody was wrong; the
// board was, and nothing connected the two files.
//
// ★★ IT MATCHES ON THE GAP TITLE, WHICH IS THE ONLY THING BOTH FILES SHARE. Prose around a citation
// can be anything; the quoted title is the join key, exactly as `canon_holds.py` keys on the MARKER
// rather than on a turn of phrase.
//
// ⚠⚠ AND "I FOUND NO DRIFT" MUST NOT SHARE AN EXIT CODE WITH "I COULD NOT LOOK". This repo has paid
// for that once already — a canon gate printing `ℹ check skipped` and exiting 0, with five of its
// ten checks able to go dark on a passing run. So: unreadable files, or a queue that parses to zero
// entries, exit BLIND (2). Clean is 0, stale is 1, and they are three different things.
//
// Run: npx tsx scripts/board-holds.mts
import { readFileSync } from 'node:fs'

const BOARD = '/root/ather-games/GBOARD.md'
const QUEUE = '/root/athernyx/CANON/CANON_GAPS.md'

function read(p: string): string {
  try { return readFileSync(p, 'utf8') } catch { return '' }
}
const board = read(BOARD), queue = read(QUEUE)
if (!board || !queue) {
  console.error(`BLIND: could not read ${!board ? BOARD : QUEUE} — no claim is being made about drift.`)
  process.exit(2)
}

/**
 * Normalise a title so quoting, case and punctuation cannot decide a match.
 *
 * ⚠ THE LEADING MARKER IS STRIPPED, AND FORGETTING IT COST A FALSE CLEAN ON THE FIRST RUN. The board
 * cites gaps both ways — `*"DOES ATHER WATER MOVE?"*` and `*[OPEN] DOES ATHER WATER MOVE?*` — and
 * only the first matched, so a genuinely stale row was reported as merely unresolvable. The guard
 * found its own hole because it PRINTS what it could not match; had it stayed quiet about those, the
 * miss would have read as cleanliness.
 */
const norm = (s: string) => s.toLowerCase()
  .replace(/^\s*\[(open|ruled)\]\s*/i, '')
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

// ── the queue: every gap heading and its status ──────────────────────────────────────────────
const gaps = new Map<string, { status: string; title: string }>()
for (const line of queue.split('\n')) {
  const m = /^##+\s*\[(OPEN|RULED)\]\s*(.+)$/.exec(line.trim())
  if (!m) continue
  // Titles carry a trailing " — explanation"; the head is the stable half.
  const title = m[2].split(/\s+[—–]\s+/)[0]
  gaps.set(norm(title), { status: m[1], title })
}
if (gaps.size === 0) {
  console.error('BLIND: parsed ZERO gap headings from the queue — the format changed and this guard went dark.')
  process.exit(2)
}

// ── the board: lines that ASSERT something is unruled ────────────────────────────────────────
const CLAIMS = /\[OPEN\]|open canon gap|needs a \/magii|needs a ruling|BLOCKED ON CANON|awaiting a ruling/i
const stale: string[] = []
const unmatched: string[] = []
let claimLines = 0

board.split('\n').forEach((line, i) => {
  if (!CLAIMS.test(line)) return
  // A line that reports a gap as already ruled is not a claim that it is open.
  if (/\bRULED\b/.test(line) && !/\[OPEN\]/.test(line)) return
  claimLines++
  // ★★ SEARCH THE LINE FOR EACH KNOWN TITLE, RATHER THAN PARSING THE LINE FOR CANDIDATES. The first
  // cut paired markdown delimiters (`*…*`, `"…"`) and pulled the quoted phrase out — and it MISSED a
  // genuinely stale row, because a line carrying both `**bold**` and `*emphasis*` pairs its asterisks
  // in an order that walks straight past the citation. A hand-written textual reader whose pattern
  // stops matching returns quietly, which is this repo's most-repeated bug and the one it has the
  // most scar tissue about. Asking "does this line contain any title I know?" has no pairing to get
  // wrong, and the titles are long enough that a coincidental hit is not a real risk.
  const flat = norm(line)
  let matched = false
  for (const [key, hit] of gaps) {
    if (key.length < 15 || !flat.includes(key)) continue
    matched = true
    if (hit.status === 'RULED')
      stale.push(`GBOARD:${i + 1} claims a hold — canon says [RULED] "${hit.title}"`)
  }
  if (!matched) unmatched.push(`GBOARD:${i + 1} ${line.trim().slice(0, 110)}`)
})

console.log(`board-holds: read ${board.split('\n').length} board lines, ${gaps.size} queue entries, ${claimLines} rows claiming a hold`)
if (claimLines === 0) {
  console.error('BLIND: no row on the board claims a hold at all — either the board changed shape or this pattern set is dead.')
  process.exit(2)
}
for (const s of stale) console.log(`  🔴 ${s}`)
// ⚠ Reported, never silent: a claim this guard could not resolve is NOT evidence of cleanliness.
// The whole failure mode here is a file quietly answering a question it never actually asked.
if (unmatched.length) {
  console.log(`  ⚠ ${unmatched.length} hold claim(s) name no gap this guard can resolve — check by hand:`)
  for (const u of unmatched.slice(0, 12)) console.log(`     ${u}`)
}
if (stale.length) { console.log(`\nSTALE: ${stale.length} board row(s) assert a hold canon has released.`); process.exit(1) }
console.log('\nclean: no board row claims a hold that canon has ruled.')
