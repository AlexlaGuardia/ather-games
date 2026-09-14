// The hour the cartoon stack reads — derived, bounded, and wired. Run: npx tsx src/app/shimmer/voxel3d/hour-light.test.ts
//
// What it guards: (§1) a clear DAY noon is EXACTLY (1,1,1), because day-night.tsx rules that noon
// must not move and the stack multiplies by this; (§2) the NIGHT palette lands well under noon and
// blue-leaning (the silver), so the blocks and the Lambert canopy finally agree it is night;
// (§3) the cap — mist's hemisphere lift cannot push the toon path above noon; (§4) the GLSL
// actually READS the uniform in both places (divide the shape, multiply the result) and declares
// it, and the dial's zero is byte-for-byte the old stack; (§5) the wiring from the rig to the
// uniform exists in source, since a uniform nobody writes stays (1,1,1) forever and this whole
// module measures as "no change".
import * as THREE from 'three'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HOUR_REF, hourLight, irradianceUp, luminance, sunPosition, SILVER_POSITION } from './hour-light'
import { DAY, NIGHT } from './sky-palette'
import { LIGHT_DECL_GLSL, createLightUniforms } from './light-glsl'
import { cartoonStackGlsl } from './cartoon-glsl'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps

// ── §1 a clear noon is the identity ──────────────────────────────────────────────────────────
const noon = irradianceUp(new THREE.Color(),
  new THREE.Color(DAY.hemiSky), DAY.hemiIntensity,
  new THREE.Color(DAY.sun), DAY.sunIntensity, sunPosition(new THREE.Vector3(), 0.5),
  new THREE.Color(NIGHT.silver), 0, SILVER_POSITION,
  new THREE.Color(0xffffff), DAY.ambient)
const hNoon = hourLight(new THREE.Vector3(), noon)
ok(near(hNoon.x, 1) && near(hNoon.y, 1) && near(hNoon.z, 1), `§1 clear noon → (1,1,1), got ${hNoon.toArray().map(v => v.toFixed(4))}`)
ok(luminance(HOUR_REF) > 2.5 && luminance(HOUR_REF) < 4, `§1 the noon reference is ~3 on an up face (hemi 1.5 + sun 1.5·dir.y + amb 0.4), got ${luminance(HOUR_REF).toFixed(3)}`)
ok(near(sunPosition(new THREE.Vector3(), 0.5).x, 0, 1e-9), '§1 the noon sun sits on the meridian (azimuth 0), so the reference is the highest sun of the day')

// ── §2 midnight is dark and silver ───────────────────────────────────────────────────────────
const mid = irradianceUp(new THREE.Color(),
  new THREE.Color(NIGHT.hemiSky), NIGHT.hemiIntensity,
  new THREE.Color(DAY.sun), 0, sunPosition(new THREE.Vector3(), 0),
  new THREE.Color(NIGHT.silver), NIGHT.silverIntensity, SILVER_POSITION,
  new THREE.Color(0xffffff), NIGHT.ambient)
const hMid = hourLight(new THREE.Vector3(), mid)
const lMid = hMid.dot(new THREE.Vector3(0.2126, 0.7152, 0.0722))
ok(lMid > 0.15 && lMid < 0.45, `§2 midnight luminance is a real night (0.15..0.45 of noon), got ${lMid.toFixed(3)} — the stack read this hour as 85% lit before`)
ok(hMid.z > hMid.x, `§2 midnight leans blue (the silver, not a moon): r ${hMid.x.toFixed(3)} < b ${hMid.z.toFixed(3)}`)
ok(hMid.x > 0.05, '§2 but never black — the palette says "you can\'t see" is a fail state')

// ── §3 the cap ───────────────────────────────────────────────────────────────────────────────
const lifted = noon.clone().multiplyScalar(1.5)
const hLift = hourLight(new THREE.Vector3(), lifted)
ok(near(hLift.dot(new THREE.Vector3(0.2126, 0.7152, 0.0722)), 1, 1e-6), '§3 an over-noon rig (mist lift) caps at luminance 1 — the toon path never exceeds today\'s noon')
ok(near(hLift.x / hLift.z, lifted.r / lifted.b * HOUR_REF.b / HOUR_REF.r, 1e-6), '§3 the cap scales, it does not clip per channel (the tint survives)')

// ── §4 the GLSL reads what it declares, and zero is the old stack ────────────────────────────
ok(LIGHT_DECL_GLSL.includes('uniform vec3  uHourLight;') && LIGHT_DECL_GLSL.includes('uniform float uToonHour;'), '§4 both hour uniforms are declared on the shared light decl')
const g = cartoonStackGlsl('vN', 'vP', 'vec3(0.0)')
ok(!g.includes('`'), '§4 no backtick in the emitted GLSL')
ok(/vec3 hourCol = mix\(vec3\(1\.0\), uHourLight, uToonHour\);/.test(g), '§4 hourCol is the dial mix of (1,1,1) and the rig — dial 0 is the old render')
ok(/clum = clamp\(dot\(outgoingLight, W\) \/ \(albLum \* hourLum\), 0\.0, 1\.0\);/.test(g), '§4 the SHAPE is normalised by the hour luminance (fully lit = as lit as this hour allows)')
ok(g.indexOf('toonCol *= hourCol;') > g.indexOf('vec3 toonCol =') && g.indexOf('toonCol *= hourCol;') < g.indexOf('mix(1.0, 0.62, line * uOutline)'),
  '§4 the RESULT is multiplied by the hour colour after the lift and before the outline — one hour term on the toon path, and the light field still darkens once, after')
ok(g.indexOf('toonCol *= hourCol;') < g.indexOf('shimmerLight('), '§4 …and before lightApply (the sky channel is not an hour term — light-glsl.ts rules it)')
const u = createLightUniforms()
ok(u.uToonHour.value === 0 && u.uHourLight.value.equals(new THREE.Vector3(1, 1, 1)), '§4 fresh uniforms = dial off, hour identity: a bench material renders exactly as before')

// ── §5 the wiring exists ─────────────────────────────────────────────────────────────────────
const here = (f: string) => readFileSync(join(__dirname, f), 'utf8')
const dn = here('day-night.tsx'), vw = here('VoxelWorld.tsx'), st = here('settings.ts')
ok(dn.includes('hourLight(hourLightOut, irradianceUp(') && dn.includes('hemi.color, hemi.intensity') && dn.includes('sun.color, sun.intensity, sun.position'),
  '§5 the rig writes the hour from the LIVE lights (gloom/mist/water already folded in), not from the palette')
ok(dn.includes('sunPosition(sun.position, p)'), '§5 the rig places the sun by the same rule the reference is built from')
ok(vw.includes('hourLightOut={hourLight}') && vw.includes('hourLight={hourLight}') && vw.includes('lightUniforms.uHourLight.value = hourLight'),
  '§5 the outer component owns ONE vector; the rig writes it and the World installs it as the uniform value')
ok(vw.includes('lightUniforms.uToonHour.value = settings.toonHour'), '§5 the dial reaches the uniform from settings')
ok(/toonHour: number/.test(st) && /cartoon: \{[^}]*toonHour: 1/.test(st) && /natural: \{[^}]*toonHour: 0/.test(st), '§5 settings carry the dial; the cartoon preset turns it on, natural (plain Lambert) leaves it off')
ok(vw.includes('<Slider label="night" k="toonHour" />'), '§5 the dial is on the settings panel so Alex can move it on his own GPU')
ok(/const cartoonOnly = s\.style !== 'cartoon'/.test(vw) && /disabled=\{cartoonOnly\}/.test(vw) && vw.includes('Natural is plain light and ignores them'),
  '§5 on natural the cartoon levers are DISABLED and say why — a live slider wired to nothing read as a broken feature (Alex, 09-14)')

console.log(`hour-light: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
