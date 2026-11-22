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

export type PartColor = 'body' | 'dark' | 'metal' | 'ember' | 'glass' | 'dot'
/** box: s = size xyz. cyl: s[0] = diameter, s[2] = length, along z. tube: an open cyl (no caps). disc: s[0] = diameter, facing +z. */
export type Part = { o: [number, number, number]; s: [number, number, number]; c: PartColor; shape?: 'box' | 'cyl' | 'tube' | 'disc' }
export type Model = { parts: Part[]; grip: [number, number, number]; fore: [number, number, number]; top: number; sightZ: number; eye?: number; optic?: OpticId }
export const box = (o: Part['o'], s: Part['s'], c: PartColor = 'body'): Part => ({ o, s, c })
const cyl = (o: Part['o'], d: number, len: number, c: PartColor, shape: 'cyl' | 'tube' = 'cyl'): Part => ({ o, s: [d, d, len], c, shape })
const disc = (o: Part['o'], d: number, c: 'glass' | 'dot'): Part => ({ o, s: [d, d, 0], c, shape: 'disc' })
const both = (f: (side: 1 | -1) => Part) => [f(1), f(-1)]

export type KitGunId = 'backbone' | 'charred-rifle'
/** A gun body with a rail: everything but the sight. railTop = the rail's top face (y); seatZ = where a sight sits on it. */
export interface KitGun { id: KitGunId; name: string; parts: Part[]; grip: Model['grip']; fore: Model['fore']; railTop: number; seatZ: number; own: KitSightId }

const GRIP: Model['grip'] = [0, -0.06, 0.1], FORE: Model['fore'] = [0, -0.06, -0.26]

export const KIT_GUNS: Record<KitGunId, KitGun> = {
  // plain service rifle: a clean receiver, a full-length ribbed rail, a vented handguard, a box magazine, a solid stock
  backbone: { id: 'backbone', name: 'Backbone', grip: GRIP, fore: FORE, railTop: 0.047, seatZ: -0.06, own: 'hood', parts: [
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
  'charred-rifle': { id: 'charred-rifle', name: 'Charred Rifle', grip: GRIP, fore: FORE, railTop: 0.048, seatZ: -0.04, own: 'ring', parts: [
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
}

// ── the sights: seat-relative (origin = the rail's top face at the seat), eye = the sight line's height above the rail ──
export type KitSightId = 'hood' | 'ring' | 'lens' | 'scope2'
export interface KitSight { id: KitSightId; name: string; optic: OpticId; eye: number; parts: Part[] }
const clamp = (len: number): Part => box([0, 0.005, 0], [0.026, 0.01, len], 'dark')
export const KIT_SIGHTS: Record<KitSightId, KitSight> = {
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
}
/** Which sights each rail takes (start: the gun's own + the open lens + the 2x; where sights come from is a later economy call). */
export const sightsFor = (g: KitGun): KitSightId[] => [g.own, 'lens', 'scope2']

/** A gun with a sight seated on its rail, as a Model the rig draws: sight parts moved to the seat; eye/sightZ = the sight line. */
export function kitModel(gunId: KitGunId, sightId: KitSightId): Model {
  const g = KIT_GUNS[gunId], s = KIT_SIGHTS[sightId]
  const seated = s.parts.map(p => ({ ...p, o: [p.o[0], p.o[1] + g.railTop, p.o[2] + g.seatZ] as Part['o'] }))
  return { parts: [...g.parts, ...seated], grip: g.grip, fore: g.fore, top: g.railTop, sightZ: g.seatZ, eye: g.railTop + s.eye, optic: s.optic }
}
