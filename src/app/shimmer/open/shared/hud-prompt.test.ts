// BETA M218: the world prompt never enters the centre box (the middle 30% of the screen, both axes).
//   1. PLACEMENT: promptPlace at the screens we ship to, 1 and 2 lines, short and long text → no overlap with centreBox.
//   2. WIRING: no open-world page draws its own prompt at a centre-band % any more; they hand `prompts` to <GameHud>.
// Run: npx tsx src/app/shimmer/open/shared/hud-prompt.test.ts

import { readFileSync } from 'fs'
import { join } from 'path'
import { promptPlace, promptRect, overlapsCentre, centreBox, PROMPT_DESK_BOTTOM } from './hud-prompt'
import type { HudSize } from '../../ui/hud-flag'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }

// ── 1. placement ──
const screens: [HudSize, number, number][] = [
  ['wide', 1920, 1080], ['wide', 2560, 1440], ['wide', 1440, 900], ['compact', 1366, 768], ['compact', 1280, 720], ['compact', 1024, 640],
  ['phone', 390, 844], ['phone', 360, 780], ['phone', 430, 932], ['phone', 375, 667], ['phone', 844, 390], ['phone', 932, 430], ['phone', 667, 375],
]
for (const [size, vw, vh] of screens) {
  const p = promptPlace(size, vw, vh)
  for (const lines of [1, 2]) for (const w of [120, 260, 600]) {
    const r = promptRect(p, vw, vh, lines, w)
    ok(!overlapsCentre(r, vw, vh), `${size} ${vw}x${vh} ${lines} line(s) w${w}: ${JSON.stringify(r)} clears ${JSON.stringify(centreBox(vw, vh).map(Math.round))}`)
    ok(r.x >= 0 && r.x + r.w <= vw && r.y >= 0 && r.y + r.h <= vh, `${size} ${vw}x${vh} ${lines}/${w}: on screen ${JSON.stringify(r)}`)
  }
}
// desktop: bottom-centre, the free slot; the phone never centres (bottom-centre is the hotbar + the near pills)
ok(promptPlace('wide', 1920, 1080).align === 'center' && promptPlace('wide', 1920, 1080).bottom === PROMPT_DESK_BOTTOM, 'desktop: bottom-centre')
ok(PROMPT_DESK_BOTTOM > 16 + 90, 'desktop: above the continent MPH readout (bottom 16, ~90 tall)')
ok(promptPlace('phone', 390, 844).align === 'left' && promptPlace('phone', 844, 390).align === 'left', 'phone: left edge, both orientations')
// the model itself: a rect dead in the middle overlaps, one in a corner does not (else every assert above is vacuous)
ok(overlapsCentre({ x: 900, y: 500, w: 120, h: 30 }, 1920, 1080), 'model: a centred rect overlaps')
ok(overlapsCentre({ x: 135, y: 489, w: 120, h: 30 }, 390, 844), 'model: the OLD 58% prompt at 390x844 overlaps')
ok(!overlapsCentre({ x: 10, y: 10, w: 120, h: 30 }, 1920, 1080), 'model: a corner rect clears')

// ── 2. wiring ──
const root = join(__dirname, '..')
for (const page of ['ather/page.tsx', 'continent/page.tsx']) {
  const src = readFileSync(join(root, page), 'utf8')
  ok(/\bprompts=\{\[/.test(src), `${page}: hands its prompts to <GameHud>`)
  ok(!/padPrompt\([^)]*\)[^\n]*<\/div>/.test(src), `${page}: no prompt drawn in a page div`)
  const centred = [...src.matchAll(/top: '(\d+)%'/g)].map(m => +m[1]).filter(n => n >= 35 && n <= 65 && n !== 50)
  // 42% = "Click to resume" (pointer released: the game is paused, the centre is the right place), allowed by name only
  const allowed = [...src.matchAll(/top: '42%'[^\n]*Click to resume/g)].length
  ok(centred.length === allowed, `${page}: nothing else pinned in the centre band (${centred.join(',') || 'none'}; resume pills ${allowed})`)
}
const hud = readFileSync(join(__dirname, 'game-hud.tsx'), 'utf8')
ok((hud.match(/<HudPrompts lines=\{prompts\}/g) ?? []).length === 2, 'game-hud: the slot is drawn in both layouts (phone + desktop)')

console.log(`hud-prompt: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
