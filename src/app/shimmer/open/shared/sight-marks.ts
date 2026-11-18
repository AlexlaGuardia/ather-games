// THE ETCHED MARK in a sight's lens (CANON world/manalic-weapons.md › Sights, RULED 2026-11-18 /magii + Alex): a sight is a lens of
// ground Ather crystal with a mark etched into it; the mark LIGHTS FAINTLY WHEN MANA RUNS THROUGH THE GUN, there is no free-standing
// light, "so it never reads as a modern red dot". The mark is cut to the owner's choosing: customising is LOOK, NEVER POWER (only
// sigils change output). Which cuts and tints exist, and the menu, are Jin's.
//
// PURE geometry (node-safe): each cut is a list of strokes in a unit square (-1..1, y up), drawn the same way into the in-world lens
// (a canvas texture, fp-gun.tsx) and the scope ring (SVG). One definition, so the lens and the ring can never show different marks.
export type MarkId = 'dot' | 'ring' | 'ring-dot' | 'cross' | 'chevron'
export type Stroke = { k: 'dot'; r: number } | { k: 'ring'; r: number } | { k: 'line'; a: [number, number]; b: [number, number] }
export const MARKS: Record<MarkId, { name: string; strokes: Stroke[] }> = {
  dot: { name: 'Dot', strokes: [{ k: 'dot', r: 0.16 }] },
  ring: { name: 'Ring', strokes: [{ k: 'ring', r: 0.62 }] },
  'ring-dot': { name: 'Ring and dot', strokes: [{ k: 'ring', r: 0.62 }, { k: 'dot', r: 0.11 }] },
  cross: { name: 'Cross', strokes: [{ k: 'line', a: [-0.7, 0], b: [-0.2, 0] }, { k: 'line', a: [0.2, 0], b: [0.7, 0] }, { k: 'line', a: [0, -0.7], b: [0, -0.2] }, { k: 'line', a: [0, 0.2], b: [0, 0.7] }, { k: 'dot', r: 0.07 }] },
  chevron: { name: 'Chevron', strokes: [{ k: 'line', a: [-0.45, -0.4], b: [0, 0] }, { k: 'line', a: [0, 0], b: [0.45, -0.4] }] },
}
/** The light the etching gives when mana runs: a few tints a keeper can pick (look only). The default is warm, as Alex asked for a red
 *  dot, but it is mana light in a crystal, never an emitter. */
export type TintId = 'ember' | 'mana' | 'leaf' | 'gold'
export const TINTS: Record<TintId, { name: string; hex: string }> = {
  ember: { name: 'Ember', hex: '#ff5a3c' }, mana: { name: 'Mana', hex: '#7fc4ff' }, leaf: { name: 'Leaf', hex: '#8fe07a' }, gold: { name: 'Gold', hex: '#ffd36b' },
}
export interface SightLook { mark: MarkId; tint: TintId }
/** Every gun starts with the same plain cut; the keeper re-cuts it later (the menu). Scopes default to a cross, red dots to a dot. */
export const defaultLook = (scoped: boolean): SightLook => ({ mark: scoped ? 'cross' : 'dot', tint: 'ember' })
export const isLook = (v: unknown): v is SightLook => !!v && typeof v === 'object' && (v as SightLook).mark in MARKS && (v as SightLook).tint in TINTS

/** How brightly the etching shows, 0..1: faint while the gun is merely drawn (mana runs through a live gun), a flare as a round
 *  leaves or while a charge builds, never off while drawn and never on while stowed. */
export const MARK_IDLE = 0.35, MARK_FLARE_MS = 220
export function markGlow(drawn: boolean, now: number, firedAt: number, charging: number): number {
  if (!drawn) return 0
  const flare = Math.max(0, 1 - (now - firedAt) / MARK_FLARE_MS)
  return Math.min(1, MARK_IDLE + (1 - MARK_IDLE) * Math.max(flare, Math.max(0, Math.min(1, charging))))
}

/** Draw a cut into a 2D context, centred, `size` px across. Works on a canvas (the lens) the same as anywhere else. */
export function drawMark(ctx: { beginPath(): void; arc(x: number, y: number, r: number, a: number, b: number): void; moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; fill(): void; stroke(): void; lineWidth: number; lineCap: string; fillStyle: string | CanvasGradient | CanvasPattern; strokeStyle: string | CanvasGradient | CanvasPattern }, id: MarkId, size: number, color: string) {
  const h = size / 2, X = (x: number) => h + x * h, Y = (y: number) => h - y * h
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, size * 0.045); ctx.lineCap = 'round'
  for (const s of MARKS[id].strokes) {
    ctx.beginPath()
    if (s.k === 'dot') { ctx.arc(h, h, s.r * h, 0, Math.PI * 2); ctx.fill() }
    else if (s.k === 'ring') { ctx.arc(h, h, s.r * h, 0, Math.PI * 2); ctx.stroke() }
    else { ctx.moveTo(X(s.a[0]), Y(s.a[1])); ctx.lineTo(X(s.b[0]), Y(s.b[1])); ctx.stroke() }
  }
}
