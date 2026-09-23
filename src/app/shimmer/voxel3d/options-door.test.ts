// options-door — the ☰ under the minimap and the owner-only Dev rows (2026-09-13).
//
// What is worth holding: that the ☰ opens the SAME panel `O` does (one options surface); that it
// shows on exactly the minimap's rule; and — the one that matters — that the Dev rows are gated
// on `isOwner` AND the routes they point at are gated in the proxy. The first gate hides a door;
// only the second is a lock. Lose the first and players see a door that refuses them; lose the
// second and the door opens for everyone, with this guard the only thing that goes red.

import { readFileSync } from 'node:fs'
import { codeOnly } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
// ⚠ `codeOnly` strips STRING BODIES too, so hrefs and route literals are asked of the RAW file;
// structure (gates, order) is asked of the stripped one, where prose cannot satisfy a needle.
const rawHost = readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8')
const host = codeOnly(rawHost)
const rawProxy = readFileSync(new URL('../../../proxy.ts', import.meta.url), 'utf8')
// ★ 2026-09-16 (HUD port): the FRAME — tab row, Dev-tab gate — moved to `hud/options-panel.tsx`,
// shared with play3d; the voxel levers and the Dev ROWS stay here, handed in as slots. So the
// gate is asked of the frame and the rows are asked of the host's `dev={…}` slot.
const rawFrame = readFileSync(new URL('../hud/options-panel.tsx', import.meta.url), 'utf8')
const once = (src: string, needle: string, n: number, what: string) => {
  const got = src.split(needle).length - 1
  ok(got === n, `${what}: expected ${n}x "${needle}", found ${got}`)
}

// ── the door ─────────────────────────────────────────────────────────────────────────────────
// `top` since 2026-09-23 (Phase 9): the door hangs under the minimap at the HUD layer's size.
const DOOR = '<OptionsDoor face={HUD_FACE} top={hudDoorTop(hudSize)} onOpen={() => { openCursorUI(); setShowSettings(true) }} />'
once(host, DOOR, 1, 'the ☰ opens the settings panel through the cursor-UI handoff, once')
{
  const btn = host.indexOf(DOOR)
  const gate = host.lastIndexOf('{!cursorUIOpen && !showMap && <OptionsDoor', btn)
  ok(btn > 0 && gate > 0 && btn - gate < 400, 'the ☰ is rendered on the minimap\'s own rule (no cursor surface, map not expanded)')
  const mini = host.indexOf('<VoxelMiniMap ')
  ok(mini > 0 && btn > mini, 'and it sits after the minimap in the tree, under it on screen')
}
ok(/toggleSettings: \(\) => \{\s*if \(showSettings\) \{ setShowSettings\(false\); closeCursorUI\(\) \}\s*else \{ openCursorUI\(\); setShowSettings\(true\) \}/.test(host),
   'the O key still opens the same panel the same way — one surface, two doors')

// ── the gate ─────────────────────────────────────────────────────────────────────────────────
once(host, '<SettingsPanel s={settings} update={update} isOwner={isOwner}', 1, 'the panel is handed the live owner flag')
{
  const panel = rawHost.indexOf('function SettingsPanel(')
  const dev = rawHost.indexOf('href="/shimmer/dev/worktable"', panel)
  ok(dev > panel, 'the worktable door exists, in the panel')
  const slot = rawHost.lastIndexOf('dev={', dev)
  ok(slot > panel && dev - slot < 600, 'the worktable door is inside the `dev={…}` slot the host hands the frame')
  // The FRAME renders that slot only behind the owner gate, and the tab BUTTON is gated too, or a
  // player sees a "Dev" tab that opens onto nothing.
  ok(rawFrame.includes("{isOwner && tab === 'dev' && dev}"), 'the frame renders the dev slot only for the owner')
  ok(rawFrame.includes("if (isOwner) tabs.push(['dev', 'Dev'])"), 'the Dev tab button itself is owner-only')
  ok(!/\['dev', 'Dev'\]\]/.test(rawFrame), 'and it is never in the default tab list')
  const hub = rawHost.indexOf('href="/shimmer/dev"', slot)
  ok(hub > slot && hub - slot < 900, 'so is the dev hub door')
  // Nothing in the panel reaches /shimmer/dev outside that slot — code OR prose.
  const before = rawHost.slice(panel, slot)
  ok(!before.includes('href="/shimmer/dev'), 'no dev route is linked from the panel above the owner slot')
  ok(!rawFrame.includes('/shimmer/dev'), 'and the frame itself links no dev route')
}
ok(/path\.startsWith\("\/shimmer\/dev"\)/.test(rawProxy), '★ the proxy gates /shimmer/dev — the lock behind the hidden door')

console.log(`options-door: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
