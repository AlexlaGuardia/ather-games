// BLUE, Gregory's old Dewbear (BETA M166; CANON characters/gregory.md › Companion: "an old Dewbear, soft dew-blue"). Alex
// LOCKED his COLOUR and the WARM LIGHT IN HIS SEAMS (11-25); his body is the Dewbear's (docs/looks/dewbear-2026-11-24 v2),
// unchanged. Pure: one tone in, Blue's tone out, in the glb's own authored sRGB 0..1. Only Blue is drawn through this: the
// glb and every other Dewbear keep their colours.
export const BLUE_COLOR = { deep: '#70d6e2', light: '#a2f4ee', belly: '#e4eedb', seam: '#fff6e4', seamMid: '#f6e2c2', seamEdge: '#e6c9a2', blush: '#e8bfc2' } as const
export const BLUE_HULL = { color: '#eafcff', opacity: 0.32 }
export const BLUE_SKIN = { emissive: '#8fe0e0', emissiveI: 0.16 }
/** the spirits' toon steps (spirit-model.tsx gradTex) */
export const SPIRIT_RAMP = [110, 185, 255] as const
export type Rgb = [number, number, number]
export const hexRgb = (h: string): Rgb => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map(k => a[k] + (b[k] - a[k]) * t) as Rgb
const near = (c: Rgb, h: string, d = 0.05) => { const q = hexRgb(h); return Math.abs(c[0] - q[0]) + Math.abs(c[1] - q[1]) + Math.abs(c[2] - q[2]) < d }
// the Dewbear's own tones (tools/sculpt.py): the plates run #6fafc2 .. #a9dbe1; its seams are ink #1d5a77 into gold #ffd371
const LO = (0x6f + 0xaf + 0xc2) / 765, HI = (0xa9 + 0xdb + 0xe1) / 765
export const DEWBEAR_SEAM = { ink: '#1d5a77', mid: '#568274', gold: '#ffd371' } as const
/** Blue's tone for one of the Dewbear's. `part`: 'body' (lit) or 'eyes' (the unlit lines: eyes, lids, beads, seams). */
export function blueTone(part: 'body' | 'eyes', r: number, g: number, b: number): Rgb {
  const c: Rgb = [r, g, b], hi = Math.max(r, g, b), lo = Math.min(r, g, b)
  if (part === 'eyes') {   // the seams: warm light, pale at the core (the pictures have no ink in them)
    if (near(c, DEWBEAR_SEAM.gold)) return hexRgb(BLUE_COLOR.seam)
    if (near(c, DEWBEAR_SEAM.mid)) return hexRgb(BLUE_COLOR.seamMid)
    if (near(c, DEWBEAR_SEAM.ink)) return hexRgb(BLUE_COLOR.seamEdge)
  }
  if (lo > 0.88) return part === 'body' ? hexRgb(BLUE_COLOR.belly) : c   // the pale belly; a catchlight stays
  if (hi < 0.3 || r > b + 0.02) return c            // the eyes' browns and darks
  if (hi - lo < 0.08) return hexRgb(BLUE_COLOR.blush)
  const t = Math.min(1, Math.max(0, ((r + g + b) / 3 - LO) / (HI - LO)))
  return mix(hexRgb(BLUE_COLOR.deep), hexRgb(BLUE_COLOR.light), t)
}
/** a colour attribute's values (any item size >= 3), re-toned in place */
export function blueTint(part: 'body' | 'eyes', a: { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number; setXYZ(i: number, x: number, y: number, z: number): unknown }) {
  for (let i = 0; i < a.count; i++) { const [r, g, b] = blueTone(part, a.getX(i), a.getY(i), a.getZ(i)); a.setXYZ(i, r, g, b) }
}
/** Where Blue lies, in Greg's bench frame (bench 1.5 m wide along x, Greg faces +z): at the bench's end, a little forward. */
export const BLUE_AT = { x: 1.3, z: 0.3, yaw: -0.35 }
/** the Dewbear's rig numbers (docs/looks/dewbear-2026-11-24/README.md) */
export const DEWBEAR_URL = '/open/spirits/dewbear-rigged.glb'
