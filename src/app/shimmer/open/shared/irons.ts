// M178 (Alex 11-25: "a fan of the iron sights minimilistic feel"): EVERY GUN'S BASE SIGHT IS A PAIR OF IRONS. A rear notch (two
// ears either side of a gap) near the eye and a front post near the muzzle, the post tip level with the ears' tops: aiming puts
// that line on the camera's axis, so the post tip sits in the notch at the dead centre of the view. PURE (no three, no react).
// The better sights (holo, prism, scope) are bought later (M178 s2); their code stays, worn by no gun by default.
//
// ★ Canon (world/manalic-weapons.md › Sights, RULED 11-18): a sight is a lens of ground Ather crystal with an etched mark that lights
// when mana runs through the gun. Irons carry no lens; the front post wears a pip of that crystal (the `dot` part, the same etching
// material) so the faint mana light and the firing flare still read. Whether bare irons need Magii's word is flagged in the M178 report.
import type { Part, PartColor } from './gun-kit'

/** how a gun's irons are cut: `clean` (a service gun: thin, square) or `crude` (the Prototype: thick stamped strip) */
export type IronStyle = 'clean' | 'crude'
export const IRON_DIMS = {
  clean: { rearH: 0.016, notch: 0.01, ear: 0.006, depth: 0.008, post: 0.006, notchDrop: 0.006, base: 0.024, c: 'metal' as PartColor, rc: 'dark' as PartColor },
  crude: { rearH: 0.018, notch: 0.011, ear: 0.009, depth: 0.012, post: 0.008, notchDrop: 0.007, base: 0.03, c: 'metal' as PartColor, rc: 'metal' as PartColor },
}
/** how far back from the muzzle tip the front post stands (m) */
export const POST_INSET = 0.03
export interface Irons { parts: Part[]; eye: number; rearZ: number; frontZ: number }

const topOf = (p: Part) => (p.shape === 'cyl' || p.shape === 'tube' ? p.o[1] + p.s[0] / 2 : p.o[1] + p.s[1] / 2)
const lenOf = (p: Part) => p.s[2]
/** the highest top face of the gun's body over z (0 if nothing covers it) */
export function topAt(parts: Part[], z: number): number {
  let t = -Infinity
  for (const p of parts) if ((p.shape ?? 'box') !== 'disc' && Math.abs(z - p.o[2]) <= lenOf(p) / 2 + 1e-9) t = Math.max(t, topOf(p))
  return Number.isFinite(t) ? t : 0
}
/** the muzzle tip: the most forward (-z) face of the body */
export const muzzleZ = (parts: Part[]) => Math.min(...parts.map(p => p.o[2] - lenOf(p) / 2))

/** A gun's irons, built on its own body: the rear notch at `rearZ` on whatever top is there, the front post POST_INSET behind the
 *  muzzle tip on the barrel, its tip at the sight line `eye`. */
export function ironsFor(body: Part[], rearZ: number, style: IronStyle = 'clean'): Irons {
  const d = IRON_DIMS[style], rearBase = topAt(body, rearZ), eye = rearBase + d.rearH
  const frontZ = muzzleZ(body) + POST_INSET, frontBase = topAt(body, frontZ)
  const floor = eye - d.notchDrop, earX = d.notch / 2 + d.ear / 2
  const postH = Math.max(0.004, eye - frontBase)
  const parts: Part[] = [
    // the rear: a base block up to the notch's floor, and an ear either side of the gap, their tops on the sight line
    { o: [0, (rearBase + floor) / 2, rearZ], s: [d.base, floor - rearBase, d.depth], c: d.rc },
    ...[1, -1].map((x): Part => ({ o: [x * earX, (floor + eye) / 2, rearZ], s: [d.ear, eye - floor, d.depth], c: d.rc })),
    // the front: a foot on the barrel, the post up to the sight line, the crystal pip at its tip facing the eye
    { o: [0, frontBase + 0.002, frontZ], s: [d.post * 2.4, 0.004, d.post * 2.4], c: d.c },
    { o: [0, eye - postH / 2, frontZ], s: [d.post, postH, d.post], c: d.c },
    { o: [0, eye - d.post * 0.4, frontZ + d.post / 2 + 0.0004], s: [d.post * 0.7, d.post * 0.7, 0], c: 'dot', shape: 'disc' },
  ]
  return { parts, eye, rearZ, frontZ }
}
