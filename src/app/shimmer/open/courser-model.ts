// THE COURSER BODIES (BETA M35, Alex picked 11-19 on docs/looks/coursers.html): the DARTER is "carriage-born" (option A:
// arched fenders over open spoked wheels, a brass coachwork waist line: the Mana-Carriage in its bones), every OTHER kind is
// "chunky" (option C: big wheels, short bodies, exaggerated stances). Canon kept on every one (world/transportation.md): the
// MANA CORE, the CHANNEL TRIM (a rune-lit line) and the DRIVER'S RUNE are visible, and move with speed. Archetypes only
// (coupe / pickup / off-roader / bike), never a real make. Pure three: no React, so a node test can build every kind.
// Visual only: the physics never reads any of it (ride height, wheel size and length are the look's).
import * as THREE from 'three'

export type CourserKind = 'darter' | 'hauler' | 'scrambler' | 'skitter'
export type CourserStyle = 'carriage' | 'chunky'
/** Alex's pick: the Darter keeps the carriage, every other kind is chunky */
export const STYLE_OF: Record<CourserKind, CourserStyle> = { darter: 'carriage', hauler: 'chunky', scrambler: 'chunky', skitter: 'chunky' }
export interface CourserLook { kind: CourserKind; body: string; cabin: string; len: number; wide: number; tall: number }
export const TRIM = '#d4a843', CORE = '#6be4ff', RUNE = '#f2d27a', BRASS = '#b08a3e'
/** the parts the frame loop moves */
export interface CourserRig { root: THREE.Group; wheels: THREE.Group[]; front: THREE.Group[]; trims: THREE.Mesh[]; core: THREE.Mesh; rune: THREE.Mesh; R: number }

const std = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.2, ...o })
const lit = (c: string) => new THREE.MeshBasicMaterial({ color: c })   // canon's manalic light (trim / core / rune) and lamps: these DO glow

/** a sloped cabin: a trapezoid side profile (front rake, back rake) across the width */
function wedge(w: number, h: number, len: number, front: number, back: number): THREE.BufferGeometry {
  const sh = new THREE.Shape(); sh.moveTo(-len / 2, 0); sh.lineTo(len / 2, 0); sh.lineTo(len / 2 - back, h); sh.lineTo(-len / 2 + front, h); sh.closePath()
  const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false }); g.rotateY(-Math.PI / 2); g.translate(w / 2, 0, 0); g.computeVertexNormals(); return g
}

/** a wheel whose `spin` child turns about x: spoked brass (carriage) or a fat tyre on a pale disc with a rune mark (chunky) */
function wheel(style: CourserStyle, R: number, w: number): THREE.Group {
  const g = new THREE.Group(), spin = new THREE.Group(); spin.name = 'spin'; g.add(spin)
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(R * 0.78, R * (style === 'chunky' ? 0.3 : 0.22), 8, 18), std('#1b1b1f', { roughness: 0.9, metalness: 0 }))
  tyre.rotation.y = Math.PI / 2; tyre.scale.z = w / (R * 0.45); spin.add(tyre)
  if (style === 'carriage') {
    const b = std(BRASS, { metalness: 0.6, roughness: 0.3 })
    for (let k = 0; k < 8; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, R * 1.45, 0.03), b); s.rotation.x = (k / 8) * Math.PI; spin.add(s) }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.18, R * 0.18, w * 0.9, 10), b); hub.rotation.z = Math.PI / 2; spin.add(hub)
  } else {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.6, R * 0.6, w * 0.7, 14), std('#e8e2d4', { metalness: 0.5, roughness: 0.35 })); disc.rotation.z = Math.PI / 2; spin.add(disc)
    spin.add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, R * 0.5, 0.06), lit(RUNE)))   // a rune mark, so the spin reads
  }
  return g
}

/** Build one courser. Front is -z (the walker/physics convention), the group's origin is on the ground under its middle. */
export function buildCourser(look: CourserLook): CourserRig {
  const k = look.kind, style = STYLE_OF[k], chunky = style === 'chunky', bike = k === 'skitter'
  const root = new THREE.Group(), body = new THREE.Group(); body.name = 'body'; root.add(body)
  const bodyM = std(look.body, { metalness: 0.05, roughness: 0.4 }), cabM = std('#' + new THREE.Color(look.cabin).lerp(new THREE.Color(look.body), 0.55).getHexString(), { roughness: 0.25, metalness: 0 }), brass = std(BRASS, { metalness: 0.7, roughness: 0.3 })
  // (cabin: the lot's dark tints went to black holes under the game's sun, so halfway toward the body, still the darker glass. No metalness on paint: with no env map a metal
  //  surface has nothing to reflect and renders near-black, measured on the test track 11-19)
  const big = chunky ? 1.35 : 1
  const R = (k === 'scrambler' ? 0.46 : k === 'hauler' ? 0.42 : 0.36) * big
  const L = ({ darter: 4.3, hauler: 4.6, scrambler: 3.7, skitter: 2.1 } as const)[k] * (chunky ? 0.82 : 1) * look.len
  const W = (bike ? 0.5 : ({ darter: 1.82, hauler: 1.9, scrambler: 1.9 } as const)[k as 'darter']) * look.wide
  const lift = (k === 'scrambler' ? 0.32 : k === 'hauler' ? 0.18 : 0.06) + (chunky ? 0.08 : 0)
  const baseY = R + lift, T = look.tall
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); body.add(me); return me }
  const cabin = (w: number, h: number, len: number, f: number, b: number, m: THREE.Material, y: number, z: number) => { const me = new THREE.Mesh(wedge(w, h, len, f, b), m); me.position.set(0, y, z); body.add(me); return me }
  const trims: THREE.Mesh[] = [], wheels: THREE.Group[] = [], front: THREE.Group[] = []
  const trimM = () => lit(TRIM)
  let core: THREE.Mesh, rune: THREE.Mesh
  if (bike) {
    box(0.42, 0.4, L * 0.62, bodyM, 0, baseY + 0.2, 0.05)                // tank + frame
    box(0.36, 0.14, 0.7, cabM, 0, baseY + 0.46, 0.45)                    // seat
    const fork = box(0.08, 0.8, 0.08, brass, 0, baseY + 0.25, -L * 0.42); fork.rotation.x = -0.35
    box(0.7, 0.05, 0.05, cabM, 0, baseY + 0.7, -L * 0.36)                // bars
    rune = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), lit(RUNE)); rune.position.set(0, baseY + 0.72, -L * 0.34); rune.rotation.x = -1.1; body.add(rune)
    core = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.42), lit(CORE)); core.position.set(0, baseY - 0.02, 0.05); body.add(core)
    for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, L * 0.58), trimM()); t.position.set(s * 0.22, baseY + 0.18, 0.05); body.add(t); trims.push(t) }
    for (const z of [-L * 0.5, L * 0.45]) { const w = wheel(style, R, 0.16 * (chunky ? 1.4 : 1)); w.position.set(0, R, z); root.add(w); wheels.push(w); if (z < 0) front.push(w) }
    return { root, wheels, front, trims, core, rune, R }
  }
  const chH = (k === 'darter' ? 0.42 : 0.55) * T
  box(W, chH, L, bodyM, 0, baseY + chH / 2, 0)
  if (k === 'hauler') {
    cabin(W * 0.92, 0.75 * T, L * 0.34, 0.32, 0.04, cabM, baseY + chH, -L * 0.2)
    box(W * 0.94, 0.28, L * 0.42, cabM, 0, baseY + chH + 0.1, L * 0.26)                                  // the open bed's walls
    box(W * 0.8, 0.04, L * 0.38, std('#3a2a1a', { roughness: 0.9 }), 0, baseY + chH + 0.02, L * 0.26)
  } else if (k === 'scrambler') {
    cabin(W * 0.9, 0.7 * T, L * 0.55, 0.28, 0.06, cabM, baseY + chH, 0)
    box(W * 0.95, 0.06, L * 0.5, brass, 0, baseY + chH + 0.72 * T, 0)                                     // roof rack
    const spare = wheel(style, R * 0.9, 0.22); spare.rotation.y = Math.PI / 2; spare.position.set(0, baseY + chH * 0.6, L / 2 + 0.12); body.add(spare)
  } else {
    cabin(W * 0.82, 0.44 * T, L * 0.5, 0.62, 0.5, cabM, baseY + chH, L * 0.06)                          // a coupe's raked glasshouse
  }
  rune = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), lit(RUNE))
  rune.position.set(-W * 0.22, baseY + chH + 0.22, k === 'darter' ? -L * 0.04 : -L * 0.12); rune.rotation.x = -0.9; body.add(rune)
  core = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.32), lit(CORE))
  core.position.set(0, baseY + chH + (k === 'hauler' ? 0.15 : 0.02), k === 'hauler' ? L * 0.38 : L * 0.42); body.add(core)
  for (const s of [-1, 1]) for (let i = 0; i < 10; i++) {   // the channel trim, in segments so light can run along it
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, L * 0.085), trimM())
    t.position.set(s * (W / 2 + 0.01), baseY + chH * (chunky ? 0.5 : 0.75), -L * 0.45 + (i + 0.5) * L * 0.09); body.add(t); trims.push(t)
  }
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.03), lit('#fff1c4')); h.position.set(s * W * 0.32, baseY + chH * 0.6, -L / 2 - 0.02); body.add(h)
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.03), lit('#ff3a2a')); tl.position.set(s * W * 0.34, baseY + chH * 0.6, L / 2 + 0.02); body.add(tl)
  }
  const wx = W / 2 - (chunky ? 0.12 : -0.06), wz = L * 0.33
  for (const [x, z] of [[-wx, -wz], [wx, -wz], [-wx, wz], [wx, wz]]) {
    const w = wheel(style, R, chunky ? 0.38 : 0.26); w.position.set(x, R, z); root.add(w); wheels.push(w); if (z < 0) front.push(w)
    if (!chunky) { const f = new THREE.Mesh(new THREE.TorusGeometry(R * 1.12, 0.06, 6, 14, Math.PI), bodyM); f.position.set(x, R, z); f.rotation.y = Math.PI / 2; body.add(f) }   // arched fenders
    else { const f = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, R * 2.3), bodyM); f.position.set(x > 0 ? x - 0.05 : x + 0.05, R * 2 + 0.02, z); body.add(f) }   // fat flares
  }
  if (!chunky) box(W + 0.02, 0.05, L * 0.98, brass, 0, baseY + chH * 0.92, 0)   // the coachwork waist line
  return { root, wheels, front, trims, core, rune, R }
}

/** one frame of motion: wheels roll by `angle` (rad, the physics' userData.wheelAngle at THIS model's radius), the fronts
 *  steer, light runs along the trim faster with `mph`, the core brightens as it is pushed, the driver's rune turns */
export function animateCourser(rig: CourserRig, angle: number, steer: number, mph: number, t: number, dt: number): void {
  for (const w of rig.wheels) { const s = w.getObjectByName('spin'); if (s) s.rotation.x = -angle }
  for (const w of rig.front) w.rotation.y = -steer
  const run = t * (0.6 + Math.abs(mph) / 15)
  rig.trims.forEach((m, i) => { const k = (Math.sin(run * 3 - (i % 10) * 0.9) + 1) / 2; (m.material as THREE.MeshBasicMaterial).color.setRGB(0.55 + k * 0.45, 0.42 + k * 0.4, 0.15 + k * 0.25) })
  const c = 0.55 + Math.min(1, Math.abs(mph) / 100) * 0.45; (rig.core.material as THREE.MeshBasicMaterial).color.setRGB(0.42 * c, 0.89 * c, c)
  rig.rune.rotation.z += dt * (0.5 + Math.abs(mph) / 25)
}
