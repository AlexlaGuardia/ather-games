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
// brack/sorrel/thistle are the three holds (dialogues/ + zones.ts brack-hold/sorrel-hold).
const CANON_V1_CAST = ['gregory', 'brack', 'sorrel', 'thistle', 'narrator']
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
  'Brack Hold', 'Sorrel Hold', 'Thistle Hold',
  'Gloview Village', 'The Outfields',
]
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
    !CANON_V1_ZONES.some((c) => c.toLowerCase() === z.toLowerCase() || z.toLowerCase().startsWith(c.toLowerCase())))
  if (offCanon.length) {
    add('GAP', 'zones',
      `${offCanon.length} shipped zones are not in the ruled v1 geography: ${offCanon.join(', ')}`,
      `Ruled v1 map (shimmer-storyline.md): ${CANON_V1_ZONES.join(', ')}. Off-canon zones are either expansion (rule them) or accidental canon (cut/rename).`)
  } else {
    add('CLEAN', 'zones', `all shipped zones map to ruled canon geography`)
  }
}

// ── REPORT ─────────────────────────────────────────────
const ICON = { CLEAN: '🟢', GAP: '🔴', CONFLICT: '🟡', COLLISION: '⚠', NOTE: 'ℹ' }
const ORDER = ['CONFLICT', 'COLLISION', 'GAP', 'NOTE', 'CLEAN']

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

const counts = summarize()
const driftCount = (counts.CONFLICT ?? 0) + (counts.COLLISION ?? 0) + (counts.GAP ?? 0)

if (!QUIET) {
  for (const sev of ORDER) {
    for (const f of findings.filter((x) => x.severity === sev)) {
      console.log(`${ICON[sev]} [${f.area}] ${f.msg}`)
    }
  }
  console.log('')
}
console.log('canon-drift: ' + ORDER.filter((s) => counts[s]).map((s) => `${counts[s]} ${s}`).join(', '))

if (WRITE_REPORT) {
  writeFileSync(REPORT_PATH, toMarkdown(counts))
  console.log(`report → ${REPORT_PATH}`)
}

process.exit(driftCount ? 1 : 0)
