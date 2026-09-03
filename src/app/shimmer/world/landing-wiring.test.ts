// THE CROSSING'S WIRING — the two host hunks no pure oracle can reach.
//
// Run: npx tsx src/app/shimmer/world/landing-wiring.test.ts
//
// ── ★★★ WHY A SOURCE GUARD AND NOT A UNIT TEST ───────────────────────────────────────────────
// `landing.test.ts` proves the door is in the right place, and `crossing-out.test.ts` proves
// `depart()` answers correctly. Both were green for a week over a world where **nothing called
// either one** — socket 0 printed a sentence and `consumeArrival` sat inert. That is this repo's
// most expensive recurring shape: `engine/crossing.ts` had a full contract and oracle since 08-24
// with no caller on either side, and nothing was red, because a contract with no callers is
// perfectly self-consistent. The 98 unreachable pieces, `bubbleMaterialAt` imported by nobody, the
// 12 registered-but-unbuilt moves — same sentence every time. **When a module is done and green,
// grep for its callers before believing it.** This file is that grep, kept.
//
// ⚠ EVERY NEGATIVE READS THROUGH `codeOnly`, so a comment explaining what a block used to do
// cannot satisfy a guard about what it does — the *documenting a marker created a marker* bug,
// which has caught its own author twice in this tree.
import { readFileSync } from 'fs'
import { join } from 'path'
import { codeOnly, noComments, blockAt, justBefore } from '../testing/guard'
import { LANDING_LABEL } from './landing'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const read = (p: string) => readFileSync(join(process.cwd(), 'src/app/shimmer', p), 'utf8')
const VOXEL = read('voxel3d/VoxelWorld.tsx')
const PLAY = read('play3d/Shimmer3D.tsx')
const vCode = codeOnly(VOXEL), pCode = codeOnly(PLAY)
// ** TWO STRIPPERS, TWO QUESTIONS, AND MIXING THEM IS ITS OWN BLIND GUARD. `codeOnly` also empties
// STRING CONTENTS - right for "does this file DO x" (counting, structure), and silently false for
// every assert about a route path or a refusal name, since those live inside quotes. `noComments`
// keeps the literals and drops the prose. Caught here on the first run: six asserts red against
// correct code, which is the direction a guard must never fail in.
const vLit = noComments(VOXEL), pLit = noComments(PLAY)

// ── 1. THE DEPARTURE — the Ather side actually calls `depart` and actually navigates ─────────
{
  ok(/import\s*\{[^}]*\bdepart\b[^}]*\}\s*from\s*'\.\/crossing-out'/.test(vLit),
     'VoxelWorld imports depart from crossing-out')
  ok(/import\s*\{[^}]*\bLANDING_ARRIVAL\b[^}]*\}\s*from\s*'\.\.\/world\/landing'/.test(vLit),
     'and takes the anchor from the module that proves it, not a literal')

  const calls = vCode.match(/depart\(localStorage, LANDING_ARRIVAL\)/g) ?? []
  ok(calls.length === 1, `exactly one departure call site (${calls.length})`)

  // ** IT MUST SIT UNDER SOCKET 0, AND CONTAINMENT IS THE ONLY HONEST WAY TO ASK. A `depart()`
  // anywhere in an 8000-line file satisfies a bare match - the *satisfiable by being ANYWHERE*
  // shape that let a structure pass a clearance check from the far side of the planet.
  //
  // !! AND A "chars before the anchor" WINDOW CANNOT ASK IT HERE, WHICH COST THIS FILE A RED RUN.
  // `codeOnly` REPLACES a comment with the same number of SPACES rather than deleting it, so the
  // 400 characters before this call are 400 characters of blanked doc comment and the guard read
  // an empty window. It failed toward "the wiring is wrong" over correct code. So the block is
  // sliced by its own branch instead, which no amount of commentary can push out of range.
  const sock = blockAt(vLit, 'if (standing === 0) {', '} else if')
  ok(sock.at >= 0, 'the socket-0 branch is findable')
  ok(sock.code.includes('depart(localStorage, LANDING_ARRIVAL)'),
     'and it is the socket-0 branch that calls the departure, not some other arch')

  // * THE REFUSAL MUST STILL BE ASKED OF THE MAP. If this ever collapses to an unconditional
  // navigate, an unpainted landing sends a keeper to a town with no anchor - the failure the whole
  // `crossingReady`-asks-the-map design exists to prevent.
  ok(/'refused' in out/.test(sock.raw), 'the refusal is handled before anything navigates')
  ok(/'unpainted'/.test(sock.raw), 'and the unpainted case is named, not folded into a generic failure')
  const iRef = sock.raw.indexOf("'refused' in out"), iNav = sock.raw.indexOf('window.location.href')
  ok(iRef >= 0 && iNav >= 0 && iRef < iNav, 'and it is checked BEFORE the navigation, not after')

  // The navigation itself, and the route it goes to.
  ok(/window\.location\.href = '\/shimmer\/play3d'/.test(vLit),
     'the Ather side navigates to the town route')

  // ⚠⚠ NO COMMITTED MIDDLE. The departing side must not move the keeper on the Ather side; the
  // contract says either the departure has not happened or the arrival is complete.
  ok(!/savePlayer|setSpace|enterSpace/.test(sock.code),
     'the departure moves nothing on the Ather side - no committed middle')

  // ★★ THE STALE-SENTENCE CHECK, BOTH DIRECTIONS. The old copy claimed the crossing was not wired.
  // Asserting only its absence goes quiet the day the claim becomes true again, so the host symbol
  // that falsifies it is asserted present in the same breath (`dev-claims.test.ts` shape).
  ok(!/the crossing itself is not wired yet/.test(VOXEL),
     'the "not wired yet" sentence is gone from the file, comments included')
  ok(/window\.location\.href = '\/shimmer\/play3d'/.test(vLit),
     'and the symbol that makes it false is still there')
}

// ── 2. THE RETURN — the town side catches the door by LABEL and changes route ────────────────
{
  ok(/import\s*\{[^}]*\bLANDING_LABEL\b[^}]*\}\s*from\s*'\.\.\/world\/landing'/.test(pLit),
     'Shimmer3D takes the label from the map module, never a second copy of the string')
  ok(!/'THE LANDING'/.test(pLit), 'and does not restate it as a literal')

  const at = pLit.indexOf('window.location.href = \'/shimmer/voxel3d\'')
  ok(at > 0, 'the town navigates back to the Ather route somewhere')

  // ⚠ THE ORDER IS THE WHOLE FIX, AND ONLY AN ORDER CHECK CAN SEE IT. `performWarp` must run
  // BEFORE the navigation, so the town record ends up beside the door rather than on the warp tile
  // that fired. Left on it, every later load of the town re-fires this gate — the self-feeding
  // save shape that cost a day on 2026-08-15. Both lines present in either order looks identical
  // to a pair of bare matches.
  // ** EXACTLY ONE, because the order asserts below use `indexOf` and a SECOND branch added after
  // the same-zone shortcut would sit past every one of them, unseen. A mutation sweep found this
  // gap by surviving; the order checks were correct and simply could not see a duplicate.
  const branches = pCode.split('w.gate?.toUpperCase() === LANDING_LABEL').length - 1
  ok(branches === 1, `exactly one label branch catches the home-gate (${branches})`)

  const blk = blockAt(pCode, `w.gate?.toUpperCase() === LANDING_LABEL`, 'return')
  ok(blk.at >= 0, 'the return leg is caught by the gate label')
  const iWarp = blk.code.indexOf('performWarp(w)')
  const iNav = blk.code.indexOf('window.location.href')
  ok(iWarp >= 0 && iNav >= 0 && iWarp < iNav,
     `performWarp runs BEFORE the navigate, so the record steps aside (${iWarp} < ${iNav})`)

  // ★ AND IT MUST BE CAUGHT BEFORE THE SAME-ZONE SHORTCUT, or the ordinary warp path swallows it:
  // THE LANDING's toZone IS rune-hold, so `w.toZone === zoneIdRef.current` is true and the plain
  // `performWarp(w); return` below would fire with no crossing at all. That branch would leave the
  // keeper standing beside the arch in the town wondering why the door did nothing.
  const iLabel = pCode.indexOf('w.gate?.toUpperCase() === LANDING_LABEL')
  const iSameZone = pCode.indexOf('w.toZone === zoneIdRef.current')
  ok(iLabel > 0 && iSameZone > 0 && iLabel < iSameZone,
     `the label branch is tested before the same-zone shortcut (${iLabel} < ${iSameZone})`)

  // The arriving half must still be there — it is the other end of this same crossing.
  ok(/consumeArrival\(localStorage\)/.test(pCode), 'the town still consumes the staged arrival')
}

// ── 3. ONE FACT, ONE HOME ────────────────────────────────────────────────────────────────────
// The label lives in `world/landing.ts` and everything else reads it. A second `const` holding the
// same string is the hand-kept mirror: two copies agree with each other forever, including after
// one stops being true.
{
  const CO = read('voxel3d/crossing-out.ts')
  ok(!/export const LANDING_LABEL/.test(codeOnly(CO)),
     'crossing-out re-exports the label rather than declaring a second one')
  ok(/from '\.\.\/world\/landing'/.test(noComments(CO)), 'and it reads it from the map module')
  ok(LANDING_LABEL === 'THE LANDING', 'the one copy still says what the map editor writes')
}

console.log(fails.length
  ? `❌ landing wiring: ${fails.length} failed (${pass} passed)\n  - ${fails.join('\n  - ')}`
  : `✅ the door is called by something — ${pass} passed`)
if (fails.length) process.exit(1)
