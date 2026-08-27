#!/usr/bin/env node
// canon-drift.mjs — Shimmer ↔ Canon drift checker
//
// The game's "doctor" (src/app/shimmer/doctor/checks.ts) validates the build
// against ITSELF (sprite frame maps, palettes). This validates the build against
// the WORLD — the lore-bearing values it hardcodes vs. what Magii has ruled true
// in /root/athernyx/CANON/. It is the automated, repeatable version of the
// one-off 2026-06-24 SHIMMER-CANON-AUDIT.md.
//
// It is Jin's equivalent of raven/sable's `BLOCKED — canon gap` stop: it can't
// stop a human, but it makes drift LOUD instead of silent. Run it on build/commit.
//
// Boundary it enforces (GAME-SHIMMER-BOUNDARY.md): Magii owns what is TRUE;
// Jin owns how it's BUILT. This tool only reads. It never edits either side —
// it reports, and a human routes each finding (rule it in canon, or re-wire the game).
//
// Usage:  node scripts/canon-drift.mjs [--report] [--quiet]
//   --report  also write SHIMMER-CANON-DRIFT.md (default: console only)
//   --quiet   suppress the per-finding console lines, print summary only
// Exit code: 0 = clean, 1 = drift found (CONFLICT/COLLISION), 2 = parse/IO error.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const GAME = join(HERE, '..', 'src', 'app', 'shimmer')          // /root/ather-games/src/app/shimmer
import { execSync } from 'child_process'

const CANON = '/root/athernyx/CANON'
const REPORT_PATH = '/root/ather-games/SHIMMER-CANON-DRIFT.md'

const args = new Set(process.argv.slice(2))
const WRITE_REPORT = args.has('--report')
const QUIET = args.has('--quiet')

// ── helpers ────────────────────────────────────────────
const read = (p) => readFileSync(p, 'utf8')
const norm = (s) => s.trim().replace(/\*\*/g, '').replace(/\s+/g, ' ')
// strip a trailing "(Runeword)" the master file appends to each name cell
const nameOnly = (s) => norm(s).replace(/\s*\([^)]*\)\s*$/, '').trim()

const ELEMENTS = ['mana', 'storm', 'earth', 'water']
// the stable join key across every source is the base species NAME (Vulnyx,
// Dewbear…) — analog tokens drift between files (water-bear / tardigrade / Water Bear).
const codeKey = (s) => s.toLowerCase().replace(/[\s-]/g, '') // 'water-bear' ~ 'Water Bear'

// findings accumulator. severity: CLEAN | GAP | CONFLICT | COLLISION | NOTE
const findings = []
const add = (severity, area, msg, detail) => findings.push({ severity, area, msg, detail })

// ── CANON PARSERS ──────────────────────────────────────

// world/spirits-species.md → base species: { speciesName -> {code, element} }
function canonBaseSpecies() {
  const txt = read(join(CANON, 'world', 'spirits-species.md'))
  const sec = txt.split('## The 10 Base Forms')[1]?.split('## Naming Convention')[0] ?? ''
  const out = {}
  for (const line of sec.split('\n')) {
    // | **Vulnyx** | fox | Fox | Mana | desc |
    const m = line.match(/^\|\s*\*\*([A-Za-z]+)\*\*\s*\|\s*([a-z-]+)\s*\|\s*[^|]+\|\s*([A-Za-z]+)\s*\|/)
    if (m) out[m[1]] = { code: m[2], element: m[3].toLowerCase() }
  }
  return out
}

// world/spirits-species.md → the ruled 40 grid: { speciesName -> {mana,storm,earth,water} }
// AUTHORITATIVE per the 2026-06-22 ruling.
function canonSecondForms() {
  const txt = read(join(CANON, 'world', 'spirits-species.md'))
  const sec = txt.split('### The 40 Second Forms')[1]?.split('### Awakened Form')[0] ?? ''
  const out = {}
  for (const line of sec.split('\n')) {
    // | **Vulnyx** (fox · Mana) | **Vulnara** | Vulnarc | Vulnore | Vulnix |
    const m = line.match(/^\|\s*\*\*([A-Za-z]+)\*\*\s*\([a-z-]+\s*[·*]/)
    if (!m) continue
    const cells = line.split('|').slice(2, 6).map(nameOnly)
    if (cells.length === 4 && cells.every(Boolean)) {
      out[m[1]] = Object.fromEntries(ELEMENTS.map((e, i) => [e, cells[i]]))
    }
  }
  return out
}

// game/shimmer-master.md → the STALE quick-lookup table, keyed by normalized analog
// label ('Water Bear' → 'waterbear'). Parsed only to detect canon-vs-canon drift.
function masterSecondForms() {
  const p = join(CANON, 'game', 'shimmer-master.md')
  if (!existsSync(p)) return null
  const txt = read(p)
  const out = {}
  for (const line of txt.split('\n')) {
    // | **Fox** | Phantom Fox (Veil) | Thunder Kit (Bolt) | Den Mother (Burrow) | Stream Runner (Current) |
    const m = line.match(/^\|\s*\*\*([A-Za-z -]+)\*\*\s*\|/)
    if (!m) continue
    const cells = line.split('|').slice(2, 6).map(nameOnly)
    if (cells.length === 4 && cells.every(Boolean)) {
      out[codeKey(m[1])] = Object.fromEntries(ELEMENTS.map((e, i) => [e, cells[i]]))
    }
  }
  return out
}

// ── GAME PARSERS ───────────────────────────────────────

// spirits/spirit.ts → SPECIES_NAMES { speciesKey -> displayName }
function gameSpeciesNames() {
  const txt = read(join(GAME, 'spirits', 'spirit.ts'))
  const block = txt.split('SPECIES_NAMES')[1]?.split('}')[0] ?? ''
  const out = {}
  for (const m of block.matchAll(/'?([\w-]+)'?:\s*'([^']+)'/g)) out[m[1]] = m[2]
  return out
}

// spirits/spirit.ts → SECOND_FORM_NAMES { speciesKey -> {mana,storm,earth,water} }
function gameSecondForms() {
  const txt = read(join(GAME, 'spirits', 'spirit.ts'))
  const block = txt.split('SECOND_FORM_NAMES')[1]?.split('export ')[0] ?? ''
  const out = {}
  // fox: { mana: 'Vulnara', storm: 'Vulnarc', earth: 'Vulnore', water: 'Vulnix' },
  for (const m of block.matchAll(/'?([\w-]+)'?:\s*\{([^}]+)\}/g)) {
    const inner = {}
    for (const e of m[2].matchAll(/(\w+):\s*'([^']+)'/g)) inner[e[1]] = e[2]
    if (ELEMENTS.every((el) => inner[el])) out[m[1]] = inner
  }
  return out
}

// data/voice-profiles.ts → [{id, name}] of every NPC that ships a voice
function gameNpcs() {
  const txt = read(join(GAME, 'data', 'voice-profiles.ts'))
  const out = []
  const ids = [...txt.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1])
  const names = [...txt.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1])
  for (let i = 0; i < names.length; i++) out.push({ id: ids[i] ?? '?', name: names[i] })
  return out
}

// world/zones.ts → [displayName] of every shipped zone
function gameZones() {
  const txt = read(join(GAME, 'world', 'zones.ts'))
  return [...txt.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1])
}

// does evolution-config.ts cite a canon file, and does that file itself drift?
function evolutionConfigCitation() {
  const txt = read(join(GAME, 'spirits', 'evolution-config.ts'))
  const cites = [...txt.matchAll(/Canon source:\s*(\S+)|\/\/\s+(\S*CANON\S+)/g)]
    .map((m) => (m[1] || m[2]))
    .filter(Boolean)
  return cites
}

// ── CANON EXPECTATIONS (prose-ruled facts, cited not parsed) ──
// These live in flowing prose in shimmer-storyline.md, not in tables, so they're
// pinned here with their canon citation. Update when the ruling changes.

// v1 cast ruled 2026-06-24 (shimmer-storyline.md:122): Greg + 3 reformed Moglins.
// brack/vetch/thistle are the three holds (dialogues/ + zones.ts brack-hold/vetch-hold).
//
// ★ `sorrel` → `vetch` 2026-08-12, and THE GATE ITSELF WAS THE REASON THIS SAT WRONG FOR SIX DAYS.
// Canon renamed hold 2's Moglin on 2026-08-06 (Sorrel was already the Book 10 garden-keeper's name)
// and left the build side owed. The build still said `sorrel` — and so did this list, because it is
// a HAND TRANSCRIPTION of canon rather than a read of it. So the checker agreed with the code,
// reported CLEAN, and the drift it exists to catch was invisible in both places at once.
// **A gate that mirrors canon by hand drifts exactly like the code it is checking.** When a ruling
// lands, this file is part of the build that has to follow it.
const CANON_V1_CAST = ['gregory', 'brack', 'vetch', 'thistle', 'narrator']
// canon entities whose names a game NPC must NOT silently reuse (audit §5 collisions).
const CANON_NAMED_ENTITIES = ['Bramble', 'Echo', 'Ember', 'Dusk', 'Spore']
// ruled v1 geography — the FULL Tier-1 map (shimmer-storyline.md:37-76) plus the two
// zones ratified 2026-06-28. Spelling matters (Meadows vs Meadow; Route Two vs Route 2):
// a near-miss SHOULD flag until zones.ts is aligned to canon spelling.
const CANON_V1_ZONES = [
  'Home Plot', 'Moonwell Glade', 'Moonwell Pass', 'Mycelial Path',
  'Spirit Meadows', 'Twilight Thicket', 'Wooded Trail', 'Voranyx Caverns',
  'Mana Springs', 'Ather Winds', 'Gate to the folds',
  'Route One', 'Route Two', 'Route Three', 'Route Four', 'Route Five',
  'Brack Hold', 'Vetch Hold', 'Thistle Hold',
  'Gloview Village', 'The Outfields',
  // ruled 2026-07-22 (Alex, home-plot gate build): the Rune Hold shop interior across the
  // permanent gate — shimmer-storyline.md + shimmer-geography.md; street door stays sealed.
  'The Spirit Corner',
]
// MORTAL-SIDE canon locations (Athernyx, Year 1672 — the far side of Greg's street door).
// The list above is the ATHER-side v1 geography from shimmer-storyline.md; it has no opinion on
// the mortal continent, so a mortal-side zone read as "off-canon" purely because the check was
// looking in the wrong file. These are ruled in `world/rune-hold.md` and named in the realm map
// (`game/two-lines-two-games.md`: "Rune Hold, the Citadel, the Pyramid-Zero Crucible").
// 'The Travelers Station' + 'The Firing Range' ruled into geography 2026-08-05 (/magii + Alex,
// `world/rune-hold.md` › The Travelers Station): the way out of Rune Hold is a SKY-PORT the town
// calls the Travelers Station, and the practice range sits with it rather than on the square.
const CANON_MORTAL_ZONES = ['Rune Hold', 'The Crucible', 'Pyramid Zero', 'The Citadel', 'The Passage',
  'The Travelers Station', 'The Firing Range']
// dev/benchmark zones that are intentionally non-canon — excluded from the check.
const ZONE_IGNORE = /sandbox|demo|terrain|hub|^fp-|garden \(hub\)|large |medium |huge|chunk|bake|proof|test|[–—]/i

// ── CHECKS ─────────────────────────────────────────────

function run() {
  // 1. BASE SPECIES — canon world/ vs game SPECIES_NAMES (joined on species name)
  const cBase = canonBaseSpecies()
  const gSpec = gameSpeciesNames()  // { code -> displayName }
  let baseDrift = 0
  for (const [name, { code }] of Object.entries(cBase)) {
    if (!(code in gSpec)) { add('GAP', 'base-species', `canon base '${name}' (${code}) has no game species key`); baseDrift++; continue }
    if (gSpec[code] !== name) { add('CONFLICT', 'base-species', `${code}: game says '${gSpec[code]}', canon says '${name}'`); baseDrift++ }
  }
  if (!baseDrift) add('CLEAN', 'base-species', `all ${Object.keys(cBase).length} base species match canon`)

  // 2. SECOND FORMS — authoritative canon grid vs game SECOND_FORM_NAMES (joined on name)
  const cSec = canonSecondForms()                          // { speciesName -> forms }
  const gSecByCode = gameSecondForms()                     // { code -> forms }
  const gSecByName = {}                                    // re-key game forms by species name
  for (const [code, forms] of Object.entries(gSecByCode)) {
    if (gSpec[code]) gSecByName[gSpec[code]] = forms
  }
  let secDrift = 0
  for (const [name, forms] of Object.entries(cSec)) {
    const g = gSecByName[name]
    if (!g) { add('GAP', 'second-forms', `canon has 2nd forms for '${name}', game has none`); secDrift++; continue }
    for (const el of ELEMENTS) {
      if (g[el] !== forms[el]) {
        add('CONFLICT', 'second-forms', `${name}·${el}: game '${g[el]}' ≠ canon '${forms[el]}'`); secDrift++
      }
    }
  }
  if (!secDrift) add('CLEAN', 'second-forms', `all 40 second-form names match the ruled canon grid`)

  // 3. CANON-vs-CANON — the stale game/shimmer-master.md vs the authoritative grid
  const master = masterSecondForms()                       // { normCode -> forms }
  if (master) {
    let mDrift = 0
    for (const [name, forms] of Object.entries(cSec)) {
      const nc = cBase[name] ? codeKey(cBase[name].code) : null
      const m = nc && master[nc]
      if (!m) continue
      for (const el of ELEMENTS) {
        if (m[el] !== forms[el]) { mDrift++ }
      }
    }
    if (mDrift) {
      add('CONFLICT', 'canon-vs-canon',
        `game/shimmer-master.md disagrees with world/spirits-species.md on ${mDrift} second-form names — two canon files, one stale`,
        `world/spirits-species.md is authoritative (ruled 2026-06-22). shimmer-master.md is the pre-ruling quick-lookup and must be regenerated or deprecated.`)
    } else {
      add('CLEAN', 'canon-vs-canon', `game/shimmer-master.md agrees with the ruled grid`)
    }
  }

  // 3b. evolution-config.ts citation hygiene — does it point at a drifting file?
  const cites = evolutionConfigCitation()
  if (cites.some((c) => c.includes('shimmer-master.md')) && master) {
    add('NOTE', 'citation',
      `evolution-config.ts cites shimmer-master.md as its "Canon source" — pin it to world/spirits-species.md instead`,
      cites.join(', '))
  }

  // 4. NPCs — game voice-profiles vs the ruled v1 cast (+ collision check)
  const npcs = gameNpcs()
  let npcDrift = 0
  for (const { id, name } of npcs) {
    const key = id.replace(/_npc$/, '')
    if (CANON_V1_CAST.includes(key) || CANON_V1_CAST.includes(name.toLowerCase())) continue
    npcDrift++
    if (CANON_NAMED_ENTITIES.includes(name)) {
      add('COLLISION', 'npcs', `'${name}' (id ${id}) reuses a canon entity name for a different game character — rename or cut`)
    } else {
      add('GAP', 'npcs', `'${name}' (id ${id}) ships a voice but was retired by the 2026-06-24 cast ruling (Greg + 3 reformed Moglins)`)
    }
  }
  if (!npcDrift) add('CLEAN', 'npcs', `all shipped NPC voices are in the ruled v1 cast`)

  // 5. ZONES — game zones.ts vs the ruled v1 geography
  const zones = gameZones().filter((z) => !ZONE_IGNORE.test(z))
  const uniqZones = [...new Set(zones)]
  const offCanon = uniqZones.filter((z) =>
    ![...CANON_V1_ZONES, ...CANON_MORTAL_ZONES].some((c) => c.toLowerCase() === z.toLowerCase() || z.toLowerCase().startsWith(c.toLowerCase())))
  if (offCanon.length) {
    add('GAP', 'zones',
      `${offCanon.length} shipped zones are not in the ruled v1 geography: ${offCanon.join(', ')}`,
      `Ruled v1 map (shimmer-storyline.md): ${CANON_V1_ZONES.join(', ')}. Mortal side (world/rune-hold.md + the realm map): ${CANON_MORTAL_ZONES.join(', ')}. Off-canon zones are either expansion (rule them) or accidental canon (cut/rename).`)
  } else {
    add('CLEAN', 'zones', `all shipped zones map to ruled canon geography`)
  }

  // 6. KEEPER MOVES — play3d/keeper-moves.ts vs CANON/game/moves.md (the ONE registry)
  // Law (moves.md, ruled 2026-07-22): a move is registered ONCE in canon, then shipped. A move
  // in the build that canon doesn't carry is ACCIDENTAL CANON — the exact thing this gate exists
  // to catch. A rune-requirement mismatch is a CONFLICT: it changes who can learn the move.
  const canonMoves = canonKeeperMoves()
  const builtMoves = gameKeeperMoves()
  if (!canonMoves.size || !builtMoves.length) {
    add('BLIND', 'keeper-moves', `could not read one side (canon ${canonMoves.size}, build ${builtMoves.length}) — THE CHECK DID NOT RUN`,
      'A gate that cannot read its subject proves nothing. Usually one side MOVED: find the table and point this reader at it. Do not silence this by widening the reader until it matches something.')
  } else {
    let moveDrift = 0
    for (const m of builtMoves) {
      const c = canonMoves.get(m.name)
      if (!c) {
        moveDrift++
        add('COLLISION', 'keeper-moves',
          `'${m.name}' ships in keeper-moves.ts but is NOT registered in CANON/game/moves.md`,
          `Register it in moves.md first (one registry, ruled 2026-07-22) or cut it — a shipped unregistered move is accidental canon.`)
        continue
      }
      const a = [...m.runes].sort().join('+'), b = [...c.runes].sort().join('+')
      if (a !== b) {
        moveDrift++
        add('CONFLICT', 'keeper-moves',
          `'${m.name}' rune requirement differs — build [${a || 'none'}] vs canon [${b || 'none'}]`,
          `The requirement decides which keepers can learn it. Re-wire the build, or rule the change in moves.md.`)
      }
    }
    // canon moves not yet shipped: informational, not drift — the build lags canon by design
    const unshipped = [...canonMoves.keys()].filter((n) => !builtMoves.some((m) => m.name === n))
    if (unshipped.length) {
      add('NOTE', 'keeper-moves', `${unshipped.length} registered keeper moves not yet in the build: ${unshipped.join(', ')}`)
    }
    if (!moveDrift) add('CLEAN', 'keeper-moves', `all ${builtMoves.length} shipped keeper moves match the canon registry`)
  }

  // 7. MIST ROSTERS — voxel3d/mist-roster.ts vs CANON/game/shimmer-geography.md (ruled 2026-08-09)
  // The roster decides which spirit a player MEETS in a region, so a build-side edit is a lore
  // change wearing a lookup table. Canon ruled it region-by-region; this diffs both directions.
  const canonRost = canonMistRosters()
  const builtRost = gameMistRosters()
  if (!canonRost.size || !builtRost.size) {
    add('BLIND', 'mist-rosters', `could not read one side (canon ${canonRost.size}, build ${builtRost.size}) — THE CHECK DID NOT RUN`,
      'A gate that cannot read its subject proves nothing. Usually one side MOVED: find the table and point this reader at it. Do not silence this by widening the reader until it matches something.')
  } else {
    const base = canonBaseSpecies()                       // canon NAME -> { code, element }
    const codeOf = new Map(Object.entries(base).map(([n, v]) => [n, v.code]))
    let rostDrift = 0
    for (const [zone, canonNames] of canonRost) {
      const want = canonNames.map((n) => codeOf.get(n) ?? `?${n}`).sort()
      const got = [...(builtRost.get(zone) ?? [])].sort()
      if (!builtRost.has(zone)) {
        rostDrift++
        add('GAP', 'mist-rosters', `zone '${zone}' has a ruled mist roster that the build does not carry`,
          `Ruled in shimmer-geography.md › The mist patches: ${canonNames.join(', ') || '(empty)'}. Add it to voxel3d/mist-roster.ts.`)
        continue
      }
      if (want.join('|') !== got.join('|')) {
        rostDrift++
        add('CONFLICT', 'mist-rosters', `zone '${zone}' roster differs — build [${got.join(', ') || 'none'}] vs canon [${want.join(', ') || 'none'}]`,
          `The roster decides who a player meets there. Re-wire the build, or re-rule it in shimmer-geography.md first (Magii).`)
      }
    }
    for (const zone of builtRost.keys()) {
      if (canonRost.has(zone)) continue
      rostDrift++
      add('COLLISION', 'mist-rosters', `zone '${zone}' ships a mist roster that canon never ruled`,
        `A roster nobody ruled is accidental canon. Rule it in shimmer-geography.md, or drop it — an unruled zone must call nothing.`)
    }
    if (!rostDrift) add('CLEAN', 'mist-rosters', `all ${canonRost.size} ruled mist rosters match the build`)
  }

  // 8. BIRTH-RUNE AFFINITY — play3d/birth-affinity.ts vs CANON/game/shimmer-birth-rune.md
  //
  // ★ WHY THIS CHECK EXISTS. `AFFINITY` is twenty rows HAND-COPIED out of the canon table, and the
  // boundary that makes it safe to hand-copy is the same one that makes drift invisible: canon owns
  // the CATEGORY, Jin owns the NUMBER. So a wrong magnitude is legal and a wrong category is a lore
  // change — and both look identical in a diff. Nothing was watching the half canon owns.
  //
  // The failure is quiet by construction, which is the argument for gating it. `birthAffinity()`
  // falls back to NEUTRAL on an unknown id, so a rune canon rules and the build forgets does not
  // throw: a keeper born of it simply gets no lean at all, forever, and the birth screen still
  // offers the rune. "Your birth rune is you" resolves to nothing and nobody sees a stack trace.
  const canonLeans = canonBirthLeans()
  const builtLeans = gameBirthLeans()
  if (!canonLeans.size || !builtLeans.size) {
    add('BLIND', 'birth-affinity', `could not read one side (canon ${canonLeans.size}, build ${builtLeans.size}) — THE CHECK DID NOT RUN`,
      'A gate that cannot read its subject proves nothing. Usually one side MOVED: find the table and point this reader at it. Do not silence this by widening the reader until it matches something.')
  } else {
    let leanDrift = 0
    for (const [rune, lean] of canonLeans) {
      // A lean the build cannot express means canon grew a category with no constructor behind it.
      // Reported rather than skipped: silently dropping it is how the row would go missing below.
      if (!AFFINITY_LEANS.has(lean)) {
        leanDrift++
        add('CONFLICT', 'birth-affinity', `canon gives '${rune}' the lean '${lean}', which the build has no constructor for`,
          `birth-affinity.ts builds leans from ${[...AFFINITY_LEANS].join(' / ')}. Either add the category to the build, or the table cell is a typo.`)
        continue
      }
      const got = builtLeans.get(rune)
      if (!got) {
        leanDrift++
        add('GAP', 'birth-affinity', `'${rune}' is ruled '${lean}' in canon but carries no affinity in the build`,
          `birthAffinity() falls back to NEUTRAL, so a keeper born of ${rune} gets NO lean and nothing errors. Add it to AFFINITY in birth-affinity.ts.`)
        continue
      }
      if (got !== lean) {
        leanDrift++
        add('CONFLICT', 'birth-affinity', `'${rune}' lean differs — build '${got}' vs canon '${lean}'`,
          `The category is canon's half of the boundary (magnitudes are Jin's). Re-wire the build, or re-rule the essence in shimmer-birth-rune.md first (Magii).`)
      }
    }
    for (const rune of builtLeans.keys()) {
      if (canonLeans.has(rune)) continue
      leanDrift++
      add('COLLISION', 'birth-affinity', `'${rune}' ships an affinity that canon's table never rules`,
        `A lean nobody ruled is accidental canon — it asserts what that rune IS. Rule it in shimmer-birth-rune.md, or drop it.`)
    }
    if (!leanDrift) add('CLEAN', 'birth-affinity', `all ${canonLeans.size} birth-rune leans match the ruled essence table`)
  }

  // 9. ELEMENT HERBS — engine/farming.ts vs CANON/game/shimmer-skilling.md (tier-2 table)
  //
  // ★ WHY THIS CHECK EXISTS. The four element herbs are the ingredient half of the infusion
  // economy, and the infusions are canon's ONLY road to an evolved form. Which herb carries which
  // element is therefore a claim about the world, hand-copied into a build file — the same shape as
  // the birth-rune leans above, with a longer fuse.
  //
  // The failure is silent at every step. `ELEMENT_HERBS` pointing at a cropId that does not exist
  // does not throw; nothing plants, nothing harvests, no brew ever gets its ingredient, so
  // `dominantInfusion()` returns null for that element forever and the ten canon second forms
  // behind it are unreachable — while the game runs fine and the other three elements work. A
  // keeper would experience it as "Earth spirits just don't seem to evolve."
  //
  // ⚠ WHAT IS DELIBERATELY NOT GATED: the growth times (20/20/25/20 min). Canon prints them, but
  // alchemy.md's 07-30 boundary hands Jin the level gates and durations — they are magnitudes, and
  // gating a magnitude fails the build on a canon copy-edit. Canon owns THAT the herb exists and
  // WHICH element it carries. That is what this reads.
  const canonHerbs = canonElementHerbs()
  const builtHerbs = gameElementHerbs()
  const builtCropNames = gameCropNames()
  if (!canonHerbs.size || !builtHerbs.size) {
    add('BLIND', 'element-herbs', `could not read one side (canon ${canonHerbs.size}, build ${builtHerbs.size}) — THE CHECK DID NOT RUN`,
      'A gate that cannot read its subject proves nothing. Usually one side MOVED: find the table and point this reader at it. Do not silence this by widening the reader until it matches something.')
  } else {
    let herbDrift = 0
    for (const [element, herbName] of canonHerbs) {
      const built = builtHerbs.get(element)
      if (!built) {
        herbDrift++
        add('GAP', 'element-herbs', `canon's ${element} herb '${herbName}' has no crop in the build`,
          `Nothing grants a ${element} infusion, so dominantInfusion() never returns '${element}' and the ten canon second forms behind it are unreachable. Add it to CROP_DEFS + ELEMENT_HERBS in voxel/crops.ts.`)
        continue
      }
      const shippedName = builtCropNames.get(built)
      if (!shippedName) {
        herbDrift++
        add('GAP', 'element-herbs', `ELEMENT_HERBS points '${element}' at cropId '${built}', which is not in CROP_DEFS`,
          `A dangling cropId is the quiet version of a missing herb — nothing throws, the element is simply unplantable forever.`)
        continue
      }
      if (shippedName.toLowerCase() !== herbName.toLowerCase()) {
        herbDrift++
        add('CONFLICT', 'element-herbs', `the ${element} herb is named '${shippedName}' in the build, '${herbName}' in canon`,
          `The herb's name is canon's half (its numbers are Jin's). Rename the crop, or re-rule the plant in shimmer-skilling.md first (Magii).`)
      }
    }
    for (const element of builtHerbs.keys()) {
      if (canonHerbs.has(element)) continue
      herbDrift++
      add('COLLISION', 'element-herbs', `the build ships an element herb for '${element}', which canon's tier-2 table never rules`,
        `A fifth element, or a renamed one — either way it is accidental canon. Rule it in shimmer-skilling.md, or drop it.`)
    }
    if (!herbDrift) add('CLEAN', 'element-herbs', `all ${canonHerbs.size} element herbs match the ruled tier-2 table`)
  }

  // 10. THE ELEMENTAL INFUSIONS — engine/alchemy.ts vs CANON/game/{alchemy,shimmer-skilling}.md
  //
  // ★ WHY THIS CHECK EXISTS, AND WHY IT IS NOT COVERED BY #9. Gate 9 reads which HERB carries which
  // element. This reads the other end of the same chain: which BREW carries which element, and what
  // canon says goes into it. `alchemy.md` (RULED 2026-07-30) makes the four Infusions the spine of
  // alchemy and the ONLY road to an evolved form; `shimmer-skilling.md` names each element's
  // catalyst crystal. Both are canon claims hand-copied into a recipe table a tuning editor rewrites.
  //
  // ⚠ THE FAILURE THIS IS REALLY FOR IS A SWAP, NOT AN ABSENCE. A storm brew catalysed by a water
  // crystal, or fed by tidepetal, is perfectly legal code that compiles, brews, and sells — and it
  // quietly hands the keeper the WRONG one of four ruled second forms. In a diff it is one word.
  // That is gate #8's lesson (canon owns the category, Jin owns the number, and a wrong category
  // looks exactly like a wrong number) applied to the economy canon calls its money-maker.
  //
  // ⚠ DELIBERATELY NOT GATED: counts, level gate, mana, XP and yield. alchemy.md's boundary hands
  // Jin every magnitude — gating one fails the build on a canon copy-edit.
  const canonCat = canonInfusionCatalysts()
  const brews = gameInfusionBrews()
  const recipes = gamePotionRecipes()
  const herbItems = gameElementHerbItems()
  if (!canonCat.size || !brews.size) {
    add('BLIND', 'infusions', `could not read one side (canon ${canonCat.size}, build ${brews.size}) — THE CHECK DID NOT RUN`,
      'A gate that cannot read its subject proves nothing. Usually one side MOVED: find the table and point this reader at it. Do not silence this by widening the reader until it matches something.')
  } else {
    let infDrift = 0
    for (const [element, crystalName] of canonCat) {
      const potionId = brews.get(element)
      if (!potionId) {
        infDrift++
        add('GAP', 'infusions', `canon rules a ${element} infusion and the build brews none`,
          `The Infusions are canon's only road to an evolved form, so nothing can ever grant '${element}' and the ten second forms behind it are unreachable. Add it to POTION_DEFS + INFUSION_BREWS in engine/alchemy.ts.`)
        continue
      }
      const recipe = recipes.get(potionId)
      if (!recipe) {
        infDrift++
        add('GAP', 'infusions', `INFUSION_BREWS points '${element}' at '${potionId}', which is not in POTION_DEFS`,
          `A dangling potion id is the quiet version of a missing brew — nothing throws, the element is simply unbrewable forever.`)
        continue
      }
      const crystalId = crystalName.toLowerCase().replace(/\s+/g, '_')
      if (!recipe.includes(crystalId)) {
        infDrift++
        add('CONFLICT', 'infusions', `the ${element} infusion is not catalysed by canon's '${crystalName}'`,
          `shimmer-skilling.md rules ${crystalName} the ${element} infusion catalyst; the recipe reads ${recipe.join(' + ')}. Fix the recipe, or re-rule the catalyst first (Magii).`)
      }
      const herb = herbItems.get(element)
      if (herb && !recipe.includes(herb)) {
        infDrift++
        add('CONFLICT', 'infusions', `the ${element} infusion is not fed by the ${element} herb`,
          `alchemy.md rules the Infusions are fed by the four element herbs. Feeding it '${recipe.join(' + ')}' means the keeper farms one element and their spirit grows into another — legal code, wrong world.`)
      }
    }
    for (const element of brews.keys()) {
      if (canonCat.has(element)) continue
      infDrift++
      add('COLLISION', 'infusions', `the build brews an infusion for '${element}', which canon's crystal table never rules`,
        `A fifth element, or a renamed one — either way it is accidental canon on the road to an evolved form. Rule it, or drop it.`)
    }
    if (!infDrift) add('CLEAN', 'infusions', `all ${canonCat.size} elemental infusions match canon's catalysts and herbs`)

// ── GATE 11: RETIRED VOCABULARY ─────────────────────────────────────────────
// ★★★ A RENAMED NOUN IS INVISIBLE TO A TYPE CHECKER, AND THAT IS THE HOLE THIS FILLS.
// The world lane's `SocketKind` was `gate | waymark` — a compile-error-strength guard, green the
// whole time, and one word off the noun a later ruling settled. A guard cannot notice that its own
// vocabulary retired; only re-reading the ruling does. Canon now publishes retirements as a TABLE
// (`game/shimmer-geography.md` › RETIRED VOCABULARY) whose header says in as many words that it
// exists *"for the drift gate to read"* — canon cannot see the build, and that table is the only
// place a rename becomes machine-readable.
//
// ⚠⚠ AND A NAIVE TERM GREP WOULD BE WORSE THAN NOTHING. "gate" is retired only for travel that stays
// INSIDE the Ather; it is the correct and canon-ruled word for a crossing out of it, so a bare grep
// lights up every legitimate use in the codebase. A guard that cries wolf gets switched off, and a
// switched-off guard is the failure mode this whole file exists to prevent.
//
// ★ SO SEVERITY IS DECIDED PER TERM, HERE, AND CANON OWNS ONLY THE LIST. A retirement canon adds
// that this gate has no rule for is reported BLIND — never passed over — so Magii adding a row
// surfaces as "the gate cannot check this yet" instead of silently reading clean. That is the
// holds-gate lesson: "I found no drift" and "I could not look" must not share an exit code.
function canonRetiredVocabulary() {
  const txt = read(join(CANON, 'game', 'shimmer-geography.md'))
  const sec = txt.split('RETIRED VOCABULARY')[1]?.split('### Boundary')[0] ?? ''
  const out = []
  for (const line of sec.split('\n')) {
    const m = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/)
    if (!m || /^-+$/.test(m[1]) || /^Retired$/i.test(norm(m[1]))) continue
    // The cell carries a qualifier ("**clan** (as a canon noun)") — the TERM is the emphasised part.
    const term = (m[1].match(/\*\*([^*]+)\*\*/) ?? m[1].match(/\*([^*]+)\*/))?.[1]?.trim()
    if (term) out.push({ term, useInstead: norm(m[2]), retiredOn: norm(m[3]) })
  }
  return out
}

{
  const retired = canonRetiredVocabulary()
  // ⚠ Per-term rules. `fail` means an occurrence is drift; `review` means the gate can find it but
  // cannot judge it, so it reports without failing. A term absent here is BLIND, never clean.
  const RULES = {
    clan:     { mode: 'fail',   why: 'a canon noun the world does not use — the world says chord' },
    shipyard: { mode: 'fail',   why: 'there is one keeper home and it is the home plot / fold' },
    gate:     { mode: 'review', why: 'retired ONLY for travel that stays inside the Ather; correct for a crossing OUT' },
    rune:     { mode: 'review', why: 'retired only as a thing BOUGHT — a crafted/gifted rune is canon' },
  }
  if (!retired.length) {
    add('BLIND', 'retired-vocab', 'could not read the RETIRED VOCABULARY table — THE CHECK DID NOT RUN',
      'game/shimmer-geography.md > RETIRED VOCABULARY is the source. If the heading or table shape moved, point this reader at it. Do not delete this gate to make the run green.')
  } else {
    const SRC = '/root/ather-games/src/app/shimmer'
    let vocabDrift = 0
    for (const r of retired) {
      const key = r.term.toLowerCase().replace(/[^a-z]/g, '')
      const rule = RULES[key]
      if (!rule) {
        vocabDrift++
        add('BLIND', 'retired-vocab', `canon retired '${r.term}' (${r.retiredOn}) and this gate has no rule for it — THE TERM WAS NOT CHECKED`,
          `Add a rule in canon-drift.mjs RULES: 'fail' if any occurrence is drift, 'review' if the word is still legitimate in another sense. Leaving it unlisted reads as clean and is not.`)
        continue
      }
      // ⚠⚠ SUBSTRING, NOT `\bword\b`, AND THE FIRST VERSION OF THIS GATE WAS DECORATION BECAUSE OF IT.
      // A word-boundary pattern cannot match a retired noun INSIDE AN IDENTIFIER — `ClanId`,
      // `clanName`, `CLAN_SIZE` — and an identifier is precisely where the motivating bug lived
      // (`SocketKind = 'gate' | 'waymark'`). Mutation-tested it by shipping `ClanId` in the build:
      // the gate read CLEAN. ★ A guard aimed at names in TYPES must search the way names are WRITTEN,
      // and code writes them camelCased, PascalCased and SCREAMING_SNAKE, never spaced.
      // ⚠ The cost is that a `fail`-mode term must be one whose substring is unambiguous. That is a
      // real constraint on the RULES table above, not a property of the canon table — a term that
      // appears inside unrelated words belongs in `review`, where a human reads the hits.
      //
      // ★★ PROSE COUNTS, AND THAT IS DELIBERATE. This gate fired on the console oracle for holding a
      // retired noun in a literal array, and then fired AGAIN on the comment explaining the first
      // hit — the documenting-a-marker-creates-a-marker shape, twice in one commit. The tempting fix
      // is to strip comments before matching. It is the wrong one: **a retired noun sitting in a
      // comment is exactly what the next person copies into code**, which is how vocabulary drifts
      // back in. So the guard counts prose, and the price is that you write about a retirement
      // without naming it. Cheap, and it keeps the guard honest about what it can see.
      let hits = []
      try {
        hits = execSync(`grep -rni "${key}" --include=*.ts --include=*.tsx ${SRC} || true`,
          { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
      } catch { hits = [] }
      if (!hits.length) continue
      const where = hits.slice(0, 4).map((h) => h.split('/shimmer/')[1]?.split(':').slice(0, 2).join(':')).join(' · ')
      if (rule.mode === 'fail') {
        vocabDrift++
        add('COLLISION', 'retired-vocab', `'${r.term}' is retired (${r.retiredOn}) and still ships in ${hits.length} place(s) — use '${r.useInstead}'`,
          `${rule.why}. First hits: ${where}. A retired noun in a TYPE is the shape that stays green forever.`)
      } else {
        add('NOTE', 'retired-vocab', `'${r.term}' appears ${hits.length}x and is retired in one sense only — not judged here`,
          `${rule.why}. This gate can find the word and cannot read the intent, so it reports rather than fails. First hits: ${where}.`)
      }
    }
    if (!vocabDrift) add('CLEAN', 'retired-vocab', `no fully-retired noun ships; ${retired.length} retirement(s) read from canon`)
  }
}
  }
}

// ── mist-roster helpers ────────────────────────────────
/**
 * The ruled rosters in CANON/game/shimmer-geography.md › "### The rosters — ruled".
 * Table shape: | **Spirit Meadows** (`spirit-meadow`) | ground character | **Lepara** *(canon…)* · **Dewbear** |
 * Zone id comes from the backticked code so a prose rename of the region cannot break the join.
 * `gloview-village` is ruled EMPTY in prose rather than in the table, and is added explicitly —
 * an empty ruling is still a ruling and the build must carry it.
 */
function canonMistRosters() {
  const out = new Map()
  const p = join(CANON, 'game', 'shimmer-geography.md')
  if (!existsSync(p)) return out
  const txt = read(p)
  const sec = txt.split('### The rosters — ruled')[1]?.split('### ★ A MIST SPAR')[0] ?? ''
  if (!sec) return out
  for (const line of sec.split('\n')) {
    const m = line.match(/^\|\s*\*\*[^|]*?\*\*\s*\(`([a-z-]+)`\)\s*\|[^|]*\|\s*(.+?)\s*\|\s*$/)
    if (!m) continue
    const names = m[2]
      .split('·')
      .map((s) => s.replace(/\*\(.*?\)\*/g, '').replace(/\*/g, '').trim())   // drop the *(canon …)* notes
      .filter(Boolean)
    out.set(m[1], names)
  }
  // ⚠ The corridor/edge zones are ruled in the section's PROSE, not its table, and canon prose
  // wraps. The first cut matched with `[^\n]*?` and silently found nothing — which surfaced as
  // "the-outfields ships a roster canon never ruled", i.e. the gate accusing the BUILD of drift
  // for a bug in the gate. Flatten the section before matching prose rules; the table above is
  // parsed line-by-line first, so flattening here cannot disturb it.
  //
  // The tool bends to how canon is written, never the reverse — a canon file reshaped to suit a
  // regex is a canon file edited by the build, which is the boundary this whole script defends.
  const flat = sec.replace(/\s+/g, ' ')
  if (/\*\*Gloview Village\*\* grows no mist/.test(flat)) out.set('gloview-village', [])
  const edge = flat.match(/\*\*The Outfields\*\*\s*\(`the-outfields`\)(.*?)(?:A guttering patch|$)/)
  if (edge) {
    // Species are the **Capitalised** bolds; skip bolded emphasis words like **thin**.
    const names = [...edge[1].matchAll(/\*\*([A-Z][a-z]+)\*\*/g)].map((x) => x[1])
      .filter((n) => codeKey(n) in Object.fromEntries(Object.keys(canonBaseSpecies()).map((k) => [codeKey(k), 1])))
    out.set('the-outfields', names)
  }
  return out
}

/** The rosters shipped in voxel3d/mist-roster.ts (species CODES). */
function gameMistRosters() {
  const out = new Map()
  const p = join(GAME, 'voxel3d', 'mist-roster.ts')
  if (!existsSync(p)) return out
  const txt = read(p)
  const body = txt.split('export const MIST_ROSTERS')[1]?.split('export const MIST_CORRIDORS')[0] ?? ''
  for (const m of body.matchAll(/'([a-z-]+)'\s*:\s*\[([^\]]*)\]/g)) {
    out.set(m[1], [...m[2].matchAll(/'([^']+)'/g)].map((s) => s[1]))
  }
  return out
}

// ── keeper-move helpers ────────────────────────────────
const RUNE_NAMES = ['Manalic','Barrier','Star','Life','Enchant','Lightning','Tempest','Breeze','Static',
  'Illuminate','Stone','Gem','Magma','Dust','Metalergy','Freeze','Hydro','Mist','Fluid','Vapor']

/** Keeper moves registered in CANON/game/moves.md (the section ABOVE the spirit kits). */
function canonKeeperMoves() {
  const out = new Map()
  const p = join(CANON, 'game', 'moves.md')
  if (!existsSync(p)) return out
  const txt = read(p).split('# Spirit Kits')[0]
  for (const line of txt.split('\n')) {
    const m = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|\s*(.*?)\s*\|/)
    if (!m) continue
    const runes = RUNE_NAMES.filter((r) => new RegExp(`\\b${r}\\b`).test(m[2])).map((r) => r.toLowerCase())
    out.set(norm(m[1]), { runes })
  }
  return out
}

/** Keeper moves shipped in the build's registry. */
function gameKeeperMoves() {
  const p = join(GAME, 'play3d', 'keeper-moves.ts')
  if (!existsSync(p)) return []
  const txt = read(p)
  const body = txt.split('export const KEEPER_MOVES')[1] ?? ''
  const out = []
  for (const m of body.matchAll(/name:\s*'([^']+)'[\s\S]{0,80}?runes:\s*\[([^\]]*)\]/g)) {
    const runes = [...m[2].matchAll(/'([^']+)'/g)].map((r) => r[1])
    out.push({ name: m[1], runes })
  }
  return out
}

// ── birth-affinity helpers ─────────────────────────────
/** The five lean categories the build can actually construct (birth-affinity.ts). */
const AFFINITY_LEANS = new Set(['vitality', 'defense', 'mobility', 'utility', 'offense'])

/**
 * The ruled leans in CANON/game/shimmer-birth-rune.md › "## Essence → affinity lean (v1)".
 * Table shape: | Magma | Earth·Ignite | slow, unstoppable, melts through | offense — heavy/armor-break |
 *
 * Only the FIRST word of the lean cell is read, and that is the boundary in one line: the category
 * ('offense') is canon's, the prose after it ('heavy / armor-break') is intent Jin reads but is not
 * gated on — pinning the flavour text would fail the build on a canon copy-edit.
 *
 * The scan is bounded to that one section on purpose. The file carries other tables, and a parser
 * that swept the whole document would silently harvest rows from whichever table canon adds next.
 */
function canonBirthLeans() {
  const out = new Map()
  const p = join(CANON, 'game', 'shimmer-birth-rune.md')
  if (!existsSync(p)) return out
  const sec = read(p).split(/^##\s+Essence.*affinity lean/m)[1]
  if (!sec) return out
  for (const line of sec.split(/^##\s/m)[0].split('\n')) {
    const m = line.match(/^\|\s*([A-Za-z]+)\s*\|[^|]*\|[^|]*\|\s*([^|]+?)\s*\|/)
    if (!m) continue
    const rune = norm(m[1]).toLowerCase()
    if (rune === 'rune') continue                       // the header row
    out.set(rune, norm(m[2]).split(/[\s—]+/)[0].toLowerCase())
  }
  return out
}

/** The leans the build ships, read off the AFFINITY table's constructor per rune. */
function gameBirthLeans() {
  const out = new Map()
  const p = join(GAME, 'play3d', 'birth-affinity.ts')
  if (!existsSync(p)) return out
  const txt = read(p)
  const body = (txt.split('const AFFINITY')[1] ?? '').split('NEUTRAL_AFFINITY')[0]
  for (const m of body.matchAll(/^\s*([a-z]+):\s*([a-z]+)\(/gm)) out.set(m[1], m[2])
  return out
}

// ── element-herb helpers ───────────────────────────────
/**
 * The ruled element herbs in CANON/game/shimmer-skilling.md › "Tier 2 ... (Element Herbs)".
 * Table shape: | **Violetbloom** | 20 min | Mana infusion ingredient | Deep purple petals ... |
 * Returns element -> herb name, keyed by ELEMENT because that is the half canon owns: the plant
 * may be renamed, but "something feeds the Storm infusion" is structural.
 *
 * The scan is bounded to that one tier block. The file carries four resource tables and a recipe
 * table, and an unbounded sweep would harvest the Mana Infusion RECIPE rows as herbs.
 */
function canonElementHerbs() {
  const out = new Map()
  const p = join(CANON, 'game', 'shimmer-skilling.md')
  if (!existsSync(p)) return out
  const sec = read(p).split(/^\*\*Tier 2[^\n]*Element Herbs[^\n]*\*\*/m)[1]
  if (!sec) return out
  for (const line of sec.split(/^\*\*Tier 3/m)[0].split('\n')) {
    // | **Violetbloom** | 20 min | Mana infusion ingredient | ... |
    const m = line.match(/^\|\s*\*\*([A-Za-z]+)\*\*\s*\|[^|]*\|\s*([A-Za-z]+)\s+infusion ingredient/i)
    if (!m) continue
    const el = norm(m[2]).toLowerCase()
    if (ELEMENTS.includes(el)) out.set(el, norm(m[1]))
  }
  return out
}

/** element -> cropId, read off ELEMENT_HERBS in engine/farming.ts. */
function gameElementHerbs() {
  const out = new Map()
  // ⚠ voxel/crops.ts, NOT engine/farming.ts. The crop roster moved into the portable core on
  // 2026-08-22 (§ 6 rule 4); farming.ts re-exports it, so a reader aimed there finds the re-export
  // line and never the table — which is how this gate went blind and still printed a passing run.
  const p = join(GAME, 'voxel', 'crops.ts')
  if (!existsSync(p)) return out
  // ⚠ ANCHORED AT LINE START. A `split('export const ELEMENT_HERBS')` also matches the words inside
  // a comment, and then this parses prose and reports zero — which used to read as "check skipped".
  const body = (read(p).split(/^export const ELEMENT_HERBS/m)[1] ?? '').split('\n}')[0]
  for (const m of body.matchAll(/^\s*([a-z]+):\s*\{\s*cropId:\s*'([^']+)'/gm)) out.set(m[1], m[2])
  return out
}

/** element -> canon catalyst crystal name, off the Tier-2 Element Crystals table. */
function canonInfusionCatalysts() {
  const out = new Map()
  const p = join(CANON, 'game', 'shimmer-skilling.md')
  if (!existsSync(p)) return out
  const sec = read(p).split(/^\*\*Tier 2[^\n]*Element Crystals[^\n]*\*\*/m)[1]
  if (!sec) return out
  for (const line of sec.split(/^\*\*Tier 3/m)[0].split('\n')) {
    // | **Violet Crystal** | Deep purple, inner glow | Mana infusion catalyst | ... |
    const m = line.match(/^\|\s*\*\*([A-Za-z ]+?)\*\*\s*\|[^|]*\|\s*([A-Za-z]+)\s+infusion catalyst/i)
    if (!m) continue
    const el = norm(m[2]).toLowerCase()
    if (ELEMENTS.includes(el)) out.set(el, norm(m[1]))
  }
  return out
}

/** element -> potionId, read off INFUSION_BREWS in engine/alchemy.ts. */
function gameInfusionBrews() {
  const out = new Map()
  const p = join(GAME, 'engine', 'alchemy.ts')
  if (!existsSync(p)) return out
  const body = (read(p).split('export const INFUSION_BREWS')[1] ?? '').split('\n}')[0]
  for (const m of body.matchAll(/^\s*([a-z]+):\s*'([^']+)'/gm)) out.set(m[1], m[2])
  return out
}

/** potionId -> [ingredient itemIds], read off POTION_DEFS in engine/alchemy.ts. */
function gamePotionRecipes() {
  const out = new Map()
  const p = join(GAME, 'engine', 'alchemy.ts')
  if (!existsSync(p)) return out
  const body = (read(p).split('export const POTION_DEFS')[1] ?? '').split('\nexport const POTION_IDS')[0]
  for (const m of body.matchAll(/^\s*([a-z_0-9]+):\s*\{[\s\S]*?recipe:\s*\[([^\]]*)\]/gm)) {
    out.set(m[1], [...m[2].matchAll(/itemId:\s*'([^']+)'/g)].map(x => x[1]))
  }
  return out
}

/** element -> harvest item id, off ELEMENT_HERBS in engine/farming.ts. */
function gameElementHerbItems() {
  const out = new Map()
  const p = join(GAME, 'engine', 'farming.ts')
  if (!existsSync(p)) return out
  const body = (read(p).split('export const ELEMENT_HERBS')[1] ?? '').split('\n}')[0]
  for (const m of body.matchAll(/^\s*([a-z]+):\s*\{[^}]*harvestItemId:\s*'([^']+)'/gm)) out.set(m[1], m[2])
  return out
}

/** cropId -> display name, read off CROP_DEFS in engine/farming.ts. */
function gameCropNames() {
  const out = new Map()
  // ⚠ See gameElementHerbs — the roster lives in voxel/crops.ts now.
  const p = join(GAME, 'voxel', 'crops.ts')
  if (!existsSync(p)) return out
  // ⚠ ANCHORED — see gameElementHerbs. This one really did parse a comment instead of the table.
  const body = (read(p).split(/^export const CROP_DEFS/m)[1] ?? '').split(/^export const CROP_IDS/m)[0]
  for (const m of body.matchAll(/^\s*id:\s*'?([A-Za-z_]+)'?,\s*name:\s*'([^']+)'/gm)) out.set(m[1], m[2])
  return out
}

// ── REPORT ─────────────────────────────────────────────
// ★★★ `BLIND` EXISTS BECAUSE A GATE THAT CANNOT READ ITS SUBJECT USED TO REPORT `ℹ ... check
// skipped` AND EXIT 0. Five of the ten gates have that branch, so five could go dark on a run that
// printed a passing verdict — the exact shape this file's own scope banner rails about, wearing the
// costume of a note. It was not hypothetical: the crop roster moved to voxel/crops.ts on 2026-08-22,
// `element-herbs` went blind, and the run said "1 NOTE, 9 CLEAN" and exited 0.
//
// ⚠ AN ABSENCE CLAIM NEEDS A STRONGER MEASUREMENT THAN A PRESENCE CLAIM. "I found no drift" and "I
// could not look" are different sentences and must not share an exit code. BLIND counts as drift.
// ── ⛔ HELD: A DIVERGENCE ALEX HAS RULED, WHICH IS NOT DRIFT ───────────────────────────────────
//
// ── ★★★ WHY THIS SEVERITY EXISTS ──────────────────────────────────────────────────────────────
// `CANON/game/runes.md` records a HOLD on `eligibleMoves` and says, in canon's own words, that the
// gate "will report this difference forever" and that it "must not be closed as drift by anyone but
// Alex". Both halves were true, and together they made this gate PERMANENTLY RED — which is the
// worst state a gate can be in. A red that everyone knows is expected is a red nobody reads, and
// the next genuine drift arrives into a report that already said 1 CONFLICT yesterday.
//
// So a held divergence is reported as its own thing: printed loudly, named, cited, and NOT counted
// toward the exit code. Nothing is closed — the difference is still on the page every single run.
// What changes is that the gate can go green again, so a NEW conflict is the only thing that turns
// it red. (Alex ruled this shape on 2026-08-27.)
//
// ── ⚠⚠ THE EXEMPTION IS WRITTEN SO THAT IT EXPIRES, WHICH IS THE ONLY REASON IT IS SAFE ────────
// A hand-kept exemption list is the thing still sitting there a month after its reason died — this
// repo has the scars. So a hold does not merely assert itself:
//   · it CITES the canon text that creates it, and that text is re-read from canon on every run.
//     If Magii deletes or rewrites the ruling, the citation stops matching, the hold goes VOID, and
//     the divergence returns to CONFLICT by itself. Nobody has to remember.
//   · it must MATCH something. A hold that excuses nothing is reported as stale, so a fixed build
//     cannot leave a dead exemption behind quietly excusing a future bug.
//   · it matches ONE exact finding message, never an area. Holding all of `keeper-moves` would
//     silence every future rune drift in the file — the exemption that outlives its reason, wearing
//     a ruling as a badge.
// ── ⚠⚠ RETIRED 2026-08-27, AND THE REASON MATTERS MORE THAN THE ENTRY DID ──────────────────────
// There was one hold here, anchored to the message
//   "'Gate' rune requirement differs — build [enchant] vs canon [enchant+illuminate+metalergy]"
// and its `why` recorded Alex's 2026-08-26 HOLD on the BUILD's `eligibleMoves` scoping (tacticals
// <- element lane, signature <- state lane).
//
// ★★ THOSE ARE TWO DIFFERENT DECISIONS AND THE HOLD ANCHORED TO A PROXY. Alex held the equip
// FILTER; the message it matched was about a MOVE'S RUNE LIST. On 2026-08-27 canon ruled the rune
// list separately (`moves.md` § THE TWO STARVED STATE LANES — Gate is the whole Bind trifecta,
// "corrected on proof, not on preference", because the one-rune reading makes canon's flagship
// gate-mage illegal), Alex asked for that fix by name, and the build now matches. So the anchor
// resolved by a route that has nothing to do with what was held, and the hold went stale.
//
// ⚠ AND THE SCOPING HOLD ITSELF STILL STANDS. `runes.md:287`: *"This is a deliberate, known
// divergence between canon and the build… the drift gate cannot tell a held decision from an
// accident… it must NOT be 'fixed' without Alex. Revisit when the equip layer is next opened."*
// It is recorded here rather than deleted with the entry, because canon says that divergence is a
// legal place for a build to stand **as long as it is written down** — and the entry was the only
// machine-readable copy. Deleting it as "a dead exemption" would have deleted the record.
//
// ★ THERE IS NOTHING TO RE-ANCHOR IT TO: the gate produces no finding about `eligibleMoves`
// scoping at all (checked). A hold with no finding is reported stale by design, so re-adding one
// pointed at nothing would just re-create this note as noise every run. If the gate ever learns to
// diff the equip filter, the hold comes back with its own message.
const CANON_HOLDS = []

function applyCanonHolds() {
  let healthy = 0
  for (const h of CANON_HOLDS) {
    // ⚠ RE-READ FROM CANON EVERY RUN. This is the whole expiry mechanism; a hold that trusted its
    // own `why` string would be a note about a ruling rather than a check on one.
    let canonTxt = ''
    try { canonTxt = read(join(CANON, h.citeFile)) } catch { canonTxt = '' }
    if (!canonTxt) {
      add('BLIND', 'canon-holds', `could not read ${h.citeFile} to verify the hold on ${h.area} — THE HOLD WAS NOT VERIFIED`,
        'A hold that cannot check its own premise must not silence anything. The divergence stays CONFLICT.')
      continue
    }
    if (!canonTxt.includes(h.cite)) {
      add('CONFLICT', 'canon-holds', `the hold on ${h.area} cites ${h.citeFile} text that is no longer there — the hold is VOID`,
        `Looked for "${h.cite}". The ruling was rewritten or lifted, so the divergence below is drift again. Remove this entry from CANON_HOLDS once the build matches canon.`)
      continue
    }
    const hit = findings.filter((f) => f.severity === 'CONFLICT' && f.area === h.area && f.msg === h.message)
    if (hit.length === 0) {
      // The ORDER_ORPHANS shape: an exemption excusing nothing is an exemption nobody will remove.
      add('NOTE', 'canon-holds', `the hold on ${h.area} matched no finding — the divergence it excuses is gone`,
        `Delete it from CANON_HOLDS. A hold left behind quietly excuses whatever next produces that exact message.`)
      continue
    }
    for (const f of hit) { f.severity = 'HELD'; f.detail = `${h.why}  [held by ${h.citeFile}: "${h.cite}"]` }
    healthy++
  }
  // ⚠ ALWAYS EMIT SOMETHING FOR THIS AREA, even when every hold is healthy. Two reasons, and the
  // second is the one that bites: (1) a held divergence must stay VISIBLE every run — Alex's ruling
  // is that nothing is closed, only reclassified; (2) `PINNED_AREAS` is compared to the live area
  // set by EXACT EQUALITY, so an area that appears only when something is wrong makes the scope
  // self-check fail — with exit 3 and a message about the banner — precisely when the gate has
  // something real to say. An area that blinks in and out is worse than one that is always there.
  add('CLEAN', 'canon-holds', CANON_HOLDS.length === 0
    ? 'no held divergences'
    : `${healthy} of ${CANON_HOLDS.length} ruled hold(s) verified against canon and reported as HELD, not drift`)
}
const ICON = { CLEAN: '🟢', GAP: '🔴', CONFLICT: '🟡', COLLISION: '⚠', BLIND: '🙈', HELD: '⛔', NOTE: 'ℹ' }
const ORDER = ['CONFLICT', 'COLLISION', 'GAP', 'BLIND', 'HELD', 'NOTE', 'CLEAN']

function summarize() {
  const counts = {}
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1
  return counts
}

function toMarkdown(counts) {
  const ts = new Date().toISOString()
  let md = `# Shimmer ↔ Canon — Drift Report\n\n`
  md += `> Auto-generated by \`scripts/canon-drift.mjs\` · ${ts}\n`
  md += `> Authoritative canon: \`/root/athernyx/CANON/\` · Game build: \`src/app/shimmer/\`\n`
  md += `> This tool reports; it never edits. Route each finding: rule it in canon (Magii) or re-wire the game (Jin).\n\n`
  md += `**Summary:** ` + ORDER.filter((s) => counts[s]).map((s) => `${ICON[s]} ${counts[s]} ${s}`).join(' · ') + `\n\n`
  for (const sev of ORDER) {
    const items = findings.filter((f) => f.severity === sev)
    if (!items.length) continue
    md += `## ${ICON[sev]} ${sev} (${items.length})\n\n`
    for (const f of items) {
      md += `- **[${f.area}]** ${f.msg}\n`
      if (f.detail) md += `  - ${f.detail}\n`
    }
    md += `\n`
  }
  return md
}

// ── GATE 13: CREATURE SIZES ─────────────────────────────────────────────────
// ★★★ THIS IS THE GATE THAT STOPS A TRANSCRIPTION BECOMING A HAND-KEPT MIRROR.
// `sprites/creature-size.ts` carries a height per species. Until 2026-08-27 those were the build
// reading the books for itself; Magii + Alex then RULED the sizes, so the build's table is now a
// COPY of `design-briefs/base-forms.md`'s `Size (young base form)` lines. A copy and its original
// agree perfectly right up until they silently stop, and then the copy reads as corroboration —
// which is the exact shape PATTERNS warns is worse than an omission, because a stale mirror
// manufactures a green at the moment somebody goes looking.
//
// ⚠ THE METRE FIGURE IS THE LOOSER HALF AND CANON SAYS SO. Canon's fact is the COMPARISON ("shin-high",
// "thumb-sized"); the number exists so the build has something to draw. So a mismatch here is a NOTE
// worth a human's eye when it is small, and a CONFLICT when the two disagree about the creature.
// The threshold is 20% — under that is rounding, over it is a different animal.
function canonCreatureSizes() {
  const txt = read(join(CANON, 'design-briefs', 'base-forms.md'))
  const out = new Map()
  let code = null
  for (const line of txt.split('\n')) {
    // "## 9. Dewbear (water-bear / tardigrade) — Earth affinity" -> code 'water-bear'
    const h = line.match(/^##\s*\d+\.\s*\w+\s*\(([^)]+)\)/)
    if (h) { code = h[1].split('/')[0].trim(); continue }
    const m = line.match(/^-\s*\*\*Size \(young base form\):\*\*.*?\(~([\d.]+)m\)/)
    if (m && code) { out.set(code, Number(m[1])); code = null }
  }
  return out
}
function gameCreatureSizes() {
  const txt = read('/root/ather-games/src/app/shimmer/sprites/creature-size.ts')
  // Only the SIZES literal, so a metre figure quoted inside a comment or a source string cannot
  // enter the table. (The file's own header quotes numbers; a whole-file scan would read them.)
  const body = txt.split('export const SIZES')[1]?.split('export const BASE_FORM_MAX')[0] ?? ''
  const out = new Map()
  for (const m of body.matchAll(/^\s*'?([a-z-]+)'?:\s*\{\s*height:\s*([\d.]+)/gm)) out.set(m[1], Number(m[2]))
  return out
}
{
  const canonSz = canonCreatureSizes()
  const buildSz = gameCreatureSizes()
  if (!canonSz.size || !buildSz.size) {
    add('BLIND', 'creature-sizes', `could not read one side (canon ${canonSz.size}, build ${buildSz.size}) — THE CHECK DID NOT RUN`,
      'A gate that cannot read its subject proves nothing. One side MOVED: find the Size lines in base-forms.md or the SIZES literal in sprites/creature-size.ts and point this reader at it. Do not widen the reader until it matches something.')
  } else {
    let szDrift = 0
    // ⚠ COUNTED SEPARATELY FROM `szDrift`, because a rounding NOTE must not fail the gate AND must
    // not be papered over by a CLEAN line claiming everything matches. The first cut of this printed
    // "all 10 ruled creature sizes match the build" directly beneath a note saying two had drifted —
    // a green that overstates, which is the exact failure this gate exists to catch, committed by
    // the gate itself. Caught by mutation, not by reading it back.
    let szSoft = 0
    for (const [code, want] of canonSz) {
      if (!buildSz.has(code)) {
        szDrift++
        add('GAP', 'creature-sizes', `canon rules a size for '${code}' (~${want}m) that the build does not carry`,
          'Add it to SIZES in sprites/creature-size.ts — an unsized species falls to UNSIZED_FALLBACK and draws at a height nobody chose.')
        continue
      }
      const got = buildSz.get(code)
      const off = Math.abs(got - want) / want
      if (off > 0.2) {
        szDrift++
        add('CONFLICT', 'creature-sizes', `'${code}' is ${got}m in the build and ~${want}m in canon (${Math.round(off * 100)}% off)`,
          'Canon owns the comparison (base-forms.md › Size (young base form)). Re-transcribe the build, or get it re-ruled first — do not split the difference.')
      } else if (off > 0.001) {
        szSoft++
        add('NOTE', 'creature-sizes', `'${code}' is ${got}m against canon's ~${want}m — within rounding, but they have drifted apart`)
      }
    }
    for (const code of buildSz.keys()) {
      if (canonSz.has(code)) continue
      szDrift++
      add('COLLISION', 'creature-sizes', `the build sizes '${code}', which has no ruled Size line in canon`,
        'A size nobody ruled is accidental canon — every spirit a player meets is drawn at it. Rule it in base-forms.md, or drop the row.')
    }
    if (!szDrift && !szSoft) add('CLEAN', 'creature-sizes', `all ${canonSz.size} ruled creature sizes match the build`)
    else if (!szDrift) add('NOTE', 'creature-sizes', `${canonSz.size - szSoft} of ${canonSz.size} sizes match canon exactly; ${szSoft} drifted within rounding — no conflict, but nothing here is claiming they all match`)
  }
}

// ── REGISTRY SYNC (best-effort) ────────────────────────
// Keep canon_registry mirrored to CANON/ on every gate run, so the index
// never silently drifts (it once fell to 63/131). Best-effort: a sync
// failure warns but never blocks the drift check — the gate's exit code
// stays a pure function of build↔canon drift.
try {
  const out = execFileSync('python3', ['/root/athernyx/sync_registry.py', '--quiet'], { encoding: 'utf8' })
  if (!QUIET) process.stdout.write(out)
} catch (e) {
  console.error(`canon-drift: registry sync skipped — ${e.message.split('\n')[0]}`)
}

// ── MAIN ───────────────────────────────────────────────
try {
  run()
} catch (e) {
  console.error(`canon-drift: parse/IO error — ${e.message}`)
  process.exit(2)
}

// ⚠ AFTER `run()`, NEVER BEFORE IT. The first version of this call sat above the severity table and
// silently matched nothing, because the checks that produce the findings had not executed yet — and
// its "this hold matched no finding" branch then reported the hold as STALE. An exemption pass that
// runs too early does not fail: it quietly excuses nothing and blames the exemption.
applyCanonHolds()

const counts = summarize()
// ⚠ HELD is deliberately absent: a ruled divergence is reported every run but does not fail the
// gate, so a NEW conflict is the only thing that turns it red. See CANON_HOLDS for why that is safe.
const driftCount = (counts.CONFLICT ?? 0) + (counts.COLLISION ?? 0) + (counts.GAP ?? 0) + (counts.BLIND ?? 0)

if (!QUIET) {
  for (const sev of ORDER) {
    for (const f of findings.filter((x) => x.severity === sev)) {
      console.log(`${ICON[sev]} [${f.area}] ${f.msg}`)
    }
  }
  console.log('')
}
console.log('canon-drift: ' + ORDER.filter((s) => counts[s]).map((s) => `${counts[s]} ${s}`).join(', '))

// ── ★★★ WHAT THIS GATE DOES **NOT** CHECK — printed on purpose ─────────────────────────────────
// A generic `mana_seed` survived NINE DAYS past its own retirement with this gate green the whole
// time. Nothing was broken: the ten gates diff NAMES and ROSTERS — species, second forms, NPCs,
// zones, moves, mist rosters, birth affinities, herbs, infusions — and a retired item MODEL is none
// of those. The gate was correct on every line it checks and silent on that one.
//
// ⚠⚠ **SILENCE FROM A GATE IS INDISTINGUISHABLE FROM A PASS**, and a gate's SCOPE is the same
// silent promise as an exemption — worse, because an exemption is at least written at the place it
// exempts, while scope is written nowhere a reader would trip over it. "canon-drift: 10 CLEAN" reads
// as *canon and the build agree*. It means *ten named things still line up.*
//
// So the boundary is printed beside the verdict, every run. It cannot go stale unnoticed the way a
// comment can, because the day someone adds an eleventh gate they will see this list and either
// move a line out of it or leave a lie on the terminal. Move a line UP into a gate when you build
// one; never delete a line to make the output shorter.
// ★★ THE BANNER ASSERTS ITSELF, because a scope note is exactly the kind of claim that rots. The
// first cut of this said "ten named things" as a hardcoded word, which would have quietly become a
// lie the moment an eleventh gate landed — me promising that a future reader would notice, which is
// the silent-promise shape this banner exists to call out. Borrowed from the Magii seat's
// `canon_holds.py`, which asserts the two holds it was built for so that "found nothing" and "blind"
// stop being the same output.
//
// The live gate set is DERIVED from what actually reported, then compared to a pinned list. Add a
// gate and this trips: update the pin and, if the new gate widens what canon-drift covers, move the
// matching line UP out of the "does not check" list. Never delete a line to quiet the output.
const LIVE_AREAS = [...new Set(findings.map((f) => f.area))].sort()
const PINNED_AREAS = [
  'base-species', 'birth-affinity', 'canon-holds', 'canon-vs-canon', 'creature-sizes', 'element-herbs',
  'infusions', 'keeper-moves', 'mist-rosters', 'npcs', 'retired-vocab', 'second-forms', 'zones',
].sort()

if (!QUIET) {
  console.log('')
  console.log(`canon-drift covers NAMES AND ROSTERS ONLY — ${LIVE_AREAS.length} gates. It does not check:`)
  for (const line of [
    'item MODELS — whether a shipped item is a thing canon still has (the mana_seed case)',
    'mechanics, rates, costs, curves — Jin\'s by the boundary, so deliberately unchecked',
    'creature sizes are now COVERED (gate 13) — but only the metre figure. Canon\'s actual fact is the',
    '  COMPARISON ("shin-high", "thumb-sized"), and no gate reads prose. A green creature-sizes means',
    '  the numbers agree, NOT that the build draws what canon describes.',
    'design-brief HOLDS — a brief still holding art that a later ruling released',
    'whether a ruled fact reached the BUILD at all — a ruling nothing implements reads clean here',
    'prose claims inside canon files — only the tabled/rostered facts are diffed',
    'VOCABULARY, beyond the exact nouns canon has listed as retired — and read that narrowly.',
    '  A green retired-vocab does NOT mean the build says what canon says. It means no noun on',
    '  canon\'s list ships in a form this gate judges. ⚠ BOTH of 2026-08-24\'s vocabulary drifts',
    '  would have passed it: one used a word that was never retired, the other a word retired in',
    '  ONE sense only, which this gate reports and refuses to judge. What caught both was a human',
    '  re-reading the ruling. This gate narrows the search; it does not replace that.',
  // A line beginning with spaces is a CONTINUATION of the item above it, not a new one — five
  // bullets would read as five separate gaps when it is one gap explained.
  ]) console.log(line.startsWith(' ') ? `    ${line.trim()}` : `  · ${line}`)
  console.log(`  A clean gate means those ${LIVE_AREAS.length} named things line up. It is not a statement about the rest.`)
}

if (JSON.stringify(LIVE_AREAS) !== JSON.stringify(PINNED_AREAS)) {
  const added = LIVE_AREAS.filter((a) => !PINNED_AREAS.includes(a))
  const gone = PINNED_AREAS.filter((a) => !LIVE_AREAS.includes(a))
  console.error('')
  console.error('canon-drift: SCOPE SELF-CHECK FAILED — the gate set moved and the scope banner did not.')
  if (added.length) console.error(`  new gate(s): ${added.join(', ')} — does the "does not check" list still hold?`)
  if (gone.length) console.error(`  gate(s) GONE: ${gone.join(', ')} — canon lost coverage silently, which is the worse direction`)
  console.error('  Update PINNED_AREAS in scripts/canon-drift.mjs, and move any line this now covers.')
  process.exit(3)
}

if (WRITE_REPORT) {
  writeFileSync(REPORT_PATH, toMarkdown(counts))
  console.log(`report → ${REPORT_PATH}`)
}

process.exit(driftCount ? 1 : 0)
