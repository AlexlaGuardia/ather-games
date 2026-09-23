// core-sky — the Ather's sky as canon ruled it (`world/ather.md` › *The sky, looked at*, 2026-09-23).
// Each assert is one clause of the ruling, so a red line names the canon it broke.
// Run: npx tsx src/app/shimmer/voxel3d/core-sky.test.ts
import * as THREE from 'three'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CORE_POSITION, CORE_DIR, CORE_RADIUS, coreBank, BREATH, TURN_S } from './core-sky'
import { sunPosition } from './hour-light'
import { SKY } from './sky-palette'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const atHour = (h: number) => h / 24
const hex = (s: string) => new THREE.Color().setStyle(s, THREE.LinearSRGBColorSpace)

// ── §1 the Core never crosses the sky and never sets ────────────────────────────────────────
const noon = sunPosition(new THREE.Vector3(), atHour(12))
for (const h of [0, 3, 6, 9, 15, 18, 21]) {
  ok(sunPosition(new THREE.Vector3(), atHour(h)).equals(noon), `§1 the key light is where the Core is at ${h}:00 too — it does not travel`)
}
ok(noon.equals(new THREE.Vector3(0, 270, 90)), '§1 it hangs at the old NOON sun, so a clear noon (the hour reference) did not move')
ok(CORE_DIR.y > 0.8, `§1 the Core is overhead (dir.y ${CORE_DIR.y.toFixed(3)} > 0.8), never down toward the Silt`)
ok(CORE_DIR.y < 0.99, '§1 …but not the zenith, or every side face of a block lights the same and the voxels go flat')
ok(CORE_RADIUS > 0.02 && CORE_RADIUS < 0.12, '§1 the disc reads as a body, not a star and not a ceiling')

// ── §2/§5 it banks like a coal, one journey run both ways ───────────────────────────────────
ok(Math.abs(coreBank(atHour(12)) - 1) < 1e-9, '§2 noon is the blaze (bank 1)')
ok(coreBank(atHour(0)) < 1e-9, '§2 midnight is the coal (bank 0)')
for (const x of [0.5, 1, 1.5, 2]) {
  ok(Math.abs(coreBank(atHour(6 - x)) - coreBank(atHour(18 + x))) < 1e-9 &&
     Math.abs(coreBank(atHour(6 + x)) - coreBank(atHour(18 - x))) < 1e-9,
    `§5 dawn and dusk are the SAME curve run both ways (±${x}h)`)
}

// ── §2 never pale, never silver: every stop on the Core's ramp is warm ─────────────────────
for (const [k, v] of Object.entries(SKY.core)) {
  const c = hex(v)
  ok(c.r > c.b, `§2 core.${k} ${v} is warm (r > b) — a cool Core reads as a moon`)
}
ok(hex(SKY.core.coal).r < 0.2, '§2 the night body is a DARK coal')
ok(hex(SKY.fleck).r >= hex(SKY.fleck).b, '§4 the flecks are warm-white breath, never a star-blue')

// ── §2 never flickers: the only motion is a slow even breath and the turn ─────────────────
ok(BREATH.periodS >= 6 && BREATH.depth <= 0.1, `§2 the breath is slow and shallow (${BREATH.periodS}s, ±${BREATH.depth})`)
ok(TURN_S >= 120, '§2 the turn is something you notice only by standing still')

// ── the dome carries the ruling, not just the numbers ──────────────────────────────────────
const dn = readFileSync(join(__dirname, 'day-night.tsx'), 'utf8')
const fragBody = dn.slice(dn.indexOf('const SKY_FRAG'))
const glsl = fragBody.slice(0, fragBody.indexOf('\n`\n'))
ok(glsl.includes('void main()'), 'the dome shader is still readable here — a guard that cannot find its subject is not green')
ok(!/sunAzimuth|sunElevation/.test(dn), '§1 the rig no longer asks the Earth sun path anything')
ok(/mix\(coal, lit, smoothstep\([^)]*uBank\)\)/.test(glsl), '§2 the WHOLE body banks at once: the disc is one mix by the hour, never a boundary across it')
ok(!/uniform float uTime|uTime/.test(glsl), '§2 the shader has no clock of its own — breath and turn arrive as two CPU-smooth uniforms, so nothing can flicker per pixel')
ok(!/moon|aurora|star\b/i.test(glsl), '§6 nothing else is in the sky — no moon, no aurora, no stars')
ok(/uKindle \* pow\(1\.0 - up, [0-9.]+\) \* night/.test(glsl), '§5 the hand-off: the rim kindles exactly as the Core banks (the same night term)')
ok(/uFleck \* fleck \* pow\(night/.test(glsl), '§4 the flecks are faded by the hour, not switched: there by day, drowned')

console.log(`core-sky: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
