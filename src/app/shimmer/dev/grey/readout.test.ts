/**
 * THE ONE THING ON THIS PAGE THAT IS NOT A PICTURE RETURNED A CONSTANT FOR FIVE DAYS.
 *
 * ★★★ WHAT HAPPENED (2026-08-27 to 2026-09-01). `dev/grey` exists because Alex said *"its looking
 * terrible .. is there a way to isolate this chunk to be able to double check your work"*, and its
 * header calls the luma readout **the only honest instrument on this page**. It called
 * `gl.readRenderTargetPixels(null as unknown as THREE.WebGLRenderTarget, …)`. three's first line is
 * `if (!(renderTarget && renderTarget.isWebGLRenderTarget)) { error(…); return }` — so it logged to
 * the console and returned **without touching the buffer**, leaving a fresh Uint8Array at zeros.
 * The panel printed `body 0.0 · ground 0.0 · body/ground 0.00` with total confidence, on every
 * frame, at every hour. The true values at those exact points were 19.4 and 30.4: a contrast ratio
 * of 0.64 reported as 0.00, which is the page's own stated definition of failure.
 *
 * ⚠⚠ NOTHING COULD SEE IT. three reports this by `console.error`, not by throwing, so the page did
 * not break. The `as unknown as` cast silenced the only check that would have caught it at compile
 * time. And `dev-eye.test.ts` EXEMPTS this page from the keeper-eye rule *on the premise that the
 * readout is meaningful* — an exemption resting on an instrument that had never once worked.
 *
 * ── WHY A SOURCE GUARD ───────────────────────────────────────────────────────────────────────
 * There is no headless way to run this frame loop; the value only exists once a GPU has drawn.
 * So this reads the call site, the same choice `channel-wiring.test.ts` makes and for the same
 * reason — and like that file, every marker must match EXACTLY ONCE, so a moved or duplicated
 * anchor reports BLIND rather than passing quietly.
 *
 * ⚠ AND IT ASSERTS THE PREMISE, NOT JUST THE FIX. Reading the default framebuffer is only correct
 * because `<Canvas gl={{ preserveDrawingBuffer: true }}>` keeps the last frame — `useFrame` at the
 * default priority runs BEFORE the draw, so without that flag this samples a cleared buffer and
 * goes straight back to reporting zeros. The play lane proved that mechanism the same evening from
 * the other side: the WORLD's canvas does not set it, which is why a lost context there shows a
 * cleared canvas rather than the last frame. One-directional guards go quiet exactly when the old
 * bug returns; this one fails if the premise is removed.
 *
 * Run: `npx tsx src/app/shimmer/dev/grey/readout.test.ts` (repo convention — there is no vitest).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { codeOnly } from '../../testing/guard'

let pass = 0
const fails: string[] = []
const blind: string[] = []
function ok(cond: boolean, label: string) {
  if (cond) pass++
  else fails.push(label)
}
/** Exactly-once matching: a marker that moved or doubled is BLIND, which is not the same as FAIL. */
function once(hay: string, needle: string, label: string) {
  const n = hay.split(needle).length - 1
  if (n === 1) pass++
  else blind.push(`${label} — matched ${n}x, expected exactly 1 (marker: ${needle})`)
  return n === 1
}

const PAGE = join(process.cwd(), 'src/app/shimmer/dev/grey/page.tsx')
const raw = readFileSync(PAGE, 'utf8')
const code = codeOnly(raw)

// ── 1. THE BUG ITSELF, BY ITS MECHANISM ───────────────────────────────────────────────────────
// ⚠ Read through `codeOnly`: the file's header now QUOTES the old broken call to explain it, so a
// raw search would match the very comment that documents the fix. PATTERNS 2026-08-22 — documenting
// a marker creates a marker, and the prose being accurate is not the property that saves you.
ok(!/readRenderTargetPixels/.test(code),
  'THE ZERO BUG IS BACK: readRenderTargetPixels is called again. It needs a real WebGLRenderTarget; with null it errors to console and returns, leaving the buffer at zeros and the panel confidently reporting 0.0')
ok(!/as unknown as/.test(code),
  'A CAST IS SILENCING A TYPE ERROR in the file whose instrument was broken by exactly that cast. Never widen a type to make an argument fit an API — the API meant it')

// ── 2. THE FIX IS PRESENT, AND READS THE CANVAS ───────────────────────────────────────────────
once(code, 'ctx.readPixels(', 'the pixel read')
once(code, 'ctx.bindFramebuffer(ctx.FRAMEBUFFER, null)', 'binding the default framebuffer')
ok(/const ctx = gl.getContext\(\)/.test(code), 'the raw GL context is no longer obtained — the read cannot reach the canvas')

// ── 3. THE PREMISE THE FIX RESTS ON ───────────────────────────────────────────────────────────
// Without this the read samples a cleared buffer, because useFrame runs before the draw.
ok(/preserveDrawingBuffer:\s*true/.test(code),
  'PREMISE GONE: the Canvas no longer sets preserveDrawingBuffer. useFrame runs BEFORE the renderer draws, so the readout is now sampling a cleared buffer and is back to reporting zeros')

// ── 4. THE SAMPLE POINTS dev-eye.test.ts EXEMPTS THIS PAGE FOR ────────────────────────────────
// ⚠ That exemption is worded as *the readout samples fixed frame coordinates, so moving the camera
// falsifies it*, and its premise is these two literals. If they change, go read that exemption
// rather than editing this line — the two files are making one argument together.
once(code, 'read(0.5, 0.46)', "the body sample point (dev-eye's exemption premise)")
once(code, 'read(0.5, 0.88)', "the ground sample point (dev-eye's exemption premise)")

// ── 5. THE BUFFER IS CLEARED BEFORE EACH READ ─────────────────────────────────────────────────
// ★ Without this a failed readPixels leaves the PREVIOUS point's bytes in place, so body and ground
// would agree perfectly — which this page renders as its headline failure state. A stale read that
// looks like a real finding is worse than a zero.
ok(/px\[0\] = px\[1\] = px\[2\] = px\[3\] = 0/.test(code),
  'the sample buffer is not zeroed between reads: a failed read would silently reuse the previous point and report body == ground, the exact failure this page exists to detect')

console.log(`grey-readout: ${pass} pass, ${fails.length} fail, ${blind.length} blind`)
for (const b of blind) console.error(`  ⚠ BLIND ${b}`)
for (const f of fails) console.error(`  ✗ ${f}`)
if (fails.length || blind.length) process.exit(1)
