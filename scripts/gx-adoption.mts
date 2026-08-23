// ── Which surfaces have actually joined the house game-UI layer ────────────────────────────────
// Run: npx tsx scripts/gx-adoption.mts
//
// WHY THIS EXISTS, and it is the sharpest lesson of 2026-08-23. `GAME_UI_LAYER.md` was written
// 2026-06-18. It named the defect exactly ("dim label + bright value is the game signature"), said
// the rules were "already written, just not applied everywhere", shipped `gameui.css` implementing
// them, and listed a four-step rollout whose step 4 is in-game HUDs.
//
// Two months later, TEN live games had adopted it and the FLAGSHIP was at zero. Shimmer's HUD was
// still carrying hierarchy on the opacity of white alone, and a whole session went into diagnosing
// a problem the repo had already solved and written down.
//
// ⚠⚠ THE FAILURE IS NOT THAT THE DOC WAS WRONG — IT WAS RIGHT, AND IT AGED PERFECTLY. **A rollout
// doc with a step nobody completed reads exactly like a rollout doc that finished.** Prose cannot
// report its own completion, so the plan kept looking done while one surface silently never joined.
// A number can go stale loudly; a paragraph cannot go stale at all. That is the whole point of this
// file: it turns "we should roll this out" into something that fails.
//
// ★ IT DERIVES THE SURFACE LIST FROM THE GAME REGISTRY, NEVER FROM A LIST OF ITS OWN. A hand-kept
// roster of games-to-check is the same shape as the thing it is guarding against: it would go stale
// the first time someone shipped a cabinet, and it would go stale QUIETLY, since a game missing
// from the list simply is not checked. Importing `GAMES` means a new entry is enrolled the moment
// it exists and stays red until someone classifies it.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GAMES, type GameEntry } from '../src/lib/games'

const ROOT = process.cwd()
const CSS = readFileSync(join(ROOT, 'src/app/gameui.css'), 'utf8')

/**
 * The floor each adopted surface must stay at or above — a RATCHET, matching `tokens.test.ts` and
 * `hud-type.test.ts`. Dropping below is a regression and goes red; climbing above goes red too,
 * until the new number is banked here. It can only travel one way, and it cannot quietly rot.
 */
const FLOORS: Record<string, number> = {
  vault: 37, rekindle: 22, driftling: 18, squall: 18, dewdrop: 17, ward: 17,
  seedfall: 16, voranyx: 14, atherdash: 12, updraft: 11, manana: 8,
  shimmer: 23,         // c378800 the fold HUD (8), then the input pass: bindings panel + resolved tutorial hints
  lucernyx: 7, nolmir: 3,
}

/**
 * Registered games that have NOT joined, each with the reason it is allowed to sit at zero.
 *
 * ⚠ THIS IS NOT AN EXEMPTION LIST. Every entry asserts its surface is STILL at zero, so the day one
 * of them adopts the layer this goes red until it is promoted into FLOORS. An exemption that cannot
 * expire is a silent promise that somebody is watching that corner; this one expires by itself.
 */
const PENDING: Record<string, string> = {
  gravitar: 'back-room, not publicly listed — adopt when it comes out of the back room',
  magii: 'kind:"world", a lore surface rather than an arcade cabinet — the layer targets game chrome',
}

/** Count `gx-*` class usages under a directory, recursively. */
function countGx(dir: string): { hits: number; files: number } {
  let hits = 0, files = 0
  const walk = (d: string) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) { if (e !== 'node_modules') walk(p); continue }
      if (!/\.tsx?$/.test(e)) continue
      // ⚠ TEST FILES ARE EXCLUDED, AND THIS IS NOT TIDINESS — IT IS A BUG THIS FILE HAD ON ITS
      // FIRST RUN. `hud-type.test.ts` asserts ABOUT `.gx-label`/`.gx-value`/`.gx-chrome`, so it
      // names them 16 times, and the counter read shimmer at 24 instead of 8 — scoring a GUARD's
      // mentions of the layer as a SURFACE's adoption of it. A file that quotes the thing being
      // counted hands the counter a second match, which is how the canon gate got fooled on
      // 2026-08-22 by a header quoting its own marker. Writing a test about the layer would have
      // inflated adoption; writing a THOROUGH one would have inflated it more.
      if (/\.test\.tsx?$/.test(e)) continue
      files++
      hits += (readFileSync(p, 'utf8').match(/\bgx-[a-z]+/g) ?? []).length
    }
  }
  walk(dir)
  return { hits, files }
}

const dirFor = (g: GameEntry) => join(ROOT, 'src/app', g.href.replace(/^\//, '').split('/')[0])

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { c ? pass++ : fails.push(m) }

// ── BLIND CHECKS — an instrument that cannot see its subject must not report "nothing wrong" ────
for (const cls of ['.gx-label', '.gx-value', '.gx-title', '.gx-chrome', '.gx-btn']) {
  ok(new RegExp(`^\\${cls}[\\s,{]`, 'm').test(CSS), `BLIND: ${cls} is gone from gameui.css — every count below is meaningless`)
}
ok(GAMES.length > 0, 'BLIND: the game registry imported empty')

// ── every registered game is classified, and the classification matches disk ────────────────────
const rows: Array<{ id: string; hits: number; floor?: number }> = []
for (const g of GAMES) {
  const dir = dirFor(g)
  if (!existsSync(dir)) { ok(false, `${g.id}: href ${g.href} has no directory at ${dir} — cannot be measured, so it is not "clean"`); continue }
  const { hits, files } = countGx(dir)
  ok(files > 0, `${g.id}: scanned 0 source files — the walker is broken, not the surface`)
  rows.push({ id: g.id, hits, floor: FLOORS[g.id] })

  const inFloors = g.id in FLOORS, inPending = g.id in PENDING
  ok(inFloors !== inPending,
     inFloors && inPending ? `${g.id} is in BOTH FLOORS and PENDING — pick one`
                           : `${g.id} is in NEITHER FLOORS nor PENDING — a new game must be classified before this can pass`)
  if (inFloors) {
    ok(hits >= FLOORS[g.id], `${g.id} REGRESSED: ${hits} gx uses, floor is ${FLOORS[g.id]}`)
    ok(hits === FLOORS[g.id], `${g.id} climbed to ${hits} (floor ${FLOORS[g.id]}) — bank it by raising the floor`)
  }
  if (inPending) {
    ok(hits === 0, `${g.id} has ADOPTED the layer (${hits} uses) — promote it out of PENDING into FLOORS. Its stated reason ("${PENDING[g.id]}") has expired.`)
  }
}
// a name in FLOORS/PENDING that is no longer a registered game
for (const id of [...Object.keys(FLOORS), ...Object.keys(PENDING)]) {
  ok(GAMES.some(g => g.id === id), `${id} is classified here but is no longer in the game registry — delete it`)
}

// ── report ─────────────────────────────────────────────────────────────────────────────────────
const adopted = rows.filter(r => r.hits > 0).length
console.log(`\ngx adoption — ${adopted}/${GAMES.length} registered games on the house layer`)
for (const r of rows.sort((a, b) => b.hits - a.hits)) {
  console.log(`  ${String(r.hits).padStart(3)}  ${r.id}${r.hits === 0 ? `   ← PENDING: ${PENDING[r.id] ?? '?'}` : ''}`)
}
if (fails.length) { console.log(`\n❌ ${pass} passed, ${fails.length} FAILED\n`); fails.forEach(f => console.log('  · ' + f)); process.exit(1) }
console.log(`\n✅ ${pass} asserts passed\n`)
