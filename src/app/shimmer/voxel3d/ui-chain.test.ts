// ── The UI verb chain's oracle ────────────────────────────────────────────────────────────────
// Run: npx tsx src/app/shimmer/voxel3d/ui-chain.test.ts
//
// ★★★ WHAT THIS FILE IS ACTUALLY FOR, because it is not "does craft open the craft menu".
// The bug this guards against is TWO DEVICES DISAGREEING ABOUT ONE PRIORITY ORDER. Before the
// chain existed the UI verbs' gates were early `return`s inside a keydown handler, so a pad could
// not reach them; the obvious fix — re-testing `cursorUIOpen`/`drawn` in the frame loop — creates
// a second copy of the order that drifts one branch at a time, silently, with nothing red.
//
// So the central assert walks the SAME chain twice, once with a keyboard's predicate and once with
// a pad's, and demands the two produce the identical run list. It cannot pass if anyone ever
// reintroduces a device-specific gate, because a device-specific gate is exactly the thing that
// makes the two walks differ.

import { uiChain, runChain, SUPPRESS_DEFAULT, GATE_CURSOR_UI, GATE_DRAWN, type UiChainState, type UiChainActions } from './ui-chain'
import { DEFAULTS, ALL_ACTIONS, type ActionId } from '@/lib/input/actions'
import { codeOnly } from '../testing/guard'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { c ? pass++ : fails.push(m) }

/** Every gate closed: nothing open, weapon stowed, not in build mode. The ordinary walking state. */
const CALM: UiChainState = {
  consoleOpen: false, dialogueOpen: false, craftOpen: false, bagOpen: false,
  showSettings: false, cursorUIOpen: false, drawn: false, build: false,
}

/** Records which thunk fired, so a walk's EFFECT can be compared and not just its return value. */
function spyActions(): { calls: string[]; actions: UiChainActions } {
  const calls: string[] = []
  const hit = (n: string) => () => { calls.push(n) }
  return {
    calls,
    actions: {
      openConsole: (seed: string) => { calls.push(`openConsole(${JSON.stringify(seed)})`) },
      closeSurfaces: hit('closeSurfaces'), toggleSettings: hit('toggleSettings'),
      toggleCraft: hit('toggleCraft'), toggleMap: hit('toggleMap'), toggleBag: hit('toggleBag'),
      interact: hit('interact'), toggleDrawn: hit('toggleDrawn'), cycleWeapon: hit('cycleWeapon'),
      toggleBuild: hit('toggleBuild'), rotatePiece: hit('rotatePiece'),
      materialNext: hit('materialNext'), materialPrev: hit('materialPrev'),
    },
  }
}

/** Walk with a single action asserted by the device, and report what ran. */
function walk(state: UiChainState, fired: ActionId, seed = '') {
  const s = spyActions()
  const r = runChain(uiChain(state, s.actions), id => id === fired, { consoleSeed: seed })
  return { ...r, calls: s.calls }
}

// ── 1. THE CHAIN IS NOT EMPTY, AND IT COVERS THE VERBS IT CLAIMS TO ───────────────────────────
// ⚠ BLIND-INSTRUMENT GUARD FIRST. Every assert below walks a chain; if the chain were ever built
// empty — a bad refactor, an early return in the factory — every one of them would pass by
// finding nothing wrong, which is the failure mode this repo keeps filing. Fail loudly instead.
const calmChain = uiChain(CALM, spyActions().actions)
const chainIds = calmChain.flatMap(s => s.kind === 'action' ? [s.id] : [])
ok(chainIds.length >= 13, `BLIND: the chain built only ${chainIds.length} action steps — asserts below would pass vacuously`)
for (const id of ['ui.craft', 'ui.build', 'ui.map', 'ui.inventory', 'item.draw', 'ui.close'] as ActionId[]) {
  ok(chainIds.includes(id), `${id} is one of the seven UI verbs and is not in the chain at all`)
}
// The gates must EXIST — a chain whose barriers were dropped would let world verbs run under a menu.
const gateNames = calmChain.flatMap(s => s.kind === 'gate' ? [s.name] : [])
ok(gateNames.includes(GATE_CURSOR_UI), 'the cursor-surface barrier is missing — world verbs would fire under an open menu')
ok(gateNames.includes(GATE_DRAWN), 'the draw-lock barrier is missing — the weapon mode would stop blocking anything')

// ── 2. ★★★ THE CENTRAL GUARD: ONE CHAIN, WALKED TWICE, WITH NO EXTRA CONDITIONS ──────────────
// ⚠⚠ THE FIRST VERSION OF THIS SECTION WAS DECORATION AND IS WORTH RECORDING. It walked the chain
// with a keyboard predicate and a pad predicate and asserted the run lists matched — 300 asserts
// that CANNOT FAIL, because both walks take the same array and the two predicates are equal by
// construction for any code bound to exactly one action. It could not have caught the bug it was
// written for. *Ask of any guard: is there an input that makes this fire?*
//
// The property actually at risk is structural and lives at the CALL SITES: someone adding a second
// chain for the pad, or re-testing `cursorUIOpen`/`drawn` in the frame loop instead of letting the
// gates do it. Both read as reasonable local edits and neither changes anything this file can
// observe by walking. So this reads the component's source.
const HOST = join(__dirname, 'VoxelWorld.tsx')
const hostRaw = readFileSync(HOST, 'utf8')
const host = codeOnly(hostRaw)
// ⚠ SELF-CHECK FIRST. This file's own header and the host's comments both NAME `uiChain(` and
// `runChain(` while explaining them. If `codeOnly` ever stopped blanking comments, every count
// below would be inflated by prose and the guard would flag its own documentation — the exact trap
// the `CROP_DEFS` header sprang on 2026-08-22.
ok(!host.includes('THE UI VERB CHAIN, LIFTED'), 'BLIND: prose survived codeOnly — every count below is measuring comments')
ok(host.includes('runChain('), 'BLIND: cannot see runChain in the host at all — the reads below are measuring nothing')

const builds = host.split('uiChain(').length - 1
ok(builds === 1, `⚠⚠ ${builds} construction sites for the chain — it must be built ONCE and shared, or the two devices are walking different arrays and nothing here can tell`)
const walks = host.split('runChain(').length - 1
ok(walks === 2, `⚠ ${walks} walks of the chain — expected exactly two, the keydown adapter and the frame loop`)

const hostLines = host.split('\n')
const walkLines = hostLines.filter(l => l.includes('runChain('))
// ⚠ THE PREDICATE IS NOT ALWAYS ON THE WALK'S OWN LINE — the keydown adapter names its `fires`
// one line up so the reason it widens `ui.chat` can be written beside it. Reading only the call
// line answered "the keyboard path is gone" about a keyboard path that was right there, which is
// the false-negative direction this repo files most often. Read a small window instead.
const windowAt = (pred: (l: string) => boolean) => hostLines.some((l, i) =>
  l.includes('runChain(') && hostLines.slice(Math.max(0, i - 4), i + 1).some(pred))
ok(windowAt(l => l.includes('padNow.has')), '⚠ no walk driven by the pad — the controller path is gone')
ok(windowAt(l => l.includes('matches(')), '⚠ no walk driven by the keyboard — the keydown path is gone')
// ★ AND THE ONE THAT GUARDS THE REFACTOR ITSELF: the pad's walk must add no conditions of its own.
// Re-testing a gate here is how the two orders start to drift, one branch at a time.
for (const l of walkLines.filter(l => l.includes('padNow.has'))) {
  for (const gate of ['cursorUIOpen', 'uiOpen.current', 'drawn']) {
    ok(!l.includes(gate), `⚠⚠ the pad's walk re-tests '${gate}' — that is a SECOND copy of the priority order, which drifts silently`)
  }
}

// ── 3. THE DOORS RUN WITH A SURFACE UP; THE WORLD VERBS DO NOT ────────────────────────────────
// This is rule (1) in the chain's header, and it is the one a player feels: the surface keys are
// how you get OUT, so they sit above the barrier that stops everything else.
const upState: UiChainState = { ...CALM, cursorUIOpen: true, bagOpen: true }
ok(walk(upState, 'ui.inventory').calls.includes('toggleBag'), 'the satchel key cannot close the satchel — a door that only works when nothing is open is not a door')
ok(walk(upState, 'ui.close').calls.includes('closeSurfaces'), 'close does not run with a surface up, which is the only time it matters')
ok(walk(upState, 'ui.craft').calls.includes('toggleCraft'), 'the craft key stopped being a door')
const blockedBuild = walk(upState, 'ui.build')
ok(blockedBuild.blockedBy === GATE_CURSOR_UI, `build mode should be barred by ${GATE_CURSOR_UI} with a menu up, got ${blockedBuild.blockedBy}`)
ok(!blockedBuild.calls.length, '⚠ build mode toggled from inside an open menu — the player cannot see it happen and finds out on close')

// ── 4. THE DRAW LOCK ──────────────────────────────────────────────────────────────────────────
// Alex, 2026-08-07: with a weapon out the hotbar and tools lock up. It is a MODE, not a disable.
const drawnState: UiChainState = { ...CALM, drawn: true }
ok(!walk(drawnState, 'ui.craft').calls.length, 'craft opened with a weapon drawn — the draw lock is not holding')
ok(!walk(drawnState, 'ui.build').calls.length, 'build mode toggled with a weapon drawn')
ok(walk(drawnState, 'ui.build').blockedBy === GATE_DRAWN, 'build should be barred by the draw lock, not by something else')
// ★ …and the two verbs that must survive it: you can always stow, and you can always close.
ok(walk(drawnState, 'item.draw').calls.includes('toggleDrawn'), '⚠⚠ CANNOT STOW WHILE DRAWN — the draw lock would trap the player in weapon mode forever')
ok(walk(drawnState, 'ui.close').calls.includes('closeSurfaces'), 'close stopped working while drawn')

// ── 5. PAD-Y: DRAW BEATS CYCLE, AND THE REASON IS THE STOW ────────────────────────────────────
// `DEFAULTS` binds both `item.draw` and `item.cycle` to Y. The order here decides which wins, and
// it must be draw: cycle-wins would eat every drawn press and a controller could draw a weapon and
// never put it away. ⚠ This assert exists because actions.ts once CLAIMED the opposite resolution.
const bothOnY = (state: UiChainState) => {
  const s = spyActions()
  const r = runChain(uiChain(state, s.actions), id => id === 'item.draw' || id === 'item.cycle', { consoleSeed: '' })
  return { ran: r.ran, calls: s.calls }
}
ok(bothOnY(CALM).ran[0] === 'item.draw', 'pad Y while stowed must draw')
ok(bothOnY(drawnState).ran[0] === 'item.draw', '⚠⚠ pad Y while drawn no longer stows — a controller can draw a weapon and never put it away')
ok(!bothOnY(drawnState).calls.includes('cycleWeapon'), 'cycle ran ahead of draw on the shared button')

// ── 6. THE MATERIAL KEYS ARE GATED ON BUILD MODE ──────────────────────────────────────────────
// Outside the palette they would silently change something with nothing on screen to show it.
ok(!walk(CALM, 'build.materialNext').calls.length, 'the material key fired outside build mode — it changes something invisible')
ok(walk({ ...CALM, build: true }, 'build.materialNext').calls.includes('materialNext'), 'the material key stopped working inside build mode')

// ── 7. THE TRAILING STEPS DO NOT STOP THE WALK ────────────────────────────────────────────────
// `ui.build`/`build.rotate` were the old handler's final `if`s with no `return`, and the keyboard
// adapter runs the hotbar's number row only when the walk did NOT stop. If these ever became
// stopping steps, a digit bound alongside them would go dead.
ok(walk({ ...CALM, build: true }, 'build.rotate').stopped === false, '⚠ build.rotate now stops the walk — the number-row hotbar below it would go dead')
ok(walk(CALM, 'ui.build').stopped === false, '⚠ ui.build now stops the walk — see above')
ok(walk(CALM, 'ui.craft').stopped === true, 'ui.craft must stop the walk; the old handler returned there')

// ── 8. THE CONSOLE SEED, AND THE SURFACE GATE ABOVE IT ────────────────────────────────────────
ok(walk(CALM, 'ui.chat', '/').calls[0] === 'openConsole("/")', 'the slash door lost its pre-slashed seed')
ok(walk(CALM, 'ui.chat', '').calls[0] === 'openConsole("")', 'the chat key seeded the console with something')
ok(!walk({ ...CALM, bagOpen: true }, 'ui.chat').calls.length, 'chat opened on top of the satchel')

// ── 9. `SUPPRESS_DEFAULT` NAMES REAL ACTIONS ──────────────────────────────────────────────────
// ⚠ A typo'd id here is silent: nothing matches, Tab keeps moving focus out of the canvas, and the
// source still reads correctly. Same shape as every stale-mirror bug in PATTERNS.
for (const id of SUPPRESS_DEFAULT) {
  ok((ALL_ACTIONS as readonly string[]).includes(id), `SUPPRESS_DEFAULT names '${id}', which is not an action — its preventDefault can never fire`)
  ok(chainIds.includes(id), `SUPPRESS_DEFAULT names '${id}', which is not a step in the chain — nothing can ever run it`)
}
ok(SUPPRESS_DEFAULT.has('ui.build'), '⚠ Tab lost its preventDefault — toggling build mode would move focus out of the canvas')

// ── report ────────────────────────────────────────────────────────────────────────────────────
console.log(`\nui chain — ${calmChain.length} steps · ${gateNames.length} gates · ${walks} call sites · ${builds} construction site`)
if (fails.length) { console.log(`\n❌ ${pass} passed, ${fails.length} FAILED\n`); fails.forEach(f => console.log('  · ' + f)); process.exit(1) }
console.log(`✅ ${pass} asserts passed\n`)
