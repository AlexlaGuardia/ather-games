// THE TEMPLATE'S GUARD (Alex 11-15: "establish a ui template so we dont have to keep redoing all of this"). Two halves:
//   1. WIRING: every open-world page mounts <GameHud> and places NO HUD piece itself. A page that imports a hearth HUD
//      piece, the mana gauge or the hotbar directly is forking the template, and this fails.
//   2. THE MESSAGE LINE (hud-say.ts): item lines replace, repeats refresh, lines expire, the list is capped.
// Run: npx tsx src/app/shimmer/open/shared/game-hud.test.ts
// ⚠ Reads page SOURCE as text (next/font cannot load under node, so the pages cannot be imported).

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { hudSay, linesAt, _resetSay, MAX_LINES, TTL } from './hud-say'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. wiring ────────────────────────────────────────────────────────────────────────────────────────────────
const OPEN = new URL('..', import.meta.url).pathname
const pages: string[] = []
const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f === 'page.tsx') pages.push(p) } }
walk(OPEN)
/** Pages that are not part of the game's open world (test benches, retired prototypes). Each says why. */
const EXEMPT: Record<string, string> = {
  'open/page.tsx': 'the P0 hillside redirect shell (/shimmer/open 307s to the Ather)',
  'open/hillside/page.tsx': 'the retired P0 hillside, kept reachable for reference, not a place the game sends you',
  'open/drive/page.tsx': 'the Darter handling bench (OPEN_WORLD_PLAN P5 test track), not a place the game sends you',
}
const FORBIDDEN = [
  /from ['"][./]*ui\/hearth-hud(-layer)?['"]/,    // place pieces via the template, never directly
  /from ['"][./]*hud\/mana-gauge['"]/,
  /from ['"][./]*hud\/hotbar['"](?!.*type)/,      // a type import for entries is fine; the component is not
  /\bHearthCompass\b|\bHearthHotbar\b|\bHearthVitals\b|\bHearthHudLayer\b|\bManaGauge\b/,
]
/** whole folders of benches: every page under one is a dev preview (a scene on a bare canvas, no keeper, no HUD by design) */
const EXEMPT_DIRS: Record<string, string> = {
  'open/preview/': 'dev previews (crystals, companions, shop-door, business, fallen-cap...): a look at one model or scene on a bare Canvas, not a place the game sends you',
}
const exempt = (rel: string) => !!EXEMPT[rel] || Object.keys(EXEMPT_DIRS).some(d => rel.startsWith(d))
const game = pages.filter(p => !exempt(p.slice(p.indexOf('open/'))))
ok(game.length >= 2, `wiring: found ${game.length} open-world pages (want the Ather + the continent at least)`)
for (const p of game) {
  const src = readFileSync(p, 'utf8'), rel = p.slice(p.indexOf('open/'))
  ok(/<GameHud\b/.test(src) && /from ['"]\.\.\/shared\/game-hud['"]|from ['"]\.\/shared\/game-hud['"]/.test(src), `wiring: ${rel} does not mount the GameHud template`)
  for (const re of FORBIDDEN) ok(!re.test(src.replace(/^\s*\/\/.*$/gm, '').replace(/^import type \{[^}]*\} from ['"][^'"]+['"];?[ \t]*$/gm, '')),   // a type-only import draws nothing
    `wiring: ${rel} places a HUD piece itself (${re}) — put it in game-hud.tsx`)
}
// the exemptions must still exist (an exemption for a deleted file is a dead rule that reads as a live one)
for (const k of Object.keys(EXEMPT)) ok(pages.some(p => p.endsWith(k)), `wiring: exemption ${k} names a page that no longer exists — drop it`)
for (const d of Object.keys(EXEMPT_DIRS)) ok(pages.some(p => p.includes(d)), `wiring: folder exemption ${d} holds no page any more — drop it`)
// the template itself carries the three things Alex asked for by name
{
  const t = readFileSync(join(OPEN, 'shared/game-hud.tsx'), 'utf8')
  ok(/anchor="top-left"/.test(t), 'template: the hotbar is not anchored top-left')
  ok(/<Corner\b/.test(t) && /readouts=\{readouts\}/.test(t), 'template: the tools no longer fan round the mana orb')
  ok(/<Messages\b/.test(t), 'template: no message line under the bar')
}

// ── 1b. menus: every open-world menu wears the Carved Hearth frame (the red close), Alex 11-15 ─────────────────────
// "the menu look as well with a red close button as all menus should have". A new menu goes in this list.
const MENUS: Record<string, string> = {
  'ather/panels.tsx': 'FoldMap + GregPanel', 'shared/bag.tsx': 'BagMenu', 'garage.tsx': 'GaragePanel',
  'trade-ui.tsx': 'BoardPanel', 'continent/map.tsx': 'ContinentMap', 'pack.tsx': 'PackMenu (journal / bag / character)', 'vessel-shop.tsx': 'VesselShop', '../hud/options-panel.tsx': 'OptionsPanel (open/options.tsx composes it)',
}
for (const [f, what] of Object.entries(MENUS)) {
  const src = readFileSync(join(OPEN, f), 'utf8').replace(/^\s*\/\/.*$/gm, '')
  ok(/<HearthFrame\b/.test(src), `menus: ${f} (${what}) is not in the hearth frame`)
  ok(!/>\s*(Close|[A-Z]\s*·\s*close|Esc closes)\s*</.test(src), `menus: ${f} (${what}) draws its own text close button: the frame's red X is the close`)
}
{
  const h = readFileSync(join(OPEN, '../ui/hearth.tsx'), 'utf8')
  ok(/const KNOB = [^\n]*#e0604f/.test(h), 'menus: the hearth close knob is no longer red')
}

// ── 2. the message line ──────────────────────────────────────────────────────────────────────────────────────
_resetSay()
hudSay('Repeater', 'item', undefined, 0); hudSay('Waymark', 'item', undefined, 0.2)
ok(linesAt(0.3).filter(l => l.kind === 'item').map(l => l.text).join() === 'Waymark', 'say: scrolling the bar stacked item names')
hudSay('Ground opened', 'info', undefined, 0.3); hudSay('Ground opened', 'info', undefined, 0.5)
ok(linesAt(0.6).filter(l => l.text === 'Ground opened').length === 1, 'say: the same toast twice stacked instead of refreshing')
ok(linesAt(0.5 + TTL.info + 0.01).every(l => l.text !== 'Ground opened'), 'say: a toast never expired')
_resetSay()
for (let k = 0; k < 9; k++) hudSay(`line ${k}`, 'info', undefined, k * 0.01)
ok(linesAt(0.1).length === MAX_LINES && linesAt(0.1).at(-1)!.text === 'line 8', 'say: the list is not capped newest-last')
hudSay('', 'info'); ok(linesAt(0.1).length === MAX_LINES, 'say: an empty line was said')

if (fails.length) { console.error(`game-hud: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`game-hud: ${pass}/0`)
