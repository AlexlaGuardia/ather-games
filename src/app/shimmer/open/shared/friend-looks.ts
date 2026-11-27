// BONN, OTTO, TESS AS KEEPERS (BETA M154, hub call 11-27: they are keepers, so they are built from the keeper figure system:
// a Look's cartoon head + torso + scarf + belt, the model's dials, and a KeeperDress for the card's exact colours and the few
// shapes the locked looks need). Looks LOCKED by Alex 11-25 (athernyx ebfc2f1, concept-1672 keepers-sheet-3, private; never
// copied here). CANON characters/{bonn,otto,tess}.md › Look; the card notes beat the pictures.
import { DEFAULT_LOOK, type Look } from './keeper-look'
import { proportionsFor, type Proportions } from './keeper-proportions'
import { TORSO_STARTS } from './keeper-bodies'
import type { KeeperDress } from './keeper-figure'
import type { FriendId } from './friend-figure'

export interface FriendLook {
  sex: 'F' | 'M'
  /** the creator's rows: head 1-8 = A-D male / female, torso 0-5 (odd = female), frame 0-2 */
  look: Look
  dress: KeeperDress
  /** dial values over the model's saved dials + the torso's starting dials (values only: the dials own every size) */
  dials: Partial<Proportions>
  /** the card notes, as written beside the locked sheet */
  notes: readonly string[]
}

const L = (o: Partial<Look>): Look => ({ ...DEFAULT_LOOK, ears: 1, ...o })

export const FRIEND_LOOKS: Readonly<Record<FriendId, FriendLook>> = {
  // warm brown skin, green eyes, big coily dark hair, small for her age still; mustard-gold tunic, brown trousers, small boots
  bonn: {
    sex: 'F',
    look: L({ frame: 0, torso: 1, head: 2, scarfStyle: 1, belt: 0 }),
    dress: { skin: '#a9653c', hair: '#2a1d17', iris: '#3f9a4c', top: '#dba11c', hand: '#a9653c', foot: '#cf8f1c', belt: '#70401f', scarf: null, hairStyle: 'Coily' },
    dials: { eye: 1.1 },
    notes: ['pointed ear tips', 'no earring', 'green eyes', 'big coily dark hair', 'mustard-gold tunic', 'small boots'],
  },
  // fair and freckled, thick sandy-copper hair, sturdy, broad build; goggles up, copper kerchief, leather apron, tool belt,
  // fingerless gloves, boots; a green shirt under the apron (the sheet)
  otto: {
    sex: 'M',
    look: L({ frame: 1, torso: 2, head: 3, scarfStyle: 0, belt: 0 }),   // B male's smirk = his grin; C male's spiky crop (hairStyle)
    dress: { skin: '#ffd2b0', hair: '#c8824a', iris: '#7a4f2c', top: '#5f8048', apron: '#a8682c', hand: '#5d4230', foot: '#75432c', belt: '#54321f', scarf: '#c4592c', goggles: true, hairStyle: 'C-M' },
    dials: { hand: 1.15 },
    notes: ['pointed ear tips', 'FAIR skin', 'fingerless gloves', 'lighter sandy-copper hair', 'goggles up', 'copper kerchief', 'leather apron'],
  },
  // pale, fine dark hair under a hood, slight and still, hazel eyes; sand hooded coat (never grey), lavender scarf, quiet boots
  tess: {
    sex: 'F',
    look: L({ frame: 0, torso: 3, head: 8, scarfStyle: 1, belt: 0 }),
    dress: { skin: '#ffdcc2', hair: '#221d1f', iris: '#8a7238', top: '#e2c68e', hood: '#e2c68e', hand: '#ffdcc2', foot: '#a8642b', belt: '#8a4726', scarf: '#a587c2' },
    dials: {},
    notes: ['pointed ear tips', 'hazel eyes', 'trousers into the boots', 'seeds in the satchel', 'sand coat, never grey', 'lavender scarf', 'hood up'],
  },
}

/** the dials a friend builds with: the model's saved dials, the torso's starting dials, then the friend's own values */
export const friendProportions = (id: FriendId): Proportions => {
  const f = FRIEND_LOOKS[id]
  return { ...proportionsFor(f.look), ...TORSO_STARTS[f.look.torso], ...f.dials }
}

/** what the prod check reads (window.__friendLooks): the look record a friend was drawn from */
export const friendRecord = (id: FriendId) => {
  const f = FRIEND_LOOKS[id]
  return { sex: f.sex, head: f.look.head, torso: f.look.torso, hair: f.dress.hair, skin: f.dress.skin, hairStyle: f.dress.hairStyle ?? null, hood: !!f.dress.hood, goggles: !!f.dress.goggles }
}
