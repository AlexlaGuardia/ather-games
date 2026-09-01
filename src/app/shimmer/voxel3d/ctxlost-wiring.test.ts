// ── `/ctxlost` — THE TRIGGER'S HOST WIRING, a call-site guard (focus #938) ──────────────────────
// Run: npx tsx src/app/shimmer/voxel3d/ctxlost-wiring.test.ts
//
// `console.test.ts` proves the verb: it exists, it is owner-gated, it calls `ctxLost()`. It cannot
// prove the thing the verb is FOR, because a console command that returns a cheerful string while
// the context stays alive passes every assert a pure registry test can make.
//
// ── ★★★ WHAT THIS FILE ACTUALLY GUARDS, AND IT IS ONE PROPERTY ──────────────────────────────────
// That the trigger enters the world THROUGH THE DOOR THE REAL FAILURE USES. The overlay is the last
// link of a five-link chain — the browser fires `webglcontextlost`, the handler preventDefaults,
// `ctxLost.current` flips, the frame loop bails on it, `onContextLost(Date.now())` latches the
// moment. A trigger that set the overlay's state directly would exercise link five and be read as
// evidence about all five: the panel would draw, correctly, over a world that was STILL DRAWING.
// That is not the event Alex met — he met a frozen frame under a HUD reporting 60fps — so the
// picture would differ from the real one in the exact respect the panel's own text talks about
// ("what you can see is the last frame it managed"), and it would RETIRE the question instead of
// answering it. The cheapest wrong answer that still shows a panel is the one to guard against.
//
// ⚠⚠ A TEXTUAL READER, FOR THE REASON `channel-wiring.test.ts` GIVES: `VoxelWorld.tsx` is a
// ~9,800-line component pulling in three.js and WebGL, there is no headless way to run its frame
// loop, and a runtime oracle would need a host that is not this host. So read the source and make
// the reader fail LOUD when it stops being able to see. Every marker must match EXACTLY ONCE: zero
// means the code moved and this file went BLIND, two means a comment now quotes the marker — the
// way a guard eats itself. BLIND is counted and exits non-zero SEPARATELY from FAIL, because
// "I could not look" and "I looked and it is fine" must never share an exit code.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { blockAt, codeOnly } from '../testing/guard'

let ok = 0, bad = 0, blind = 0
const chk = (name: string, cond: boolean, extra = '') => {
  if (cond) { ok++; console.log(`  ok   ${name}`) }
  else { bad++; console.log(`  FAIL: ${name} ${extra}`) }
}
const HOST = join(process.cwd(), 'src/app/shimmer/voxel3d/VoxelWorld.tsx')
const src = readFileSync(HOST, 'utf8')

const once = (label: string, re: RegExp): boolean => {
  const n = (src.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || []).length
  if (n === 1) return true
  blind++
  console.log(`  BLIND: ${label} — matched ${n} times, expected exactly 1 (the code moved, or a comment now quotes it)`)
  return false
}

console.log('\n── 1. the bridge exists end to end, or the verb only ever says "still waking" ──')
// Three links, each silently survivable alone: a ref nobody fills, a ctx entry nobody wired, a prop
// nobody passed. The verb degrades to a message in all three cases — it does not throw and does not
// log, so nothing distinguishes "not built" from "built and the world has not mounted yet".
chk('the outward ref is declared', once('ref decl', /const ctxLostOut = useRef<\(\(\) => string\) \| null>\(null\)/))
chk('the console reads it through the ref', once('ctx entry', /ctxLost: \(\) => ctxLostOut\.current \? ctxLostOut\.current\(\) : /))
chk('the scene is handed the ref', once('prop pass', /ctxLostOut=\{ctxLostOut\}/))
chk('...and the scene actually fills it', once('assignment', /ctxLostOut\.current = \(\) => \{/))

console.log('\n── 2. ★★★ THE TRIGGER SITS INSIDE THE EFFECT THAT OWNS THE LISTENERS ──')
// The load-bearing assert. If the assignment drifts into an effect of its own it can be installed
// on a canvas whose listeners are not attached — the context dies and NOTHING catches it, which is
// the original bug with the trigger's name on it.
{
  const i = src.indexOf("cv.addEventListener('webglcontextlost', lost)")
  const j = src.indexOf('}, [gl, onContextLost, ctxLost, ctxLostOut])')
  if (i < 0 || j < 0) { blind++; console.log('  BLIND: could not locate the context-loss effect (listener or dep array moved)') }
  const body = i >= 0 && j > i ? src.slice(i, j) : ''
  chk('the assignment is inside that effect', !!body && body.includes('ctxLostOut.current = () => {'))
  chk('...and the effect nulls it on teardown, so a stale closure cannot fire at a dead canvas',
    !!body && /ctxLostOut\.current = null/.test(body))
}

console.log('\n── 3. ★★ IT DROPS THE REAL CONTEXT — the assert the whole file is for ──')
//
// ⚠⚠ THIS SECTION'S FIRST VERSION SLICED A FLAT 700 CHARACTERS AND WENT RED ON CORRECT CODE. The
// window overran the trigger and swallowed the effect's teardown AND its dependency array, which
// names `onContextLost` — so the negative assert below fired on a dep list. A magic character count
// is a domain nobody chose. `blockAt` ends the slice at the arrow function's own closing brace, and
// the fix is the domain rather than a bigger number.
{
  const b = blockAt(src, 'ctxLostOut.current = () => {', '\n    }\n')
  if (b.at < 0) { blind++; console.log('  BLIND: could not find the trigger body') }
  // ⚠ AND THE SECOND RUN TAUGHT THE OTHER HALF OF THE SAME RULE: `codeOnly` blanks STRING BODIES as
  // well as comments, so a positive assert about a string LITERAL cannot be made against `code` — it
  // went red on correct code a second time. The split is not a workaround, it is the honest reading:
  // ask `code` what the file DOES (a call on the live context) and `raw` WHICH ONE (the name inside
  // the quotes). Neither question can be answered by the other's source.
  chk('it asks the live renderer context for an extension',
    /gl\.getContext\(\)\.getExtension\(/.test(b.code))
  chk('...and the extension it asks for is WEBGL_lose_context',
    /getExtension\('WEBGL_lose_context'\)/.test(b.raw))
  chk('...and actually calls loseContext()', /\.loseContext\(\)/.test(b.code))
  // ⚠ The mutation this exists to catch: swap the extension call for a state poke and the panel
  // still draws, over a live world. Every assert above would stay green without this one.
  // ★ `code`, never `raw` — the block's own comment explains what it must NOT do, and a negative
  // assert over prose fails on its own documentation. guard.ts says so in its docstring; this file
  // learned it the expensive way twice in one run.
  chk('it does NOT reach for the overlay latch directly — that would draw the panel over a live world',
    b.at >= 0 && !/onContextLost|setCtxLost/.test(b.code))
  chk('it does NOT flip the frame-loop ref by hand either — the real event is what must flip it',
    b.at >= 0 && !/ctxLost\.current\s*=/.test(b.code))
}

console.log('\n── 4. ⚠ AN ABSENT EXTENSION REPORTS ITSELF RATHER THAN NO-OPPING ──')
// A browser that will not drop a context on request is common. A silent no-op there hands back
// "I could not look" wearing the costume of "the overlay is broken" — an instrument's own blindness
// arriving dressed as a finding about the subject it was pointed at.
{
  const b = blockAt(src, 'ctxLostOut.current = () => {', '\n    }\n')
  chk('the missing-extension branch exists and returns before losing anything',
    /if \(!ext\) return /.test(b.code))
  // Same split as section 3: the branch is structure (`code`), the message it returns is a literal
  // (`raw`). A reply that does not name the extension sends the reader hunting the overlay instead.
  chk('...and it names the extension, so the reply is diagnosable',
    /if \(!ext\) return [^\n]*WEBGL_lose_context/.test(b.raw))
}

console.log('\n── 5. ★ NOTHING RESTORES THE CONTEXT ON PURPOSE ──')
// A trigger that healed itself would show the panel and then take away the frozen world under it —
// and the frozen world is half of what there is to look at, since the confusion this panel exists
// to end is a still frame that reads as "the movement change locked the game up". It is also what
// makes the panel's own "reloading will not clear it" true when triggered rather than only in the
// wild. ⚠ This assert is about the WHOLE file: a restoreContext() anywhere defeats it.
// ⚠⚠⚠ AND THE FIRST VERSION OF THIS ASSERT FAILED ON ITS OWN AUTHOR'S PROSE, WHICH IS THE HOUSE'S
// "documenting a marker created a marker" bug performed live. The trigger's docstring says NOTHING
// CALLS restoreContext, DELIBERATELY — and a bare /restoreContext\(/ over the raw source counts that
// sentence as a call. The comment was accurate; accuracy is not the property that saves you. Read
// `codeOnly`, which blanks comments and string bodies, so the guard judges what the file DOES.
chk('no restoreContext() call exists in the host', !/restoreContext\(/.test(codeOnly(src)))

console.log('\n── 6. ★★ THE PANEL DESCRIBES WHAT A LOST CONTEXT ACTUALLY LOOKS LIKE ──')
// Added 2026-09-01 after the trigger put the overlay on screen for the first time. The panel used
// to say "what you can see is the last frame it managed". It is not: the canvas goes BLANK. The
// 08-31 incident report says Alex met a WHITE canvas in the wild, so the deliberate trigger and the
// real event agree, and neither leaves a frozen frame.
//
// ⚠⚠ BIDIRECTIONAL ON PURPOSE, WHICH IS THE ONLY THING THAT MAKES A PROSE GUARD WORTH WRITING.
// A one-directional "the page must not say X" check goes quiet at exactly the moment X becomes TRUE
// again — and here there is a specific switch that would do it. `preserveDrawingBuffer` is what buys
// a page the right to its last frame; this Canvas does not pass it, which is WHY the claim was false.
// So the guard asserts BOTH: the retired sentence is gone, AND the fact that retired it still holds.
// Turn the buffer on and this fires, and someone gets sent back to the copy rather than discovering
// the panel has quietly started lying in the other direction.
{
  const overlay = blockAt(src, 'graphics context lost', '</p>')
  if (overlay.at < 0) { blind++; console.log('  BLIND: could not find the overlay block') }
  // ★ `code`, not `raw`: JSX TEXT survives codeOnly (it is neither a comment nor a string literal),
  // so the real copy is still judged — while a JSX comment discussing the retired sentence is
  // blanked and cannot trip it. That is the exact bug this file shipped with in section 5, and the
  // correction note above this overlay names the retired phrase, so without `code` the guard would
  // fail on its own documentation for the second time in one session.
  chk('the panel no longer promises a frozen last frame',
    overlay.at >= 0 && !/last frame it managed/.test(overlay.code))
  chk('...and says the view went blank instead',
    /the view went blank/.test(overlay.raw))
  // The fact that makes the sentence above correct. `once` so a second Canvas cannot smuggle one in.
  chk('the world Canvas still does not preserve the drawing buffer — the reason there is no last frame',
    once('world canvas', /<Canvas camera=\{\{ fov: 75/) && !/preserveDrawingBuffer/.test(codeOnly(src)))
}

console.log(`\nctxlost-wiring oracle: ${ok} passed, ${bad} failed, ${blind} blind`)
// ⚠ BLIND COUNTS AS DRIFT — a reader that cannot see its subject reports "nothing wrong" unless the
// exit code says otherwise, which is the entire reason this file is shaped like this.
process.exit(bad || blind ? 1 : 0)
