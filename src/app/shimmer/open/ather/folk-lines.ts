// The settlement Moglins' lines: DREAMS (on a Moglin's card) and the recruit talk. Every word is lark's (11-18, hub
// a9c92710's dispatch), cozy register, no em dashes, no Earth animal nouns, metal only as a smith's imported ingots.
// ⚠ AWAITING ALEX'S SIGN-OFF (like 5b3edbad). Some dreams quietly say why the Moglin would leave home (lark's note:
// farmer 2, cook 3, carpenter 3, stonemason 3, alchemist 5, smith 3, jeweler 3).
import type { Profession } from './moglins'

export const DREAMS: Readonly<Record<Profession, readonly string[]>> = {
  shopkeeper: [],
  // M108 s3: FUNCTIONAL placeholder (build text, not lark's): the Digger's card line until @lark writes its dreams
  digger: ['I dig. Bring me Goldwood Plank for shoring and I will trade you Raw Mana Shards.'],   // Moonwell's Mallow only, whose dream is set in moonwell-glade.ts (a lark placeholder)
  farmer: [
    'I want to grow one Ather Lily, just once, and sit beside it.',
    'Our settlement eats what I grow and never asks what I\'d like to grow.',
    'I\'d like a field where nobody steps on the Goldleaf.',
    'Give me good soil and I\'ll grow Violetbloom loud enough to hum you awake.',
    'I want to feed a whole garden and hear nobody say they\'re hungry.',
  ],
  cook: [
    'I\'d like to cook for someone who comes back for seconds.',
    'I want a hearth of my own, and a table too long to count.',
    'Back home there are four cooks and one oven, and I\'m tired of waiting.',
    'One day I\'ll bake Ather Wheat bread that makes a grumpy keeper smile.',
    'I want to roast a Stonemelon, and nobody back home will let me.',
  ],
  carpenter: [
    'I want to build a roof somebody sleeps well under.',
    'I\'d like to work Dawnwood once, the old kind that holds warmth.',
    'I bring home every bit of deadfall, and my settlement has run out of room.',
    'I want to build a door that never sticks, not once, not ever.',
    'I\'d like to build a whole house and stand back and say nothing.',
  ],
  stonemason: [
    'I want to lay a path somebody walks every day without noticing.',
    'I\'d like to split a stone and find an Aqual inside, just once.',
    'Everything here is built, and I am a stonemason with nothing to hold up.',
    'I want a wall that stands longer than anyone remembers who built it.',
    'I\'d like a quiet yard and a big stone and a whole season.',
  ],
  // the BAIT-MAKER (rinnshop; Yarrow's trade, re-ruled 11-21). @lark, SIGNED by Alex 11-21 (athernyx b68a655,
  // CANON/game/yarrow-baitmaker-lines-script.md › Moglin card dreams), verbatim. Dream 1 is Yarrow's own Glade dream.
  rinnshop: [
    'I want a jar of bait so good the whole row asks what is in it.',
    'I\'d like to ready a catch so well that the cook stops and says nothing.',
    'Back home the Mast goes to the pot, and the bait gets the sweepings.',
    'I want one shelf of jars, labelled in my own hand, that nobody tidies.',
    'Our settlement has one bench for bait and four of us waiting at it.',
  ],
  alchemist: [
    'I want to brew a Starbloom draught that glows in the bottle.',
    'I\'d like a cauldron nobody else borrows.',
    'I want to know what Ather Lily does, and nobody here grows it.',
    'I want to brew the bottle you reach for when the day goes wrong.',
    'Our settlement has one Still, and I\'ve been on the waiting list all season.',
  ],
  smith: [
    'I want to work an ingot that came all the way from the continent.',
    'I\'d like a forge that stays hot all night and keeps me company.',
    'My settlement has no ingots and no use for me, so here I am.',
    'I want to make a perfect hinge, then a hundred more.',
    'I burn deadfall into charcoal and dream of what it might heat someday.',
  ],
  jeweler: [
    'I want to set a Dinloid so it catches the light from every side.',
    'I\'d like to make a ring someone never takes off.',
    'Everyone here wears what I made last season, and nobody needs another.',
    'I\'d like to hold a Rhyloid once, just to see how it\'s cut.',
    'I want to make small things so well that big folk stop and look.',
  ],
}

/** The recruit talk. `{goods}` reads right for one item or a list. */
export const TALK = {
  /** (a) a Moglin with no job, asked */
  yes: [
    'Nobody here needs my hands. Yours might. I\'ll come.',
    'A garden of my own to work? Yes, and gladly.',
    'I\'ve been waiting for somebody to ask. Show me the way.',
  ],
  /** (b) a Moglin with a job: trust first */
  trustFirst: [
    'I have work here. Bring {goods} and I\'ll know you mean it.',
    'They lean on me here. Bring {goods} for them, and then ask again.',
    'I don\'t know you yet. My folk need {goods}. Start there.',
  ],
  /** (c) the goods brought */
  trusted: [
    'You kept your word. I\'ll pack my things.',
    'That will see them through. All right, I\'ll come.',
    'My folk are looked after now. Lead on, Keeper.',
  ],
} as const
/** The talk line for a Moglin is fixed by its id, so it says the same thing every time you ask. */
export function talkLine(kind: keyof typeof TALK, folkId: string, goods = ''): string {
  let h = 0; for (let i = 0; i < folkId.length; i++) h = (h * 31 + folkId.charCodeAt(i)) >>> 0
  const pool = TALK[kind]; return pool[h % pool.length].replace('{goods}', goods)
}
