// M186: the controller in the open world. padStep turns one gamepad sample into the keys / touch-store writes the open
// world already understands, through voxel3d's bindings. Run: npx tsx src/app/shimmer/open/shared/pad.test.ts
import { readFileSync } from 'node:fs'
import type { PadButton } from '@/lib/input/actions'
import { merge } from '@/lib/input/bindings'
import type { PadSample } from '@/lib/input/gamepad'
import { newPadState, padStep, releaseAll, padActed, padPrompt, OPEN_CODE, PAD_LOOK_RAD_S, type PadEffect } from './pad'
import { hintFor } from '@/lib/input/hints'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const map = merge(null)

// a tiny pad: feed the buttons down this frame; pressed = edges against the last frame (what gamepad.ts › poll does)
function pad() {
  let prev = new Set<PadButton>()
  return (down: PadButton[], axes: Partial<Pick<PadSample, 'lx' | 'ly' | 'rx' | 'ry'>> = {}): PadSample => {
    const d = new Set(down), p = new Set([...d].filter(b => !prev.has(b))); prev = d
    return { down: d, pressed: p, lx: 0, ly: 0, rx: 0, ry: 0, kind: 'playstation', ...axes }
  }
}
const has = (fx: PadEffect[], e: PadEffect) => fx.some(f => JSON.stringify(f) === JSON.stringify(e))

// 1. A = Space, held for as long as the button: keydown on the press, nothing while held, keyup on release
{
  const s = newPadState(), p = pad()
  let fx = padStep(s, p(['A']), map, false, 1 / 60)
  ok(has(fx, { t: 'keydown', code: 'Space' }), 'A press → Space keydown')
  fx = padStep(s, p(['A']), map, false, 1 / 60)
  ok(!fx.some(f => f.t === 'keydown' || f.t === 'keyup'), 'A held → no repeat keydown')
  fx = padStep(s, p([]), map, false, 1 / 60)
  ok(has(fx, { t: 'keyup', code: 'Space' }), 'A release → Space keyup')
}
// 2. the face / menu buttons say the open world's codes (the 08-28 map: X interact, Y draw, SELECT map, START settings, D-up bag, B close)
{
  const want: [PadButton, string][] = [['X', 'KeyE'], ['Y', 'KeyR'], ['SELECT', 'KeyM'], ['START', 'KeyO'], ['DUP', 'KeyI'], ['B', 'Escape'], ['L3', 'ShiftLeft'], ['RB', 'KeyF'], ['LB', 'KeyQ']]
  for (const [b, code] of want) {
    const s = newPadState(), p = pad()
    ok(has(padStep(s, p([b]), map, false, 0), { t: 'keydown', code }), `${b} → ${code}`)
  }
}
// 3. the chord: RB held then LB = the signature (KeyX tap), and the tactical (KeyQ) is NOT pressed; RB's shield keeps charging
{
  const s = newPadState(), p = pad()
  padStep(s, p(['RB']), map, false, 0)
  const fx = padStep(s, p(['RB', 'LB']), map, false, 0)
  ok(has(fx, { t: 'tap', code: 'KeyX' }), 'RB+LB → signature tap')
  ok(!has(fx, { t: 'keydown', code: 'KeyQ' }), 'RB+LB → no tactical')
  ok(!fx.some(f => f.t === 'keyup' && f.code === 'KeyF'), 'RB+LB → shield still held')
}
// 4. RT is the trigger, set on the press only (a semi-auto the combat clears must not refire while held); LT holds the sights
{
  const s = newPadState(), p = pad()
  ok(has(padStep(s, p(['RT']), map, false, 0), { t: 'fire', on: true }), 'RT press → fire')
  ok(!padStep(s, p(['RT']), map, false, 0).some(f => f.t === 'fire'), 'RT held → no second fire write')
  ok(has(padStep(s, p([]), map, false, 0), { t: 'fire', on: false }), 'RT release → fire off')
  ok(has(padStep(s, p(['LT']), map, false, 0), { t: 'aim', on: true }), 'LT → aim on')
  ok(has(padStep(s, p([]), map, false, 0), { t: 'aim', on: false }), 'LT release → aim off')
}
// 5. sticks: left = move (forward = stick up), right = look (squared, radians a second); a resting stick writes nothing
{
  const s = newPadState(), p = pad()
  let fx = padStep(s, p([], { lx: 0.5, ly: -1 }), map, false, 0.1)
  ok(has(fx, { t: 'move', x: 0.5, y: 1 }), 'left stick up-right → move forward + right')
  fx = padStep(s, p([]), map, false, 0.1)
  ok(has(fx, { t: 'move', x: 0, y: 0 }), 'stick back → one zero write')
  fx = padStep(s, p([]), map, false, 0.1)
  ok(!fx.some(f => f.t === 'move'), 'resting stick → no write (the phone stick is not stomped)')
  fx = padStep(s, p([], { rx: 0.5, ry: -0.5 }), map, false, 0.1)
  const look = fx.find(f => f.t === 'look') as Extract<PadEffect, { t: 'look' }> | undefined
  ok(!!look && Math.abs(look.dx - 0.25 * PAD_LOOK_RAD_S * 0.1) < 1e-9 && Math.abs(look.dy + 0.25 * PAD_LOOK_RAD_S * 0.1) < 1e-9, 'right stick → look, squared')
}
// 6. the hotbar: d-pad left / right step it outside a menu
{
  const s = newPadState(), p = pad()
  ok(has(padStep(s, p(['DRIGHT']), map, false, 0), { t: 'hotbar', dir: 1 }), 'D-right → next slot')
  ok(has(padStep(s, p(['DLEFT']), map, false, 0), { t: 'hotbar', dir: -1 }), 'D-left → prev slot')
}
// 7. a menu: held keys are let go, the d-pad navigates, A accepts, B / START / SELECT still close / options / map; nothing else leaks
{
  const s = newPadState(), p = pad()
  padStep(s, p(['A', 'RT'], { ly: -1 }), map, false, 0)
  let fx = padStep(s, p(['A', 'RT'], { ly: -1 }), map, true, 0)
  ok(has(fx, { t: 'keyup', code: 'Space' }) && has(fx, { t: 'fire', on: false }) && has(fx, { t: 'move', x: 0, y: 0 }), 'menu opens → everything let go')
  fx = padStep(s, p(['DDOWN']), map, true, 0)
  ok(has(fx, { t: 'nav', dir: 'down' }) && !fx.some(f => f.t === 'keydown'), 'menu: D-down navigates, no key')
  fx = padStep(s, p(['A']), map, true, 0)
  ok(has(fx, { t: 'accept' }) && !has(fx, { t: 'keydown', code: 'Space' }), 'menu: A accepts, does not jump')
  fx = padStep(s, p(['B']), map, true, 0)
  ok(has(fx, { t: 'tap', code: 'Escape' }), 'menu: B closes')
  fx = padStep(s, p(['DUP']), map, true, 0)
  ok(!has(fx, { t: 'tap', code: 'KeyI' }) && has(fx, { t: 'nav', dir: 'up' }), 'menu: D-up navigates, does not re-press the bag')
  fx = padStep(s, p(['X']), map, true, 0)
  ok(!fx.some(f => 'code' in f && f.code === 'KeyE'), 'menu: X does not use')
}
// 8. the pad going quiet lets go of everything
{
  const s = newPadState(), p = pad()
  padStep(s, p(['A', 'RB']), map, false, 0)
  const fx = padStep(s, null, map, false, 0)
  ok(has(fx, { t: 'keyup', code: 'Space' }) && has(fx, { t: 'keyup', code: 'KeyF' }), 'pad gone → keyups')
  ok(releaseAll(s).length === 0, 'released twice → nothing')
}
// 9. every code the pad presses is one the open world already listens for (keymap.ts ACTIONS) or the browser's Escape
{
  const src = readFileSync('src/app/shimmer/open/shared/keymap.ts', 'utf8')
  for (const code of Object.values(OPEN_CODE)) ok(code === 'Escape' || src.includes(`code: '${code}'`), `${code} is an open-world action`)
}
// 10. wiring: both open-world pages mount the bridge, and the bridge polls the shared module (not a fork)
{
  const ather = readFileSync('src/app/shimmer/open/ather/page.tsx', 'utf8'), cont = readFileSync('src/app/shimmer/open/continent/page.tsx', 'utf8')
  const bridge = readFileSync('src/app/shimmer/open/shared/pad-bridge.tsx', 'utf8'), hud = readFileSync('src/app/shimmer/open/shared/game-hud.tsx', 'utf8')
  ok(/<PadBridge menuOpen=/.test(ather) && /<PadBridge menuOpen=/.test(cont), 'both pages mount <PadBridge>')
  ok(/from '@\/lib\/input\/gamepad'/.test(bridge) && /poll\(\)/.test(bridge), 'bridge polls src/lib/input/gamepad.ts')
  ok(/addEventListener\('pad:hotbar'/.test(hud), 'GameHud hears the d-pad hotbar step')
}

// M186 s2: the pad takes the game on a press or a pushed stick, not on a held button or a resting drift
{
  const p = pad()
  ok(padActed(p(['X'])), 'a press takes the game')
  ok(!padActed(p(['X'])), 'a button merely held does not re-take it (the mouse can win while it rests)')
  ok(!padActed(p([], { lx: 0.3 })), 'a stick drift under half does not take the game')
  ok(padActed(p([], { ry: -0.8 })), 'a stick pushed past half takes the game')
  ok(!padActed(null), 'no pad never takes it')
}
// M186 s2: prompts name the pad's button for 'use' (DualSense: □, Xbox: X), only the key letter changes
{
  const ps = hintFor(map, 'world.interact', 'pad', 'playstation'), xb = hintFor(map, 'world.interact', 'pad', 'xbox')
  ok(ps === '□' && xb === 'X', `world.interact on a pad = □ / X (${ps} / ${xb})`)
  ok(padPrompt('E · Gregory (buy ground)', ps) === '□ · Gregory (buy ground)', 'E · Gregory -> □ · Gregory')
  ok(padPrompt('E · Place · hold E to turn', xb) === 'X · Place · hold X to turn', 'hold E -> hold X')
  ok(padPrompt('E · Gregory (buy ground)', null) === 'E · Gregory (buy ground)', 'no pad: the text as it is')
  ok(padPrompt('Elder · Eve', ps) === 'Elder · Eve', 'a word starting with E is not a key')
  ok(padPrompt('THE · way', ps) === 'THE · way', 'a word ending in E is not a key')
  const bridge = readFileSync('src/app/shimmer/open/shared/pad-bridge.tsx', 'utf8')
  const ather = readFileSync('src/app/shimmer/open/ather/page.tsx', 'utf8'), cont = readFileSync('src/app/shimmer/open/continent/page.tsx', 'utf8')
  ok(/padPrompt\(!isTouch && stance\.kind === 'weapon'/.test(ather) && /padPrompt\(hud\.prompt, padGlyph\)/.test(cont), 'both pages pass their world prompt through padPrompt')
  ok(/exitPointerLock/.test(bridge), 'the pad taking the game lets the mouse go (so the mouse next shows a cursor)')
  ok(/addEventListener\('mousemove'/.test(bridge) && /cursor:none !important/.test(bridge), 'the mouse moving hands the game back; the pad hides the cursor')
  ok(/data-audio-locked/.test(bridge) && /isTrusted\) return[\s\S]{0,200}audio\(\)/.test(bridge), 'a real gesture resumes the audio; a locked note shows with a pad')
}

console.log(`pad: ${pass} ok, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL ' + f); process.exit(1) }
