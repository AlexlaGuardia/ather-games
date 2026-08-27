// The audio bus's invariants. Run: npx tsx src/app/shimmer/audio/audio-bus.test.ts
//
// Audio grew one module at a time across three lanes and every module made its own `AudioContext` —
// four inside Shimmer, each with a private gain and a private lifecycle. That cost two things that
// cannot exist without a shared bus: a single unlock (a browser needs a gesture per context, and a
// refusal is SILENT), and a master volume (four contexts cannot share a setting; `setHollowVolume`
// had no caller and could never have had a meaningful one).
//
// ⚠⚠ SO THE LOAD-BEARING ASSERT IS A COUNT, AND A COUNT IS THE THING THIS REPO KEEPS GETTING WRONG.
// Six files now DISCUSS `new AudioContext` in their comments — this one included — and a naive grep
// reports four contexts where there is one, which reads as "the refactor didn't land". The counter
// strips comments and strings first, and section 1 proves the stripper works by feeding it a file
// that talks about the thing without doing it. Same shape as the gx-adoption counter that read 24
// because a guard's asserts named the classes: a metric that counts its own documentation rewards
// exactly what it exists to measure against.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { codeOnly } from '../testing/guard'
import { join } from 'node:path'
import {
  audioCtx, bus, audioState, unlockAudio, setMasterVolume, masterVolume,
  noiseBuffer, tone, buzz, disposeAudio,
} from './bus'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SHIMMER = new URL('..', import.meta.url).pathname

/** Every .ts/.tsx under src/app/shimmer. */
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(e)) out.push(p)
  }
  return out
}

/**
 * ★ THE LOCAL STRIPPER IS GONE — it was one of SIX in this tree and they had already drifted into
 * four different behaviours. `testing/guard.ts` is the single implementation, and it is a scanner
 * rather than a regex because "is this slash-slash inside a string?" needs state. Its own oracle
 * runs the exact inputs the hand-rolled versions got wrong.
 */

/**
 * ⚠⚠ TEST FILES ARE EXCLUDED, AND THIS FILE IS WHY — IT CAUGHT ITS OWN AUTHOR ON THE FIRST RUN.
 * The section-3 scan reported TWO files touching `.destination`: the bus, and this file, whose
 * `/\.destination\b/` lives in a REGEX literal. `codeOnly` strips comments and strings; a regex is
 * neither, and stripping regex literals correctly is a parser, not a replace.
 *
 * So the fix is the one the gx-adoption counter needed: exclude the files whose JOB is to talk
 * about the thing. This file's header already warned about exactly this shape and it happened
 * anyway, one section below the warning — which is the useful part of the story: knowing the trap
 * is not the same as being outside it.
 *
 * ⚠ THE COST, NAMED RATHER THAN HIDDEN: a test file that constructs a real `AudioContext` is now
 * invisible to section 2. That is the right trade — a test is allowed its own device, and a scan
 * that counts its own asserts is a scan that punishes thoroughness.
 */
const FILES = walk(SHIMMER).filter(f => !/\.test\.tsx?$/.test(f))

// ── 1. ★★ THE STRIPPER WORKS, PROVED BEFORE IT IS TRUSTED ───────────────────────────────────────
// An instrument that cannot see its subject reports "nothing wrong". This one is asked to tell code
// from prose about code, so it is tested on both before a single count is believed.
{
  ok(codeOnly('// new AudioContext() in a comment').includes('AudioContext') === false,
     'a line comment mentioning it does not count')
  ok(codeOnly('/* new AudioContext() */').includes('AudioContext') === false,
     'a block comment mentioning it does not count')
  ok(codeOnly("throw new Error('new AudioContext failed')").includes('AudioContext') === false,
     'a string mentioning it does not count')
  ok(codeOnly('const a = new AudioContext()').includes('AudioContext') === true,
     '★ and a REAL construction still counts — the assert that keeps this from passing vacuously')
  ok(codeOnly('const url = "https://x/y" // not a comment start').includes('https') === false,
     'a url inside a string does not confuse the line-comment rule')
}

// ── 2. ★★★ EXACTLY ONE AUDIO DEVICE IN THE WHOLE OF SHIMMER ─────────────────────────────────────
{
  // ⚠ The scan set is asserted before it is counted. An empty or tiny set makes every count below
  // pass for the worst possible reason — this is the "empty measurement window" trap, and the only
  // defence is asking whether the instrument can see anything at all.
  ok(FILES.length > 100, `the scan actually walked the tree (${FILES.length} files)`)
  ok(FILES.some(f => f.endsWith('audio/bus.ts')), 'and the bus itself is in the set')
  ok(FILES.some(f => f.endsWith('play3d/gather-fx.ts')), 'and so are the modules being checked')
  ok(!FILES.some(f => /\.test\.ts$/.test(f)), 'while test files are excluded, as documented above')

  const makers = FILES.filter(f => /new\s+(AudioContext|AC)\s*\(/.test(codeOnly(readFileSync(f, 'utf8'))))
  const rel = makers.map(f => f.slice(SHIMMER.length))
  ok(makers.length === 1, `exactly one file constructs an AudioContext (${makers.length}: ${rel.join(', ')})`)
  ok(rel[0] === 'audio/bus.ts', `and it is the bus (${rel[0]})`)
}

// ── 3. ★★ AND EVERY SOUND GOES THROUGH THE MASTER ───────────────────────────────────────────────
// One context is not one volume. A module that connects to `.destination` is audible, correct-
// looking, and silently exempt from the slider — and the way anyone finds out is a player turning
// the volume down while one sound stays loud.
{
  const reaching = FILES.filter(f => /\.destination\b/.test(codeOnly(readFileSync(f, 'utf8'))))
  const rel = reaching.map(f => f.slice(SHIMMER.length))
  ok(reaching.length === 1, `exactly one file touches ctx.destination (${reaching.length}: ${rel.join(', ')})`)
  ok(rel[0] === 'audio/bus.ts', `and it is the bus, wiring the master to it (${rel[0]})`)
}

// ── 4. THE DUPLICATE `tone()` IS GONE ───────────────────────────────────────────────────────────
// `gather-fx.ts` and `rin-fx.ts` held byte-identical private copies — a hand-kept mirror in the
// layer least likely to be read. Two copies agree until someone edits one.
{
  const defs = FILES.filter(f => /function\s+tone\s*\(/.test(codeOnly(readFileSync(f, 'utf8'))))
  const rel = defs.map(f => f.slice(SHIMMER.length))
  ok(defs.length === 1, `exactly one tone() implementation (${defs.length}: ${rel.join(', ')})`)
  ok(rel[0] === 'audio/bus.ts', 'and it lives on the bus')

  for (const f of ['play3d/gather-fx.ts', 'play3d/rin-fx.ts', 'voxel3d/hollow-sfx.ts', 'engine/chatterbox.ts']) {
    const src = readFileSync(join(SHIMMER, f), 'utf8')
    ok(/from '\.\.\/audio\/bus'/.test(src), `${f} takes its device from the bus`)
  }
}

// ── 5. ⚠ THE WHOLE API NO-OPS WITH NO AUDIO DEVICE, WHICH IS EXACTLY WHERE THIS TEST RUNS ───────
// Node has no `window`, so `audioCtx()` returns null here — the same path a browser with the API
// blocked by policy takes. Audio is decorative by definition and must cost the game nothing when
// it is unavailable. This section is the real thing running, not a mock.
{
  ok(audioCtx() === null, 'with no window there is no context')
  ok(bus() === null, 'and no master to connect to')
  ok(audioState() === 'off', "state reads 'off' — distinct from 'suspended', which has a different fix")
  ok(unlockAudio() === false, 'unlocking reports failure rather than pretending')
  ok(noiseBuffer() === null, 'and there is no buffer to hand out')

  let threw = false
  try { tone(440, 50); tone(440, 50, { type: 'square', slideTo: 220, gain: 0.5 }); buzz(20); buzz([1, 2]); disposeAudio() }
  catch { threw = true }
  ok(!threw, '★ and none of tone/buzz/dispose throws — a frame loop calls these')
}

// ── 6. THE MASTER LEVEL IS A CLAMPED NUMBER, AND IT SURVIVES HAVING NO DEVICE ───────────────────
// A settings surface will read and write this before any gesture has happened.
{
  setMasterVolume(0.5); ok(masterVolume() === 0.5, 'the level round-trips')
  setMasterVolume(-3);  ok(masterVolume() === 0, 'below zero clamps to silence, never a negative gain')
  setMasterVolume(9);   ok(masterVolume() === 1, 'above one clamps — a gain over 1 is distortion, not loudness')
  setMasterVolume(0.9); ok(masterVolume() === 0.9, 'and it is restored for anyone reading after this test')
}

// ── 7. ★ THE FORWARDS STILL POINT SOMEWHERE ─────────────────────────────────────────────────────
// `unlockHollowSfx` / `hollowSfxState` / `disposeHollowSfx` / `unlockChatter` were the public names
// before the bus, and callers still use them. They must be forwards, never second implementations.
{
  const sfx = readFileSync(join(SHIMMER, 'voxel3d/hollow-sfx.ts'), 'utf8')
  ok(/export const unlockHollowSfx = \(\): boolean => unlockAudio\(\)/.test(sfx), 'unlockHollowSfx forwards to the bus')
  ok(/export const hollowSfxState = [^\n]*audioState\(\)/.test(sfx), 'hollowSfxState forwards to the bus')
  ok(/export const disposeHollowSfx = [^\n]*disposeAudio\(\)/.test(sfx), 'disposeHollowSfx forwards to the bus')

  const chat = readFileSync(join(SHIMMER, 'engine/chatterbox.ts'), 'utf8')
  ok(/export function unlockChatter\(\): void \{ unlockAudio\(\) \}/.test(chat), 'unlockChatter forwards to the bus')
  // ⚠ chatterbox KEEPS its own gain on purpose — stopSpeaking ramps it to zero to kill in-flight
  // oscillators, and that must not reach the rest of the game's sound. It is a LAYER under the
  // master, which is why it connects to `bus()` and not to the destination.
  ok(/masterGain\.connect\(out\)/.test(chat), 'and its layer gain feeds the bus rather than the destination')
}

// ── 8. ★★ AND THE SLIDER HAS TO REACH THE MASTER ────────────────────────────────────────────────
// A bus with no tap is plumbing. The whole argument for this refactor was "a volume slider becomes
// a one-line change" — so the slider is part of the claim, and sections 1-7 are all green without
// one existing.
{
  const settings = readFileSync(join(SHIMMER, 'voxel3d/settings.ts'), 'utf8')
  const world = readFileSync(join(SHIMMER, 'voxel3d/VoxelWorld.tsx'), 'utf8')

  ok(/\bvolume: number/.test(settings), 'volume is a persisted setting')
  ok(/volume: 0\.9/.test(settings), 'with a default that matches the bus\'s own starting level')

  // ⚠ OUTSIDE PRESETS, or flipping natural↔cartoon silently changes how loud the game is — a bug
  // nobody would think to attribute to a look toggle. Same reasoning `showFps` already carries.
  const omit = settings.match(/Omit<VoxelSettings,[^>]*>/)?.[0] ?? ''
  ok(/'volume'/.test(omit), `volume is excluded from PRESETS, so a style flip cannot change it (${omit})`)

  // ⚠⚠ A NaN GAIN IS NOT LOUD OR QUIET, IT IS SILENT FOREVER — on every load, with the slider
  // showing whatever it likes. The defaults-merge defends a MISSING field and does nothing about a
  // stored null or a hand-edited string.
  ok(/Number\.isFinite\(v\) \? Math\.max\(0, Math\.min\(1, v\)\)/.test(settings),
     'and a stored garbage value is refused at the door rather than becoming a NaN gain')

  ok(/setMasterVolume\(settings\.volume\)/.test(world), 'the world applies the saved volume to the bus')
  ok(/useEffect\(\(\) => \{ setMasterVolume\(settings\.volume\) \}, \[settings\.volume\]\)/.test(world),
     '★ from an EFFECT, so it runs on MOUNT too — inside `update` it would only fire when someone moves the slider, and a saved 20% would read as 90% until touched')
  ok(/update\(\{ volume: Number\(e\.target\.value\) \}\)/.test(world), 'and the slider writes it back')
}

console.log(`audio-bus: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
