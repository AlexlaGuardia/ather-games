// M186: the controller in the open world. padStep turns one gamepad sample into the keys / touch-store writes the open
// world already understands, through voxel3d's bindings. Run: npx tsx src/app/shimmer/open/shared/pad.test.ts
import { readFileSync } from 'node:fs'
import type { PadButton } from '@/lib/input/actions'
import { merge } from '@/lib/input/bindings'
import type { PadSample } from '@/lib/input/gamepad'
import { newPadState, padStep, releaseAll, padActed, padPrompt, padBind, padReset, PAD_ROW_IDS, OPEN_CODE, PAD_LOOK_RAD_S, type PadEffect } from './pad'
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

// 12. M189 rebinding: jump A -> B swaps Close onto A; the world then jumps on B, not A; a menu still closes on B, picks on A
{
  const r = padBind(map, 'move.jump', 'B')!
  ok(!!r && r.swapped === 'ui.close', 'jump onto B swaps with close')
  ok(JSON.stringify(r.map['move.jump'].pad) === '["B"]' && JSON.stringify(r.map['ui.close'].pad) === '["A"]', 'jump on B, close on A')
  ok(JSON.stringify(r.map['move.jump'].keys) === JSON.stringify(map['move.jump'].keys), 'the keyboard keys are untouched')
  const s = newPadState(), p = pad()
  let fx = padStep(s, p(['B']), r.map, false, 1 / 60)
  ok(has(fx, { t: 'keydown', code: 'Space' }) && !fx.some(f => 'code' in f && f.code === 'Escape'), 'world: B jumps, does not close')
  padStep(s, p([]), r.map, false, 1 / 60)
  fx = padStep(s, p(['A']), r.map, false, 1 / 60)
  ok(!has(fx, { t: 'keydown', code: 'Space' }) && has(fx, { t: 'keydown', code: 'Escape' }), 'world: A no longer jumps (it is close now)')
  const m = newPadState(), q = pad()
  fx = padStep(m, q(['A']), r.map, true, 1 / 60)
  ok(has(fx, { t: 'accept' }) && !fx.some(f => f.t === 'tap' && f.code === 'Escape'), 'menu: A still picks (close moved onto A waits)')
  padStep(m, q([]), r.map, true, 1 / 60)
  fx = padStep(m, q(['B']), r.map, true, 1 / 60)
  ok(fx.filter(f => f.t === 'tap' && f.code === 'Escape').length === 1, 'menu: B still closes, once')
}
// 13. M189: the hotbar sides are refused; the signature's chord swaps over; reset gives the defaults back, keys kept
{
  ok(padBind(map, 'move.jump', 'DLEFT') === null && padBind(map, 'move.jump', 'DRIGHT') === null, 'd-pad sides stay on the hotbar')
  ok(padBind(map, 'item.drop', 'A') === null, 'an action the open world does not list is refused')
  const r = padBind(map, 'cast.signature', 'R3')!
  ok(JSON.stringify(r.map['cast.signature'].pad) === '["R3"]' && (r.map['cast.signature'].padChord ?? []).length === 0, 'signature onto R3: one button, no chord')
  const t = padBind(r.map, 'cast.signature', 'A')!
  ok(t.swapped === 'move.jump' && JSON.stringify(t.map['move.jump'].pad) === '["R3"]', 'a second move swaps jump onto R3')
  const u = padBind(map, 'cast.signature', 'X')!
  ok(u.swapped === 'world.interact' && JSON.stringify(u.map['world.interact'].padChord) === '["RB","LB"]', 'a chord-only action hands its chord to the one it displaced')
  const keyed = { ...t.map, 'move.jump': { ...t.map['move.jump'], keys: ['KeyK'] } }
  const z = padReset(keyed)
  ok(PAD_ROW_IDS.every(id => JSON.stringify(z[id].pad) === JSON.stringify(map[id].pad) && JSON.stringify(z[id].padChord ?? []) === JSON.stringify(map[id].padChord ?? [])), 'reset: every pad button back to default')
  ok(JSON.stringify(z['move.jump'].keys) === '["KeyK"]', 'reset keeps the keyboard keys')
  const bridge = readFileSync('src/app/shimmer/open/shared/pad-bridge.tsx', 'utf8'), opts = readFileSync('src/app/shimmer/open/options.tsx', 'utf8')
  ok(/if \(capture\) \{[\s\S]{0,320}return\n/.test(bridge) && /ver !== mapVer/.test(bridge), 'the bridge hands a press to a rebind and re-reads a saved map')
  ok(/<PadBindings \/>/.test(opts) && /padCapture\(/.test(opts) && /padReset\(/.test(opts), 'Options lists the controller and rebinds through the bridge')
}

// M232: hands out = R2 punches, an item in hand = L2 uses it, a lit hotbar slot = □ holds it, the stick moves a menu pointer
{
  const hands = { handsOut: true, holding: false, browsing: false }
  let s = newPadState(), p = pad()
  let fx = padStep(s, p(['RT']), map, false, 1 / 60, hands)
  ok(has(fx, { t: 'tap', code: 'Melee' }) && !fx.some(f => f.t === 'fire'), 'hands out: RT taps Melee (a punch), never fires')
  fx = padStep(s, p(['RT']), map, false, 1 / 60, hands)
  ok(!fx.some(f => f.t === 'tap'), 'hands out: RT held punches once (the press, not every frame)')
  s = newPadState(); p = pad()
  fx = padStep(s, p(['RT']), map, false, 1 / 60)
  ok(has(fx, { t: 'fire', on: true }) && !fx.some(f => f.t === 'tap'), 'a gun out: RT still fires')
  // rebinding fire moves the punch with it (M189 list)
  const moved = padBind(map, 'world.mine', 'R3')!.map
  s = newPadState(); p = pad()
  ok(has(padStep(s, p(['R3']), moved, false, 0, hands), { t: 'tap', code: 'Melee' }), 'the punch follows fire onto a rebound button')
  // L2 with an item in hand: E on the press, no sights
  const item = { handsOut: false, holding: true, browsing: false }
  s = newPadState(); p = pad()
  fx = padStep(s, p(['LT']), map, false, 0, item)
  ok(has(fx, { t: 'tap', code: 'KeyE' }) && !fx.some(f => f.t === 'aim' && f.on), 'item in hand: LT taps E (use / place), no sights')
  s = newPadState(); p = pad()
  ok(has(padStep(s, p(['LT']), map, false, 0), { t: 'aim', on: true }), 'no item: LT is still the sights')
  // □ (X, the use button) holds a lit slot instead of using
  const browse = { handsOut: true, holding: false, browsing: true }
  s = newPadState(); p = pad()
  fx = padStep(s, p(['X']), map, false, 0, browse)
  ok(has(fx, { t: 'hold' }) && !fx.some(f => f.t === 'keydown' && f.code === 'KeyE'), 'a lit slot: □ holds it, no E')
  s = newPadState(); p = pad()
  ok(has(padStep(s, p(['X']), map, false, 0, hands), { t: 'keydown', code: 'KeyE' }), 'no lit slot: □ is use (E) as before')
  s = newPadState(); p = pad()
  ok(has(padStep(s, p(['DRIGHT']), map, false, 0, hands), { t: 'hotbar', dir: 1 }) && has(padStep(newPadState(), pad()(['DLEFT']), map, false, 0, hands), { t: 'hotbar', dir: -1 }), 'd-pad right / left step the hotbar')
  // the menu pointer: stick → cursor px; d-pad + A unchanged
  s = newPadState(); p = pad()
  fx = padStep(s, p([], { lx: 1, ly: 0 }), map, true, 0.1)
  const c = fx.find(f => f.t === 'cursor') as { dx: number; dy: number } | undefined
  ok(!!c && Math.abs(c.dx - 90) < 1e-6 && c.dy === 0, 'menu: full stick right moves the pointer 900 px/s')
  ok(!padStep(newPadState(), pad()([], { lx: 1 }), map, true, 0.1).some(f => f.t === 'move'), 'menu: the stick never walks')
  s = newPadState(); p = pad()
  ok(has(padStep(s, p(['DLEFT']), map, true, 0), { t: 'nav', dir: 'left' }) && has(padStep(newPadState(), pad()(['A']), map, true, 0), { t: 'accept' }), 'menu: d-pad still hops the ring, A still accepts')
  const bridge = readFileSync('src/app/shimmer/open/shared/pad-bridge.tsx', 'utf8'), hud = readFileSync('src/app/shimmer/open/shared/game-hud.tsx', 'utf8')
  ok(/if \(cur\.on\) clickCursor\(\); else ringed\(\)\?\.click\(\)/.test(bridge), 'A clicks under the pointer once it moved, else the ringed button')
  ok(/addEventListener\('pad:hold', padHold\)/.test(hud) && /setPadBrowsing\(cursor !== null\)/.test(hud), 'GameHud: the d-pad browses, pad:hold equips, the bridge knows a slot is lit')
}

console.log(`pad: ${pass} ok, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL ' + f); process.exit(1) }
