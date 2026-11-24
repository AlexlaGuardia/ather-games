// ★ SIGNED (Alex 11-24, athernyx bbf81e9; E2 CUT e7b374d): CANON/game/shimmer-infection-story-script.md, MAIN, word for word
// (infect-tell.test.ts reads the canon file). E3 (the lip of the opening) waits for the opening itself (M128 s3). `{PLACE}` = the settlement.
export const MOREL_INFECT = {
  start: 'Hollow ground is spreading at {PLACE}. Its waymark has gone dark.',
  hold: '{PLACE} is still holding. Trade has stopped there.',
  second: 'That is a long while for {PLACE}. It will not hold much longer.',
  lost: '{PLACE} is lost to Hollow ground. Its folk got out safe.',
} as const
/** clue n = index n-1; the seventh leaves no object (the opening is its object) */
export const INFECT_CLUE: readonly { folk: string; obj?: string }[] = [
  { folk: 'It came out of the Wilds at night. We heard it long before we saw it.', obj: 'A lump of grey matter. It is heavier than grey matter should be.' },
  { folk: 'The ground had already gone wrong before the big one got here. We saw the first patch a day early.', obj: 'Grey matter packed into a seam in the ground. It runs down, out of sight.' },
  { folk: 'Our water changed first. Before the ground, before anything.', obj: 'Grey matter from the bottom of the place the folk draw their water.' },
  { folk: 'It stood there for days. It never reached for the homes, never touched a thing.', obj: 'A crack in the ground where it stood. Something grey is still seeping out.' },
  { folk: 'The old folk tell of someone who walked down and never came back up.', obj: 'Mana pressed together, denser than any crystal you have held.' },
  { folk: 'The tale goes on. Down there, the mana around them went dead.', obj: 'A hollow shell of grey matter. It was shaped from the inside.' },
  { folk: 'There used to be a hum under the floor. We hear nothing down there now.' },
]
export const INFECT_CARRY = 'We lost our homes, but we all got out. Here is what we know.'
export const INFECT_SAVED = 'The waymark is lit and the ground is ours again. Thank you, Keeper.'
export const INFECT_OPEN = 'Where it fell, the ground has opened. It goes down.'
