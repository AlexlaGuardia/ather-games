// The collar-prompt oracle. Run: npx tsx src/app/shimmer/voxel3d/collar-prompt.test.ts
//
// Alex, playing 2026-08-27: *"the moglin enemies chased me down with no way to interact."* Nothing
// was broken. Casting was wired, `answerCollar` was oracle-tested, every refusal already spoke its
// own reason — and the only way to learn the verb was to get it wrong first, which reads exactly
// like a game with no verb for this.
//
// ⚠ THE CASE THAT MATTERS MOST IS THE ONE WHERE THE ANSWER IS NOT A KEY. Telling a keeper to press
// B when their Signature slot is empty, or is seated with a move canon REFUSES, is worse than
// saying nothing: they press it, nothing happens, and the game takes the blame for a rule it never
// explained. Section 2 is that case and it is the reason this module exists rather than a string.

import { readFileSync } from 'node:fs'
import { collarPrompt, collarPromptText, type PromptSlot } from './collar-prompt'
import { KEEPER_MOVES } from '../play3d/keeper-moves'
import { ALL_BANDS } from '../play3d/cast'
import { answerCollar } from '../engine/collar-foes'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ★ THE TABLE IS ASKED, NEVER RESTATED. Which moves open a collar is authored on the move itself,
// so a reclassification tomorrow moves this test with no edit here.
const opens = (id: string) => KEEPER_MOVES.find(m => m.id === id)?.collar === 'opens'
const name = (id: string) => KEEPER_MOVES.find(m => m.id === id)?.name ?? id
const OPENER = KEEPER_MOVES.find(m => m.collar === 'opens')!
const CRUEL = KEEPER_MOVES.find(m => m.collar === 'cruelty')!
const KIND = KEEPER_MOVES.find(m => m.collar === 'no-contest')!

// ── 1. ★★ THE HAPPY PATH NAMES A REAL KEY AND A REAL MOVE ───────────────────────────────────────
{
  const p = collarPrompt([{ key: 'z', moveId: OPENER.id }, { key: 'b', moveId: null }], opens, name)
  ok(p.kind === 'ready', 'an opener seated in the tactical slot is ready')
  ok(p.kind === 'ready' && p.key === 'z', 'and it names THAT slot\'s key, not a literal')
  ok(p.kind === 'ready' && p.moveName === OPENER.name, 'and the move by its authored name')
  ok(collarPromptText(p).includes('Z'), 'the line shows the key in upper case, as the keys are drawn')
  ok(collarPromptText(p).includes(OPENER.name), 'and the move name')
}

// ── 2. ★★★ THE EMPTY-SLOT AND WRONG-RUNE CASES NEVER NAME A KEY ─────────────────────────────────
// The whole point. A prompt that sends someone to a key that cannot work is worse than silence.
{
  const none = collarPrompt([{ key: 'z', moveId: null }, { key: 'b', moveId: null }], opens, name)
  ok(none.kind === 'none-seated', 'nothing seated at all reads as none-seated')
  ok(!/\bZ\b|\bB\b/.test(collarPromptText(none)), 'and the line names no key')

  const wrong = collarPrompt([{ key: 'z', moveId: CRUEL.id }, { key: 'b', moveId: KIND.id }], opens, name)
  ok(wrong.kind === 'wrong-runes', 'seated with a refused move and a no-contest move reads as wrong-runes')
  ok(!/\bZ\b|\bB\b/.test(collarPromptText(wrong)), 'and THAT line names no key either — the trap this exists to avoid')
  ok(collarPromptText(wrong).includes(CRUEL.name) && collarPromptText(wrong).includes(KIND.name),
     'it names what they DO have, so the next move is legible')

  // ⚠ The half-empty case: one seated, refused; one empty. Still not a key.
  const half = collarPrompt([{ key: 'z', moveId: CRUEL.id }, { key: 'b', moveId: null }], opens, name)
  ok(half.kind === 'wrong-runes', 'one refused move and one empty slot is still wrong-runes, not ready')
}

// ── 3. THE RECOMMENDATION AGREES WITH THE RULE THAT WILL JUDGE IT ───────────────────────────────
// ★★ The sharpest assert here. The prompt and the outcome are two different code paths — the HUD
// and the shot resolver — and a prompt that recommends a move `answerCollar` then refuses is the
// worst possible outcome: the game told them to do it. Asked of EVERY move in the table.
{
  const collared = { id: 'f1', posture: 'skirmisher' as const, x: 0, z: 0, integrity: 100, seen: true }
  for (const m of KEEPER_MOVES) {
    const p = collarPrompt([{ key: 'z', moveId: m.id }], opens, name)
    if (p.kind !== 'ready') continue
    ok(answerCollar(collared as never, m.collar) === 'opens',
       `${m.name} is recommended, and answerCollar opens the collar for it`)
  }
  // And the converse: nothing the rule accepts is left unrecommended when it is the only thing seated.
  for (const m of KEEPER_MOVES) {
    if (answerCollar(collared as never, m.collar) !== 'opens') continue
    ok(collarPrompt([{ key: 'z', moveId: m.id }], opens, name).kind === 'ready',
       `${m.name} opens collars, so seating it alone gets a ready prompt`)
  }
}

// ── 4. ⚠ AND AN OPENER HAS TO BE REACHABLE AT ALL ───────────────────────────────────────────────
// A prompt reading "seat a rune that strikes it" is a cruel joke if the build has no such rune to
// seat. This is the exemption shape: the advice would be correct and useless, and nothing else in
// the tree would notice.
{
  const openers = KEEPER_MOVES.filter(m => m.collar === 'opens')
  ok(openers.length > 0, `the catalogue contains at least one move that opens a collar (${openers.length})`)
  ok(openers.some(m => ALL_BANDS.includes(m.tier as never)),
     `and at least one of them is seatable in a cast band (${openers.map(m => `${m.name}/${m.tier}`).join(', ')})`)
}

// ── 5. FIRST SEATED OPENER WINS, IN SLOT ORDER ──────────────────────────────────────────────────
// Stability, not cleverness: ranking by cooldown would make the line change between two frames as
// cooldowns turn over, and a prompt that moves while you read it teaches nothing.
{
  const two = KEEPER_MOVES.filter(m => m.collar === 'opens').slice(0, 2)
  if (two.length === 2) {
    const p = collarPrompt([{ key: 'z', moveId: two[0].id }, { key: 'b', moveId: two[1].id }], opens, name)
    ok(p.kind === 'ready' && p.key === 'z', 'with two openers seated the earlier slot is named')
  } else ok(true, 'only one opener in the table — slot-order tie has no case to test')

  // A later opener is still found when the earlier slot holds a refused move.
  const p2 = collarPrompt([{ key: 'z', moveId: CRUEL.id }, { key: 'b', moveId: OPENER.id }], opens, name)
  ok(p2.kind === 'ready' && p2.key === 'b', 'a refused move in slot 0 does not hide an opener in slot 1')
}

// ── 6. ★★ AND THE GAME HAS TO SHOW IT ───────────────────────────────────────────────────────────
// Everything above stays green with the prompt never rendered. This repo lost a week to a module
// that was right and a consumer that reached around it.
{
  const src = readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8')

  ok(/collarPromptText\(/.test(src), 'VoxelWorld renders the prompt text')
  ok(/\{collarNear && /.test(src), 'and only while a collared foe is actually near')
  ok(/onCollarNear\(pressedByCollar\)/.test(src), 'the world emits the proximity')
  ok(/pressedByCollar !== lastCollarNear\.current/.test(src),
     'on the EDGE — a per-frame setState here would re-render the HUD sixty times a second')
  ok(/let pressedByCollar = false/.test(src), 'and the flag is reset every frame, not carried')

  // ⚠ The slots must come off the live loadout. A hardcoded key list here is the bug wearing the
  // fix's clothes: it would look right and be wrong for anyone who rebound or reseated anything.
  ok(/key: CAST_KEYS\[i\]/.test(src), 'the prompt reads the real bound keys')
  ok(/cast\.current\?\.ids\[i\]/.test(src), 'and the live seated moves, not a snapshot')
  // ⚠⚠ THIS PAIR IS ANCHORED TO THE COLLECTION LINE, NOT GREPPED LOOSE, AND THE FIRST VERSION OF
  // IT WAS WRONG. `/hostile\(e\.f\)/` over the whole file is satisfied by being ANYWHERE — the
  // freed-Moglin farewell check and the shot resolver both contain it — so deleting the guard from
  // the prompt's own condition left the assert perfectly green. PATTERNS has this exact shape
  // written up: ask of any passing guard what the cheapest wrong answer that still satisfies it is.
  // Caught by mutation, not by review.
  const collect = src.match(/if \([^\n]*\)\n\s*pressedByCollar = true/)?.[0] ?? ''
  ok(collect !== '', 'the prompt\'s own collection line is findable')
  ok(/hostile\(e\.f\)/.test(collect), 'a freed Moglin does not raise the prompt — the guard is on THAT line')
  ok(/foeDef\(e\.f\.posture\)\.reach/.test(collect), 'and the range is derived from the posture\'s own reach')
}

console.log(`collar-prompt: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
