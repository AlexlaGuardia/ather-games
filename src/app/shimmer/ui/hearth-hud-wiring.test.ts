/**
 * Both dimensions wear the hearth HUD, and keep wearing it.
 * Run: `npx tsx src/app/shimmer/ui/hearth-hud-wiring.test.ts`
 *
 * ★ WHY (2026-09-23, Carved Hearth Phase 9). The keeper's HUD is one object in both worlds (the
 * `hud/clock.tsx` rule). The Ather and the mortal side each mount `HearthHudLayer`, which is the
 * arrangement Alex approved on /shimmer/dev/hud-kit. This guard catches the quiet way that breaks:
 * one host re-importing a retired piece (`<Hotbar`, `<HudCorner` …) beside the layer, so two bars
 * are drawn, or the face drifting per host.
 * ⚠ And the touch controls. They stood at a fixed `bottom: 96`, which the taller hearth bar covers.
 * They stand on `HUD_BAR_CLEAR` now, and a fixed number coming back is asserted against.
 */
import { readFileSync } from 'node:fs'

let fails = 0
const ok = (c: boolean, m: string) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const HOSTS = { ather: read('../voxel3d/VoxelWorld.tsx'), mortal: read('../play3d/Shimmer3D.tsx') }
const RETIRED = ['<Hotbar ', '<HudCorner ', '<ObjectiveChip ', '<Clock ', '<ResourceBars vitals', '<BuffChips ']

for (const [name, src] of Object.entries(HOSTS)) {
  ok(src.split('<HearthHudLayer ').length - 1 === 1, `${name}: mounts HearthHudLayer exactly once`)
  ok(/<HearthHudLayer face=\{HUD_FACE\}/.test(src) && src.includes("const HUD_FACE: HudFace = 'full'"), `${name}: at Alex's face, from one HUD_FACE constant`)
  ok(/<OptionsDoor face=\{HUD_FACE\} top=\{hudDoorTop\(hudSize\)\}/.test(src), `${name}: the ☰ is the carved knob, hung at the layer's size`)
  ok(src.includes('box={hudMapBox(hudSize)}'), `${name}: the minimap takes its box from the layer`)
  for (const r of RETIRED) ok(!src.includes(r), `${name}: never mounts the retired ${r.trim()}`)
}
// The mortal side takes the LOOK, not new readouts: no always-on vitals or buffs through the layer.
const mortalTag = HOSTS.mortal.slice(HOSTS.mortal.indexOf('<HearthHudLayer '), HOSTS.mortal.indexOf('mapFrame={false} />'))
ok(mortalTag.length > 0 && !/\bvitals=/.test(mortalTag) && !/\bbuffs=/.test(mortalTag), 'mortal: the layer gets no vitals and no buffs (its combat bars + buff column stay its own)')
// Touch controls stand on the bar's clearance, never a fixed number.
// Bounded to the touch block itself — from the joystick to the fragment that closes the controls.
const tAt = HOSTS.mortal.indexOf('<TouchJoystick joyRef=')
const touch = tAt < 0 ? '' : HOSTS.mortal.slice(tAt, HOSTS.mortal.indexOf('</>', HOSTS.mortal.indexOf('right: 118', tAt)))
ok(touch.includes('bottom={HUD_BAR_CLEAR[hudSize] + 8}'), 'mortal: the joystick stands on HUD_BAR_CLEAR')
ok(touch.split('bottom: HUD_BAR_CLEAR[hudSize] + 8').length - 1 === 2, 'mortal: both button columns stand on it too')
ok(!/bottom: 96\b|bottom=\{96\}/.test(touch), 'mortal: and no fixed 96 came back')

console.log(fails ? `\nhearth-hud-wiring: ${fails} FAILED` : '\nhearth-hud-wiring: CLEAN')
process.exit(fails ? 1 : 0)
