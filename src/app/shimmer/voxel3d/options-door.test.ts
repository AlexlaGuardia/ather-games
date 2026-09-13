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
const once = (src: string, needle: string, n: number, what: string) => {
  const got = src.split(needle).length - 1
  ok(got === n, `${what}: expected ${n}x "${needle}", found ${got}`)
}

// ── the door ─────────────────────────────────────────────────────────────────────────────────
once(host, 'onClick={() => { openCursorUI(); setShowSettings(true) }}', 1, 'the ☰ opens the settings panel through the cursor-UI handoff, once')
{
  const btn = host.indexOf('onClick={() => { openCursorUI(); setShowSettings(true) }}')
  const gate = host.lastIndexOf('{!cursorUIOpen && !showMap && (', btn)
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
  const gate = rawHost.lastIndexOf('{isOwner && (', dev)
  ok(gate > panel && dev - gate < 600, 'the worktable door is inside an `isOwner &&` block of the panel')
  const hub = rawHost.indexOf('href="/shimmer/dev"', gate)
  ok(hub > gate && hub - gate < 900, 'so is the dev hub door')
  // Nothing in the panel reaches /shimmer/dev outside that block — code OR prose.
  const before = rawHost.slice(panel, gate)
  ok(!before.includes('href="/shimmer/dev'), 'no dev route is linked from the panel above the owner block')
  const after = rawHost.slice(hub + 20, rawHost.indexOf('\n}\n', hub))
  ok(!after.includes('href="/shimmer/dev'), 'nor below it')
}
ok(/path\.startsWith\("\/shimmer\/dev"\)/.test(rawProxy), '★ the proxy gates /shimmer/dev — the lock behind the hidden door')

console.log(`options-door: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
