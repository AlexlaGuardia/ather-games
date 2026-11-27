// M81 BLOCKOUT (Alex 11-22): the Backbone and the Charred Rifle rebuilt so the SIGHT is its own part on a RAIL, and sights as
// separate pieces that seat on any rail. PURE (no three, no react): fp-gun.tsx draws it, /shimmer/dev/gun-kit previews it.
// ⚠ LOOK IS ALEX'S (BETA M81 look 🔒): this is the blockout for his shots. Nothing in the live game reads it until he OKs the look.
//
// Canon it is built against: Backbone = the longbarrel standard issue, "balanced, reliable, boring, by design" (world/weapons.md:35).
// Charred Rifle = Kael's Prototype longbarrel, a crude mass-stamped grunt box, sealed external mana cell, 0 sockets, charred, runes
// blistered (world/manalic-weapons.md › Kael's Prototype). A sight is a lens of ground Ather crystal with an etched mark, and even a
// 0-socket Prototype may carry one (› Sights, RULED 11-18). So the gun's "own" sight is a stamped hood around a small crystal notch,
// not a lensless iron post (a post with no lens would be a canon question, not a build call).
//
// ★ grip / fore are LONGBARREL's exactly, so Alex's 11-22 hand values (offsets from these anchors) still land on the new models.
import type { OpticId } from './optics'
import { ironsFor, type IronStyle } from './irons'
import { V2_SIGHTS } from './gun-kit-v2'   // M178 s2: the holo + prism built in M149 s1 (3dc005f8), seated on these rails

export type PartColor = 'body' | 'dark' | 'metal' | 'ember' | 'glass' | 'dot'
  | KitColor   // M149: the new family's own colours (gun-kit-v2.ts); no model drawn today uses one
/** M149 (dead grey, unlit, dull bronze): iron / slot (inset) / bronze / core (the grey crystal) / stamp, soot, cell, strap (the Prototype) /
 *  etch (a cut line in a lens) / lens (a prism's eyepiece crystal) / view (the zoomed picture inside it, lit only in the sights) */
export type KitColor = 'iron' | 'slot' | 'bronze' | 'core' | 'stamp' | 'soot' | 'cell' | 'strap' | 'etch' | 'lens' | 'view'
/** box: s = size xyz. cyl: s[0] = diameter, s[2] = length, along z. tube: an open cyl (no caps). disc: s[0] = diameter, facing +z. */
export type Part = { o: [number, number, number]; s: [number, number, number]; c: PartColor; shape?: 'box' | 'cyl' | 'tube' | 'disc' | 'poly' | 'plate'
  /** M149, all optional (no model before it sets one). axis: which way a cyl / poly runs (cyl: z, poly: x). seg: a cyl's sides. end: a cyl's
   *  other diameter (its +axis end), or a poly's far (-z) end scale. rot: a turn about x. pts: a poly's outline ([z, y] along x, [x, y]
   *  along z), s[0] = its depth; bevel = its chamfer; hole = an outline cut through it. plate: s = w, h, flat, facing +z. */
  axis?: 'x' | 'y' | 'z'; seg?: number; end?: number; rot?: number; pts?: [number, number][]; hole?: [number, number][]; bevel?: number }
export type Model = { parts: Part[]; grip: [number, number, number]; fore: [number, number, number]; top: number; sightZ: number; eye?: number; optic?: OpticId
  /** M149: one mesh per colour instead of one per part (cheap draw calls) */ merge?: boolean
  /** M149: how close the eye comes to this sight, as a share of the gun's own ADS_DIST dial (1 = the dial) */ adsK?: number
  /** M149: a prism's eyepiece, width and height of the glass: the zoomed picture is drawn inside it */ lens?: [number, number]
  /** M149: the sight's own cut when the keeper has picked none */ cut?: 'dot' | 'cross'
  /** M178: an iron-sighted model's front post (its tip y, its z): aiming puts it at the view's centre */ post?: [number, number] }
export const box = (o: Part['o'], s: Part['s'], c: PartColor = 'body'): Part => ({ o, s, c })
const cyl = (o: Part['o'], d: number, len: number, c: PartColor, shape: 'cyl' | 'tube' = 'cyl'): Part => ({ o, s: [d, d, len], c, shape })
const disc = (o: Part['o'], d: number, c: 'glass' | 'dot'): Part => ({ o, s: [d, d, 0], c, shape: 'disc' })
const both = (f: (side: 1 | -1) => Part) => [f(1), f(-1)]

export type KitGunId = 'backbone' | 'charred-rifle' | 'lance'
/** A gun body with a rail: everything but the sight. railTop = the rail's top face (y); seatZ = where a sight sits on it. */
export interface KitGun { id: KitGunId; name: string; parts: Part[]; grip: Model['grip']; fore: Model['fore']; railTop: number; seatZ: number; own: KitSightId
  /** M178: how its irons are cut (shared/irons.ts) */ irons?: IronStyle
  /** M178 s2: the sights this rail takes, irons first (absent = irons, own, lens, 2x: the M81 set) */ sights?: KitSightId[]
  /** M178 s2: a mount drawn only under a bought sight (the Lance has no rail of its own: its irons stay exactly as s1 drew them) */ rail?: Part[] }

const GRIP: Model['grip'] = [0, -0.06, 0.1], FORE: Model['fore'] = [0, -0.06, -0.26]

export const KIT_GUNS: Record<KitGunId, KitGun> = {
  // plain service rifle: a clean receiver, a full-length ribbed rail, a vented handguard, a box magazine, a solid stock
  backbone: { id: 'backbone', name: 'Backbone', grip: GRIP, fore: FORE, railTop: 0.047, seatZ: -0.06, own: 'hood', sights: ['irons', 'hood', 'lens', 'scope2', 'ring', 'holo', 'prism'], parts: [
    box([0, 0, -0.03], [0.05, 0.07, 0.3]),                                   // receiver
    ...both(x => box([0.026 * x, -0.015, -0.03], [0.002, 0.006, 0.24], 'metal')),   // the mana-vein flute down each side
    box([0.026, 0.012, -0.02], [0.002, 0.02, 0.06], 'dark'),                 // ejection port
    box([0, 0.041, -0.05], [0.022, 0.012, 0.24], 'metal'),                   // THE RAIL
    ...[-0.15, -0.11, -0.07, -0.03, 0.01, 0.05].map(z => box([0, 0.048, z], [0.026, 0.003, 0.008], 'dark')),   // its ribs
    box([0, -0.008, -0.28], [0.056, 0.062, 0.2], 'dark'),                    // handguard
    ...[-0.22, -0.26, -0.3, -0.34].flatMap(z => both(x => box([0.029 * x, 0, z], [0.002, 0.03, 0.018], 'metal'))),   // vents
    box([0, 0.01, -0.395], [0.03, 0.036, 0.03], 'dark'),                     // front block
    cyl([0, 0.008, -0.47], 0.022, 0.16, 'metal'),                            // barrel
    cyl([0, 0.008, -0.57], 0.032, 0.04, 'dark'),                             // muzzle
    box([0, -0.04, -0.1], [0.036, 0.02, 0.064]),                             // mag well
    box([0, -0.095, -0.1], [0.03, 0.11, 0.055], 'dark'),                     // magazine
    box([0, -0.05, 0.05], [0.008, 0.006, 0.07], 'metal'),                    // trigger guard
    box([0, -0.075, 0.1], [0.034, 0.1, 0.045], 'dark'),                      // pistol grip
    box([0, 0, 0.18], [0.03, 0.04, 0.12], 'metal'),                          // stock tube
    box([0, -0.02, 0.29], [0.04, 0.09, 0.16], 'dark'),                       // stock
    box([0, -0.02, 0.375], [0.044, 0.1, 0.014], 'metal'),                    // butt pad
  ] },
  // a crude stamped box: welded seams and rivets, a short strap rail bolted on top, a bare barrel in a scorched shroud, the
  // SEALED external mana cell clamped to the left (no magazine: it never reloads from a box), a bent-strip skeleton stock, the
  // charge seam lit down the right side (it flares as the charge builds), blisters where Veyra's fire took the runes
  'charred-rifle': { id: 'charred-rifle', name: 'Charred Rifle', grip: GRIP, fore: FORE, railTop: 0.048, seatZ: -0.04, own: 'ring', irons: 'crude', sights: ['irons', 'ring', 'lens', 'scope2', 'hood'], parts: [
    box([0, 0, -0.04], [0.054, 0.074, 0.32]),                                // stamped receiver
    box([0, 0.038, -0.04], [0.056, 0.004, 0.32], 'dark'),                    // the weld seam along the top
    ...[0.08, -0.04, -0.16].flatMap(z => [0.02, -0.02].flatMap(y => both(x => box([0.028 * x, y, z], [0.004, 0.006, 0.006], 'metal')))),   // rivets
    box([0, 0.044, -0.04], [0.02, 0.008, 0.12], 'metal'),                    // THE RAIL: a short strap rail
    ...[0, -0.08].map(z => box([0, 0.03, z], [0.058, 0.006, 0.012], 'metal')),   // bolted on with two straps
    box([0, 0.006, -0.29], [0.04, 0.04, 0.14], 'dark'),                      // heat shroud
    ...[-0.25, -0.29, -0.33].map(z => box([0.021, 0.018, z], [0.003, 0.008, 0.01], 'dark')),   // the blistered runes
    cyl([0, 0.006, -0.45], 0.026, 0.3, 'metal'),                             // bare barrel
    box([0, -0.045, -0.25], [0.044, 0.05, 0.16], 'dark'),                    // foregrip block
    cyl([-0.042, -0.01, -0.08], 0.034, 0.14, 'metal'),                       // the sealed mana cell
    ...[-0.155, -0.005].map(z => cyl([-0.042, -0.01, z], 0.038, 0.012, 'dark')),   // its end caps
    ...[-0.12, -0.04].map(z => box([-0.031, -0.01, z], [0.02, 0.008, 0.01], 'dark')),   // its clamps
    box([0.029, 0.01, -0.04], [0.004, 0.012, 0.28], 'ember'),                // the charge seam
    box([0, -0.05, 0.05], [0.008, 0.006, 0.07], 'metal'),                    // trigger guard
    box([0, -0.075, 0.1], [0.036, 0.1, 0.048], 'dark'),                      // grip
    box([0, 0, 0.24], [0.02, 0.016, 0.26], 'metal'),                         // skeleton stock: top strip
    box([0, -0.06, 0.25], [0.02, 0.016, 0.22], 'metal'),                     //   bottom strip
    box([0, -0.03, 0.16], [0.02, 0.07, 0.016], 'metal'),                     //   strut
    box([0, -0.03, 0.37], [0.03, 0.09, 0.014], 'metal'),                     //   butt plate
  ] },
  // M178 s2: the LANCE (the reacher, the sniper). Its body is fp-gun's REACHER slate model part for part (gun-kit.test pins that), so its
  // irons stay what s1 drew; a bought sight sits on a short clamp-on mount that appears only with it (M149: 'the Lance has no rail').
  // seatZ: its irons' rear notch lands where s1 put it (REACHER sightZ -0.04 + fp-gun's IRON_BACK 0.06 = seatZ + IRON_REAR_BACK).
  lance: { id: 'lance', name: 'Lance', grip: [0, -0.07, 0.12], fore: [0, -0.06, -0.3], railTop: 0.043, seatZ: -0.03, own: 'irons', sights: ['irons', 'prism', 'holo'],
    rail: [box([0, 0.039, -0.06], [0.02, 0.008, 0.14], 'metal'), ...[-0.1, -0.02].map(z => box([0, 0.022, z], [0.05, 0.006, 0.012], 'dark'))],
    parts: [box([0, 0, -0.14], [0.046, 0.07, 0.5]), box([0, 0.004, -0.56], [0.018, 0.018, 0.36], 'metal'), box([0, -0.07, 0.12], [0.032, 0.1, 0.045], 'dark'), box([0, -0.015, 0.3], [0.04, 0.1, 0.26], 'dark'), box([0, 0.045, 0.28], [0.03, 0.02, 0.12], 'dark'), box([0, -0.03, -0.3], [0.04, 0.04, 0.18], 'dark')] },
}

// ── the sights: seat-relative (origin = the rail's top face at the seat), eye = the sight line's height above the rail ──
export type KitSightId = 'irons' | 'hood' | 'ring' | 'lens' | 'scope2' | 'holo' | 'prism'
export interface KitSight { id: KitSightId; name: string; optic: OpticId; eye: number; parts: Part[]
  /** M178 s2: an M149 sight carries its own eye distance, eyepiece (the prism's in-lens picture) and default cut; drawn merged */ v2?: Pick<Model, 'adsK' | 'lens' | 'cut'> }
const clamp = (len: number): Part => box([0, 0.005, 0], [0.026, 0.01, len], 'dark')
export const KIT_SIGHTS: Record<KitSightId, KitSight> = {
  // M178: the IRONS every gun wears by default: not a piece on the rail but cut into the gun (shared/irons.ts builds them per body,
  // so `eye` and `parts` here are placeholders; kitModel asks ironsFor). Both kit guns are longbarrels: the long irons' 1.3x.
  irons: { id: 'irons', name: 'Iron sights', optic: 'irons-long', eye: 0, parts: [] },
  // the Backbone's own: a square stamped hood over a small crystal notch, low on the rail
  hood: { id: 'hood', name: 'Issue hood', optic: 'reddot', eye: 0.02, parts: [
    clamp(0.04), ...both(x => box([0.012 * x, 0.021, 0], [0.004, 0.024, 0.03], 'metal')), box([0, 0.034, 0], [0.028, 0.004, 0.03], 'metal'),
    disc([0, 0.02, -0.01], 0.016, 'glass'), { o: [0, 0.02, -0.0095], s: [0.009, 0.009, 0], c: 'dot', shape: 'disc' },
  ] },
  // the Charred Rifle's own: a bent stamped ring on a crude post, the crystal set in it
  ring: { id: 'ring', name: 'Stamped ring', optic: 'reddot', eye: 0.022, parts: [
    clamp(0.03), box([0, 0.012, 0], [0.006, 0.012, 0.01], 'metal'), { ...cyl([0, 0.022, 0], 0.03, 0.01, 'metal', 'tube') },
    disc([0, 0.022, -0.002], 0.026, 'glass'), { o: [0, 0.022, -0.0015], s: [0.009, 0.009, 0], c: 'dot', shape: 'disc' },
  ] },
  // an open lens: a short tube with the crystal in it (today's red-dot look, now a separate piece)
  lens: { id: 'lens', name: 'Open lens (1x)', optic: 'reddot', eye: 0.028, parts: [
    box([0, 0.006, 0], [0.022, 0.012, 0.05], 'dark'), cyl([0, 0.028, 0], 0.038, 0.034, 'dark', 'tube'),
    disc([0, 0.028, -0.012], 0.034, 'glass'), { o: [0, 0.028, -0.0115], s: [0.012, 0.012, 0], c: 'dot', shape: 'disc' },
  ] },
  // a 2x scope on two rings
  scope2: { id: 'scope2', name: 'Scope (2x)', optic: 'scope2', eye: 0.034, parts: [
    clamp(0.09), ...[-0.03, 0.03].map(z => box([0, 0.02, z], [0.03, 0.02, 0.012], 'dark')),
    cyl([0, 0.034, 0], 0.028, 0.13, 'dark'), cyl([0, 0.034, -0.075], 0.04, 0.03, 'dark'), cyl([0, 0.034, 0.07], 0.036, 0.025, 'dark'),
    disc([0, 0.034, -0.091], 0.036, 'glass'), disc([0, 0.034, 0.083], 0.03, 'glass'),
  ] },
  // M178 s2: the BOUGHT better sights, the M149 s1 models as built (gun-kit-v2.ts): the holo (open window, the mark floating in the crystal, 1x)
  // and the 3x prism (the zoomed picture inside its own eyepiece; the keeper's view punches in only its `view`)
  holo: { id: 'holo', name: V2_SIGHTS.holo.name, optic: V2_SIGHTS.holo.optic, eye: V2_SIGHTS.holo.eye, parts: V2_SIGHTS.holo.parts, v2: { adsK: V2_SIGHTS.holo.adsK, cut: V2_SIGHTS.holo.cut } },
  prism: { id: 'prism', name: V2_SIGHTS.prism.name, optic: V2_SIGHTS.prism.optic, eye: V2_SIGHTS.prism.eye, parts: V2_SIGHTS.prism.parts, v2: { adsK: V2_SIGHTS.prism.adsK, lens: V2_SIGHTS.prism.lens, cut: V2_SIGHTS.prism.cut } },
}
/** Which sights each rail takes (KitGun.sights). M81: the gun's own + the open lens + the 2x, and the other gun's issue sight (the shops
 *  sold the stamped ring for the Backbone and the hood for the Charred Rifle); M178: irons first, every gun's default; M178 s2 (M149's
 *  fitting): the Backbone also takes the holo and the 3x prism, the Lance the prism and the holo only, the Charred Rifle nothing new. */
export const sightsFor = (g: KitGun): KitSightId[] => g.sights ?? ['irons', g.own, 'lens', 'scope2']
/** M178: where a kit gun's rear notch stands: just behind the seat, on the rail */
export const IRON_REAR_BACK = 0.05

/** A gun with a sight seated on its rail, as a Model the rig draws: sight parts moved to the seat; eye/sightZ = the sight line. */
export function kitModel(gunId: KitGunId, sightId: KitSightId): Model {
  const g = KIT_GUNS[gunId], s = KIT_SIGHTS[sightId]
  if (sightId === 'irons') {
    const ir = ironsFor(g.parts, g.seatZ + IRON_REAR_BACK, g.irons ?? 'clean')
    return { parts: [...g.parts, ...ir.parts], grip: g.grip, fore: g.fore, top: g.railTop, sightZ: ir.rearZ, eye: ir.eye, optic: s.optic, post: [ir.eye, ir.frontZ] }
  }
  const seated = s.parts.map(p => ({ ...p, o: [p.o[0], p.o[1] + g.railTop, p.o[2] + g.seatZ] as Part['o'] }))
  const m: Model = { parts: [...g.parts, ...(g.rail ?? []), ...seated], grip: g.grip, fore: g.fore, top: g.railTop, sightZ: g.seatZ, eye: g.railTop + s.eye, optic: s.optic }
  return s.v2 ? { ...m, ...s.v2, merge: true } : m   // an M149 sight's poly / plate parts draw through the merged path
}
