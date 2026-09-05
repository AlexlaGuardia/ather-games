// Browser-local keeper state. Run: npx tsx src/lib/keeper-local.test.ts
//
// ── ⚠ WHAT THIS CATCHES, AND THE HARDER THING IT CATCHES ────────────────────────────────────────
// The easy half is the bug: the birth rune, the move book, the loadout, the uncovered map, the mist
// ledger and the world's clocks were shared by every account on one browser, so a second keeper
// skipped the ritual and spawned holding the first one's affinity.
//
// The harder half is that `KEEPER_KEYS` is a HAND-KEPT LIST, and a hand-kept list of "the things
// that must be scoped" is the shape that rots. Rename a base in its own module and the registry
// keeps naming a key nobody writes — the guard stays green and that key quietly goes shared again.
// Write a NEW localStorage key and nothing at all notices. So the last section reads the tree and
// makes every shimmer key in it CLASSIFY itself: keeper or device, no third option, no default.

import {
  KEEPER_KEYS, KEEPER_KEY_SPECS, WORLD_TIED_FAMILIES, KEEPER_CLAIM, keeperKeyFor, planKeeperAdoption, adoptAnonKeeperState,
} from './keeper-local'
// ⚠ ANON_SAVE_KEY is IMPORTED, never spelled: `save-slot.test.ts` forbids a second spelling of
// that literal anywhere in src/, and it caught this file on the first run.
import { setSaveOwner, saveKey, ANON_SAVE_KEY } from './save-slot'
import { resetIfStale } from './ather-epoch'
import { BIRTH_KEY, RUNES_KEY } from '../app/shimmer/play3d/rune-inventory'
import { BOOK_KEY } from '../app/shimmer/play3d/book'
import { LOADOUT_KEY } from '../app/shimmer/play3d/loadout'
import { SEEN_BASE } from '../app/shimmer/voxel3d/discovery'
import { TUTORIAL_BASE } from '../app/shimmer/voxel3d/tutorial'
import { MIST_BASE } from '../app/shimmer/voxel3d/mist-encounter'
import { MP_ID, MP_NAME } from '../app/shimmer/play3d/multiplayer'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'

const A = 'u_aaaaaaaaaaaaaaaaaa'
const B = 'u_bbbbbbbbbbbbbbbbbb'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── the key itself ──────────────────────────────────────────────────────────────────────────────
ok(keeperKeyFor(BIRTH_KEY, null) === 'ather:shimmer:birthRune', 'the anonymous keeper keeps the bare key')
ok(keeperKeyFor(BIRTH_KEY, A) === `u:${A}:ather:shimmer:birthRune`, `signed-in carries the owner in front (got ${keeperKeyFor(BIRTH_KEY, A)})`)
ok(keeperKeyFor(BIRTH_KEY, A) !== keeperKeyFor(BIRTH_KEY, B), '★ two accounts are never born with the same rune key')

// ★ THE OWNER GOES IN FRONT HERE AND BEHIND IN `save-slot.ts`, AND THIS IS THE REASON. A suffix is
// safe only for a key with one fixed spelling. Scope a FAMILY by suffix and a prefix scan for the
// family matches every account's copy of it — one keeper's adoption sweeping up another's.
const suffixed = (base: string, o: string) => `${base}:${o}`      // the shape NOT taken
ok(suffixed(`${SEEN_BASE}glade`, A).startsWith(SEEN_BASE), 'a suffix-scoped zone key still answers to the family prefix — which is why it is not used')
ok(!keeperKeyFor(`${SEEN_BASE}glade`, A).startsWith(SEEN_BASE), '★ a front-marked key cannot be mistaken for anonymous state')
setSaveOwner(A)
ok(!saveKey().startsWith('u:'), 'the save slot is scoped the OTHER way, and this file does not touch it')

// ── ★ THE BUG, THROUGH THE REGISTRY ─────────────────────────────────────────────────────────────
const anonState = [
  BIRTH_KEY, RUNES_KEY, BOOK_KEY, LOADOUT_KEY,
  `${SEEN_BASE}glade`, `${SEEN_BASE}hollow`, `${TUTORIAL_BASE}1337`, `${MIST_BASE}1337`,
  'voxel3d:pots:1337', 'voxel3d:saplings:1337', 'voxel3d:leafdecay:1337',
]
const first = planKeeperAdoption(anonState, null, A)
ok(first.reason === 'adopted' && first.claim, 'a first sign-in adopts this browser\'s keeper state')
ok(first.moves.length === anonState.length, `every registered key moves (${first.moves.length}/${anonState.length})`)
ok(first.moves.every(([from, to]) => to === `u:${A}:${from}`), 'a move adds the owner and changes nothing else')
ok(first.moves.some(([f]) => f === BIRTH_KEY), '★ the birth rune moves — otherwise the keeper is re-birthed and loses their affinity')
ok(first.moves.filter(([f]) => f.startsWith(SEEN_BASE)).length === 2, 'a dynamic family moves every member, not just the one somebody remembered')

// ★ ONE-SHOT. Without it, B signs in on the same browser and inherits A's rune, book and map —
// which is the whole reported defect, rebuilt out of the fix for it.
const second = planKeeperAdoption(anonState, A, B)
ok(second.reason === 'someone-elses' && !second.moves.length && !second.claim, '★ a second account inherits nothing')
ok(planKeeperAdoption(anonState, A, A).reason === 'adopted', 'the account that claimed it may still finish')

// ★ LOCK, NEVER OVERWRITE: this account has played signed in, so its own state is the newer claim.
const held = planKeeperAdoption([...anonState, `u:${A}:${BOOK_KEY}`], null, A)
ok(held.reason === 'locked' && held.claim && !held.moves.length, "★ an account with its own state locks the anonymous state instead of taking it")

// ★ AN EMPTY BROWSER IS CLAIMED BY NOBODY — reserving it would cost whoever plays signed out later
// and comes back as a different account, and there is nothing here to leak.
ok(planKeeperAdoption([KEEPER_CLAIM], null, A).reason === 'nothing-anonymous', 'nothing anonymous means nothing claimed')
ok(planKeeperAdoption(anonState, null, null).reason === 'anonymous', 'an anonymous boot adopts nothing')
ok(!planKeeperAdoption([...anonState, KEEPER_CLAIM], null, A).moves.some(([f]) => f === KEEPER_CLAIM), 'the claim is never moved into the account')

// Unregistered keys are left exactly where they are — device settings belong to the machine.
const device = ['shimmer.voxel.settings.v1', 'ather:gfx:shimmer', 'ather:shimmer:genWarned', ANON_SAVE_KEY]
ok(!planKeeperAdoption([...anonState, ...device], null, A).moves.some(([f]) => device.includes(f)),
   'device settings and the save slot are not swept up by keeper adoption')
ok(planKeeperAdoption(device, null, A).reason === 'nothing-anonymous', 'a browser holding only device state has no keeper state to adopt')

// ── ★★ THE REGISTRY MUST STILL POINT AT WHAT THE MODULES ACTUALLY WRITE ─────────────────────────
// Each base is imported from the module that owns it, so renaming one there fails HERE rather than
// silently un-scoping that key. A registry entry nobody imports is the mirror problem: it agrees
// with a value that has moved on.
const KEEPER_BASES = ['BIRTH_KEY', 'RUNES_KEY', 'BOOK_KEY', 'LOADOUT_KEY', 'MP_ID', 'MP_NAME',
                      'SEEN_BASE', 'TUTORIAL_BASE', 'MIST_BASE'] as const
for (const [name, base] of [['BIRTH_KEY', BIRTH_KEY], ['RUNES_KEY', RUNES_KEY], ['BOOK_KEY', BOOK_KEY],
                            ['LOADOUT_KEY', LOADOUT_KEY], ['MP_ID', MP_ID], ['MP_NAME', MP_NAME],
                            ['SEEN_BASE', SEEN_BASE], ['TUTORIAL_BASE', TUTORIAL_BASE],
                            ['MIST_BASE', MIST_BASE]] as const) {
  ok(KEEPER_KEYS.includes(base), `★ ${name} ('${base}') is registered — unregistered means shared across accounts`)
  ok((KEEPER_BASES as readonly string[]).includes(name), `${name} is named in KEEPER_BASES, which the tree scan trusts`)
}

// ── ★★★ AND EVERY SHIMMER KEY IN THE TREE MUST CLASSIFY ITSELF ──────────────────────────────────
// The asserts above only cover keys somebody remembered to import. This covers the ones nobody did:
// it reads every `localStorage` call in the shimmer tree, pulls the key expression, and demands it
// resolve to a registered keeper base or an explicitly listed device key. A NEW key is a build
// break with a message, not a silent leak two accounts discover later.
//
// ⚠ IT IS A TEXTUAL READER, WHICH IS THE THING THIS REPO KEEPS GETTING BURNED BY, SO IT PROVES IT
// COULD SEE: it asserts a floor on both files read and call sites found. "I found nothing wrong"
// and "I could not look" must not share an answer.
const ROOT = join(process.cwd(), 'src', 'app', 'shimmer')
const SRC = join(process.cwd(), 'src')
const DEVICE_KEYS = [
  'shimmer.voxel.settings.v1',    // graphics/voxel settings — tuned to the MACHINE, not the person
  'shimmer.voxel.bindings.v1',    // key/controller bindings. DEVICE for the same reason as the line
                                  // above and against the house habit: controls belong to the hands
                                  // and the hardware, not the character. Two accounts on one desktop
                                  // want the same keys; one account on a phone and a desktop does
                                  // not. Scoping these per keeper would hand a returning player
                                  // default controls for no reason they could name.
  'ather:gfx:shimmer',            //   ″
  'ather:shimmer:genWarned',      // one generator warning per browser is the point of it
  'ather:shimmer:justBorn',       // read and cleared inside one boot
  'ather:shimmer:birthPending',   // vestigial, cleared only so an old latch does not look meaningful
  'shimmer-bg-',                  // battle-bg ART OVERRIDES authored in the dev editor. Content
                                  // somebody is drawing, not progress somebody earned — and the
                                  // editor is owner-gated, so there is one author per box.
  'shimmer-clipboard-',           // the sprite editors' copy buffer. Dev tool, owner-gated.
  'shimmer-inspector-collapsed',  // a dev panel remembering it was collapsed
]
function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p)
  }
  return out
}
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

let files = 0, sites = 0
const unclassified: string[] = []
const rawKeeper: string[] = []

/**
 * What is this expression? Three answers, and the middle one is the whole point.
 *
 * ⚠⚠ THE FIRST VERSION OF THIS SCAN COUNTED "IT IS A REGISTERED KEEPER BASE" AS CLASSIFIED, AND A
 * MUTATION WALKED STRAIGHT PAST IT: `localStorage.getItem(BIRTH_KEY)` — the base registered as
 * per-keeper, read RAW — scored green. That is not an unclassified key, it is THE BUG wearing the
 * registry as cover. Being listed in `KEEPER_KEYS` is a statement that the key MUST be wrapped, so
 * finding one bare is the strongest reading this scan can produce, never a pass.
 */
type Verdict = 'scoped' | 'device' | 'raw-keeper' | 'unknown'
let currentFile = ''
function classify(expr: string, code: string, depth = 0): Verdict {
  const e = expr.trim()
  if (depth > 3) return 'unknown'
  // Routed through a scoping helper — that IS the classification.
  if (/^(keeperKey|saveKey|slotFor)\s*\(/.test(e)) return 'scoped'
  const lit = /^[`'"]/.test(e) ? (/^[`'"]([^`'"]*)/.exec(e)?.[1] ?? '') : null
  if (lit !== null) {
    if (DEVICE_KEYS.some(d => lit.startsWith(d))) return 'device'
    return KEEPER_KEYS.some(b => lit.startsWith(b)) ? 'raw-keeper' : 'unknown'
  }
  // Otherwise it names something: follow the name to what it is BOUND to, never trust the name
  // itself. A constant called `POT_KEY` says nothing about whether anybody scoped it, and a helper
  // called `key` that forgot `keeperKey` is the exact regression this scan exists to catch.
  const name = /^([A-Za-z_$][\w$]*)/.exec(e)?.[1]
  if (!name) return 'unknown'
  let decl = new RegExp(`(?:const|let|function)\\s+${name}\\b([\\s\\S]{0,240})`).exec(code)?.[1]
  // ⚠ NOT DECLARED HERE MEANS IMPORTED, AND AN IMPORTED HELPER IS EXACTLY WHERE AN UNSCOPED KEY
  // HIDES — it reads as somebody else's problem from both files. Follow the import and classify it
  // where it is written. (`bgStorageKey` is imported into the editor from the renderer, and that is
  // the only reason it reached this branch.)
  if (!decl) {
    const from = new RegExp(`import\\s*{[^}]*\\b${name}\\b[^}]*}\\s*from\\s*'([^']+)'`).exec(code)?.[1]
    if (!from || !from.startsWith('.')) return 'unknown'
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      try {
        const src = stripComments(readFileSync(join(dirname(currentFile), from + ext), 'utf8'))
        return classify(e, src, depth + 1)
      } catch { /* next extension */ }
    }
    return 'unknown'
  }
  const body = decl.split('\n').slice(0, 4).join('\n')
  const rhs = /=>?\s*([\s\S]*)/.exec(body)?.[1] ?? body
  if (/\b(keeperKey|saveKey|slotFor)\s*\(/.test(rhs)) return 'scoped'
  const inner = /[`'"]([^`'"]+)/.exec(rhs)?.[1]
  if (!inner) return 'unknown'
  if (DEVICE_KEYS.some(d => inner.startsWith(d))) return 'device'
  return KEEPER_KEYS.some(b => inner.startsWith(b)) ? 'raw-keeper' : 'unknown'
}

for (const file of walk(ROOT)) {
  files++
  const code = stripComments(readFileSync(file, 'utf8'))
  const rel = file.slice(ROOT.length + 1)
  currentFile = file
  // The whole argument of a get/set/removeItem call, however it is spelled.
  for (const m of code.matchAll(/localStorage\.(?:get|set|remove)Item\(\s*([^,)]+)/g)) {
    sites++
    const v = classify(m[1], code)
    if (v === 'raw-keeper') rawKeeper.push(`${rel}: ${m[1].trim()}`)
    else if (v === 'unknown') unclassified.push(`${rel}: ${m[1].trim()}`)
  }
}
ok(files > 50, `the scan read the shimmer tree (${files} files) — a low number means BLIND, not clean`)
ok(sites > 15, `the scan found localStorage call sites (${sites}) — 0 would mean the pattern stopped matching`)
ok(unclassified.length === 0, `★ unclassified localStorage key — register it in KEEPER_KEYS or DEVICE_KEYS: ${unclassified.join(' | ')}`)
ok(rawKeeper.length === 0, `★★ a PER-KEEPER key is read RAW — wrap it in keeperKey(), or every account on this browser shares it: ${rawKeeper.join(' | ')}`)

// ── ★★ THE IMPERATIVE HALF, AGAINST A FAKE STORE — INCLUDING THE ORDER OF OPERATIONS ───────────
// `planKeeperAdoption` is pure and everything above tests it. `adoptAnonKeeperState` is the part
// that actually moves bytes, and it carries an invariant that lived only in prose until a mutation
// sweep walked past it: **localStorage has no transaction**, so every destination is written BEFORE
// any source is deleted. Interrupted halfway, the keeper holds both copies (harmless, and the next
// boot finishes) instead of neither. Reversed, an interruption is a rune that no longer exists.
//
// A comment cannot enforce an ordering. This does: the fake store records every operation, and the
// assert is that no `remove` of a source precedes the `set` of its destination.
type Op = { op: 'set' | 'remove'; key: string }
function fakeStore(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial))
  const ops: Op[] = []
  return {
    ops, data,
    get length() { return data.size },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { ops.push({ op: 'set', key: k }); data.set(k, v) },
    removeItem: (k: string) => { ops.push({ op: 'remove', key: k }); data.delete(k) },
    clear: () => data.clear(),
  }
}
{
  const store = fakeStore({
    [BIRTH_KEY]: 'rune_ember', [BOOK_KEY]: '["bolt"]', [`${SEEN_BASE}glade`]: '4,4,AAAA',
    'ather:gfx:shimmer': '{"quality":"high"}',            // device — must not move
  })
  ;(globalThis as { localStorage?: unknown }).localStorage = store
  setSaveOwner(A)
  const plan = adoptAnonKeeperState(A)
  ok(plan.reason === 'adopted' && plan.moves.length === 3, `the real function moved the keeper's state (${plan.reason}, ${plan.moves.length})`)
  ok(store.getItem(`u:${A}:${BIRTH_KEY}`) === 'rune_ember', '★ the rune arrived under the account, value intact')
  ok(store.getItem(BIRTH_KEY) === null, 'and no longer answers to the anonymous key')
  ok(store.getItem('ather:gfx:shimmer') === '{"quality":"high"}', 'the device setting was left exactly where it was')
  ok(store.getItem(KEEPER_CLAIM) === A, 'the browser is stamped for A')

  // ★ THE ORDERING. Every destination is written before any source is removed.
  const firstRemove = store.ops.findIndex(o => o.op === 'remove')
  const lastSetOfMove = store.ops.map((o, i) => ({ o, i }))
    .filter(({ o }) => o.op === 'set' && plan.moves.some(([, to]) => to === o.key))
    .map(({ i }) => i).reduce((a, b) => Math.max(a, b), -1)
  ok(firstRemove > lastSetOfMove,
     `★★ no source is deleted before every destination is written (first remove at ${firstRemove}, last copy at ${lastSetOfMove}) — reversed, an interrupted adoption loses the rune`)

  // Idempotent: the other route runs the same call and must find nothing left to do.
  const again = adoptAnonKeeperState(A)
  ok(again.reason === 'nothing-anonymous' && !again.moves.length, 'a second call on the same browser does nothing')

  // ★ AND THE SECOND ACCOUNT, THROUGH THE REAL FUNCTION: no rune, so the ritual runs for them.
  setSaveOwner(B)
  store.setItem(BIRTH_KEY, 'rune_left_behind')          // as if they played anonymously first
  const forB = adoptAnonKeeperState(B)
  ok(forB.reason === 'someone-elses' && store.getItem(`u:${B}:${BIRTH_KEY}`) === null,
     "★ B inherits nothing: the browser is spoken for, so B is born rather than handed A's affinity")
  ok(store.getItem(`u:${A}:${BIRTH_KEY}`) === 'rune_ember', "and A's rune is untouched by B's visit")
  delete (globalThis as { localStorage?: unknown }).localStorage
  setSaveOwner(null)
}

// ── ★★★ WHAT ELSE KEYS OFF THE THING I JUST CHANGED: THE EPOCH RESET ────────────────────────────
// Making the rune per-keeper silently broke the world reset. `ather-epoch.ts` clears the keys that
// make up a character, by literal — so after scoping, a bump would clear the ANONYMOUS keeper's
// rune and leave every signed-in one behind, and its own header says exactly why that is the
// failure the mechanism exists to prevent: a pre-epoch character survives the wipe.
//
// ⚠ THE BROWSER PROBE FOUND IT, NOT THIS FILE, AND NOT REASONING. The rune vanished from the shared
// key and never arrived under the account. That is why the assert is here now: a reset is rare, so
// nobody would have noticed until the next bump, by which point the cause would be a year old.
{
  const store = fakeStore({
    'ather:epoch': '1',                                    // behind — a bump is owed
    [`u:${A}:${BIRTH_KEY}`]: 'rune_ember',                 // ★ a signed-in keeper's rune
    [`u:${A}:${RUNES_KEY}`]: '["rune_ember"]',
    [BIRTH_KEY]: 'rune_anon',                              // and the anonymous one
    [`u:${A}:${BOOK_KEY}`]: '["bolt"]',                    // NOT a character key — must survive
    'ather:best:seedfall': '9001',                         // an arcade score — must survive
  })
  ;(globalThis as { localStorage?: unknown }).localStorage = store
  ;(globalThis as { window?: unknown }).window = globalThis
  const reset = resetIfStale()
  ok(reset, 'a browser behind the epoch resets')
  ok(store.getItem(`u:${A}:${BIRTH_KEY}`) === null, "★★ a SIGNED-IN keeper's rune is cleared by the epoch bump — missing this leaves a character from a dead world")
  ok(store.getItem(`u:${A}:${RUNES_KEY}`) === null, "and their rune inventory with it")
  ok(store.getItem(BIRTH_KEY) === null, "the anonymous keeper's rune is cleared too")
  ok(store.getItem('ather:best:seedfall') === '9001', 'an arcade score is NOT a Shimmer character — widening that list is a decision, not a tidy-up')
  ok(store.getItem(`u:${A}:${BOOK_KEY}`) === '["bolt"]', 'the move book is not on the character list, and this test does not quietly add it')
  ok(!resetIfStale(), 'a browser at the current epoch resets nothing on the next load')
  delete (globalThis as { localStorage?: unknown }).localStorage
  delete (globalThis as { window?: unknown }).window
}

// ── ★★★ A DYNAMIC TAIL CANNOT BE MATCHED BY A SUFFIX, AND THE SWEEP WAS ASKING FOR ONE ──────────
// The sweep finds an account's copy of a character key by asking whether it ENDS in a known base.
// That is sound for `u:<id>:ather:shimmer:birthRune` and STRUCTURALLY IMPOSSIBLE for
// `u:<id>:voxel3d:tutorial:<seed>`, which ends in a seed. So the tutorial survived every world bump:
// the character was cleared and reborn while its progress still said `done`.
//
// ⚠ Already wrong (a reborn keeper skipped the tutorial); a SOFT-LOCK once the Glade gate is
// one-way (ruled 2026-08-23) — done + a consumed gate + a new character is a keeper with no way out.
{
  const store = fakeStore({
    'ather:epoch': '1',
    [`u:${A}:${BIRTH_KEY}`]: 'rune_ember',
    [`u:${A}:voxel3d:tutorial:1337`]: '{"stage":"done"}',   // ★ a signed-in keeper's progress
    'voxel3d:tutorial:1337': '{"stage":"done"}',            // and the anonymous one
    [`u:${A}:voxel3d:pots:1337`]: '{"t":1}',                // a SIBLING family — see below
    'ather:best:seedfall': '9001',
  })
  ;(globalThis as { localStorage?: unknown }).localStorage = store
  ;(globalThis as { window?: unknown }).window = globalThis
  resetIfStale()
  ok(store.getItem(`u:${A}:voxel3d:tutorial:1337`) === null,
    "★★★ a signed-in keeper's tutorial dies with the world — a suffix rule can never reach this key")
  ok(store.getItem('voxel3d:tutorial:1337') === null, "and the anonymous keeper's with it")

  // ⚠⚠ RECORDED, NOT ENDORSED. `pots:` is one of five dynamic-tail families that are arguably just
  // as world-tied as the tutorial. This assert pins what the sweep does TODAY so that widening it
  // is a deliberate act with a red test in front of it, exactly as the arcade-score assert above
  // demands. It is NOT a claim that leaving pots behind is correct — that question is open.
  ok(store.getItem(`u:${A}:voxel3d:pots:1337`) === '{"t":1}',
    '⚠ sibling families are NOT swept today — widening that is a decision, and this assert is the gate on it')
  ok(store.getItem('ather:best:seedfall') === '9001', 'an arcade score is still not a Shimmer character')
  delete (globalThis as { localStorage?: unknown }).localStorage
  delete (globalThis as { window?: unknown }).window
}

// ── ★★ AND THE TWO SPELLINGS MUST AGREE, COMPARED AS DERIVATIONS RATHER THAN AS VALUES ──────────
// `ather-epoch.ts` cannot import from the shimmer tree without inverting the layering, so it names
// the family itself — which makes it a COPY, and a copy agrees with itself while drifting from its
// source. That is the hand-kept-mirror shape this codebase paid for on 08-22. The test can cross
// the layer even though the module cannot, so the agreement is checked HERE, at the seam.
{
  ok(WORLD_TIED_FAMILIES.includes(TUTORIAL_BASE),
    `★★★ the epoch's family list DERIVES the tutorial base rather than respelling it ` +
    `(families: ${WORLD_TIED_FAMILIES.join(', ')} · source: ${TUTORIAL_BASE})`)
  ok(KEEPER_KEYS.includes(TUTORIAL_BASE),
    '★ and the keeper registry still lists it, so it stays per-account as well as world-tied')
  const spec = KEEPER_KEY_SPECS.find(s => s.base === TUTORIAL_BASE)
  ok(spec?.worldTied === true,
    '★★ the answer lives ON the registry entry — flip this flag and the epoch stops clearing it, visibly')

  // ★★ AND THE DERIVATION IS NOT VACUOUS. If every family were world-tied, or none were, the filter
  // would be decoration: it must actually SELECT. This is the "is there an input that makes this
  // fire?" question asked of a derivation instead of an assert.
  const tailFamilies = KEEPER_KEY_SPECS.filter(s => s.base.endsWith(':'))
  ok(tailFamilies.length > WORLD_TIED_FAMILIES.length && WORLD_TIED_FAMILIES.length > 0,
    `★★★ the world-tied filter genuinely partitions (${WORLD_TIED_FAMILIES.length} of ` +
    `${tailFamilies.length} tail families) — all-or-nothing would make it decoration`)
}

// ── ★★ AND NO SECOND SPELLING OF A KEEPER KEY, ANYWHERE ─────────────────────────────────────────
// This section exists because the scan above found `ather:shimmer:birthRune` written out a THIRD
// and FOURTH time, in `BirthScreen.tsx` and `RuneBadge.tsx`, each with its own `STORAGE_KEY`. That
// is the defect that made #682 a five-file change: a duplicate literal does not fail when the
// original moves, it quietly keeps addressing the old place. Each base may be spelled in exactly
// one module — the one that exports it — plus the registry here.
// ⚠ Comments stripped first: several files legitimately name these keys in prose, and a guard that
// matches prose either fires on honest documentation or gets loosened until it sees nothing.
const OWNERS: Record<string, string> = {
  'ather:shimmer:birthRune': 'play3d/rune-inventory.ts', 'ather:shimmer:runes': 'play3d/rune-inventory.ts',
  'ather:shimmer:book': 'play3d/book.ts', 'ather:shimmer:loadout': 'play3d/loadout.ts',
  'ather:shimmer:gems': 'play3d/gems.ts', 'ather:shimmer:vessels': 'play3d/gems.ts',
  'ather:shimmer:stowed': 'play3d/vessels.ts', 'ather:shimmer:parked': 'play3d/vessels.ts',
  'ather:shimmer:worn-tier': 'play3d/vessels.ts', 'ather:shimmer:trials': 'play3d/vessel-drops.ts',
  'ather:mp:id': 'play3d/multiplayer.ts', 'ather:mp:name': 'play3d/multiplayer.ts',
  'ather:shimmer:seen:': 'voxel3d/discovery.ts', 'voxel3d:tutorial:': 'voxel3d/tutorial.ts',
  'voxel3d:mist:': 'voxel3d/mist-encounter.ts', 'voxel3d:pots:': 'voxel3d/VoxelWorld.tsx',
  'voxel3d:saplings:': 'voxel3d/VoxelWorld.tsx', 'voxel3d:leafdecay:': 'voxel3d/VoxelWorld.tsx',
}
ok(Object.keys(OWNERS).length === KEEPER_KEYS.length,
   `every registered key names an owning module (${Object.keys(OWNERS).length} vs ${KEEPER_KEYS.length}) — a new key needs a row here`)
// ⚠ THE SCAN ROOT IS `src`, NOT THE SHIMMER TREE. Scoped to shimmer/ it missed `lib/ather-epoch.ts`
// spelling two of these — and that file DELETES them, so a stale copy there is a reset that does not
// reset. A key's owner is not the only file that cares about it.
const dupes: string[] = []
const SPELL_ALLOWED = ['lib/keeper-local.ts']   // the registry itself must name them all
let spellChecked = 0
for (const file of walk(SRC)) {
  const rel = file.slice(SRC.length + 1).replace(/^app\/shimmer\//, '')
  if (SPELL_ALLOWED.includes(file.slice(SRC.length + 1))) continue
  const code = stripComments(readFileSync(file, 'utf8'))
  spellChecked++
  for (const [base, owner] of Object.entries(OWNERS)) {
    if (rel === owner) continue
    if (code.includes(`'${base}`) || code.includes(`\`${base}`)) dupes.push(`${rel} spells '${base}' (owned by ${owner})`)
  }
}
ok(spellChecked > 100, `the spelling scan read all of src (${spellChecked} files) — a low number means BLIND, and it must reach lib/ or it cannot see the epoch reset`)
ok(dupes.length === 0, `★★ a keeper key is spelled outside its owning module: ${dupes.join(' | ')}`)
for (const [base, owner] of Object.entries(OWNERS)) {
  const src = readFileSync(join(ROOT, owner), 'utf8')
  ok(src.includes(`'${base}`), `${owner} still owns '${base}' — otherwise the rule above asserts nothing`)
}

console.log(`\nkeeper-local: ${pass} passed, ${fails.length} failed  (${files} files, ${sites} localStorage sites)`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
