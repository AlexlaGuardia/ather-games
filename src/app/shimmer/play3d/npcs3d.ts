// NPCs for the 3D walker — minimal placement + dialogue data. The 2D game has a full NPC/dialogue
// engine (world/npcs.ts, dialogue-data.ts); the 3D walker only needs what the first quests use, so this
// is a lean stand-in. Dialogue text is canon/voice (raven's lane) — kept here so it's easy to revise.

export interface NPC3D {
  id: string
  name: string
  zone: string
  tileX: number
  tileY: number
  color: string
  kind: 'keeper' | 'moglin'
  defeatedFlag?: string // save-flag that, once set, removes this NPC from the world (e.g. a freed hold)
  requiredFlag?: string // save-flag that must be set before this NPC appears (gates the hold order)
}

export const NPCS_3D: NPC3D[] = [
  // Gregory — mentor keeper, stands by his house in Moonwell Glade (matches 2D npcs.ts placement).
  { id: 'gregory', name: 'Gregory', zone: 'moonwell-glade', tileX: 24, tileY: 18, color: '#caa46a', kind: 'keeper' },
  // Thistle — Hold 1. A borrowed-swagger Moglin in Spirit Meadows with a collared spirit. You free it
  // (a Reach battle), he deflates and retreats east. Removed from the world once freed.
  { id: 'thistle', name: 'Thistle', zone: 'spirit-meadow', tileX: 55, tileY: 30, color: '#9a6aaa', kind: 'moglin', defeatedFlag: 'freedThistle' },
  // Vetch — Hold 2, the stronghold. Keeps TWO collared spirits on the leash (canon): break the
  // stronghold, then reach BOTH captives. Appears only after Thistle is freed (he fled here).
  // TODO(hold-placement): canon home is the `vetch-hold` zone (via the Gloview pen door). Parked in
  // mana-springs (30,25) because vetch-hold isn't baked in 3D yet — move zone+tile here when it is.
  { id: 'vetch', name: 'Vetch', zone: 'mana-springs', tileX: 30, tileY: 25, color: '#7a5a3a', kind: 'moglin', requiredFlag: 'freedThistle', defeatedFlag: 'freedVetch' },
  // Brack — Hold 3, the climax. The pooled force: two enforcers shielding THREE collared spirits.
  // Appears only after Vetch falls.
  // TODO(hold-placement): canon home is the `brack-hold` zone (via vetch-hold's gated east door).
  // Parked at the south end of mana-springs (65,92) because brack-hold isn't baked in 3D yet — move here.
  { id: 'brack', name: 'Brack', zone: 'mana-springs', tileX: 65, tileY: 92, color: '#5a4632', kind: 'moglin', requiredFlag: 'freedVetch', defeatedFlag: 'freedBrack' },
  // ── The Passage's trader (2026-08-13) — the face of the scroll rack ──────────────────────────
  // Canon (`world/rune-hold.md` § The Passage): traders take ROTATING spots, "one leaves, another
  // takes their place. No permanent claims." So this is deliberately not a character: one id, one
  // table, and the stock under it turns over with the day (`scroll-market.ts`). The person you meet
  // is whoever is holding that spot this cycle, which is exactly what canon describes.
  //
  // ⚠ NAMED FOR THE ROLE, NOT THE PERSON — "a trader" is the canon-safe version. Giving them a name
  // and a history would be authoring a Passage character, which is Magii's, not mine. The colour is
  // a placeholder the same way voxel-Greg's boxes are; the look is Alex's call when the Passage gets
  // its real interior (which is CONTINUOUS geometry, not this tile shell — see GBOARD).
  { id: 'passage-trader', name: 'A trader', zone: 'the-passage', tileX: 12, tileY: 9, color: '#c9a05a', kind: 'keeper' },
]

// ── The trader's lines. Canon's register for the place: "if you know, you know" — no pitch, no
// welcome, no explanation of the rules to someone who is standing in a place you only reach by
// being shown. The rule the player needs (the rune gates the scroll) is stated as a shrug.
export const TRADER_LINES: string[] = [
  'You came down the back way, so somebody vouched. Fine.',
  'Technique only. Nobody here sells you a rune, and anyone who says otherwise is selling you paper.',
  'What you can read is what you already are. Look for yourself.',
]

// ── Region clones (2026-08-01, the walkability pass): every NPC keyed to a legacy zone a
// region absorbed gets a copy in that region at the same spot (source offset applied), so
// the story stands in BOTH worlds until cutover. Derived, not hand-placed — the ids stay
// identical on purpose: freeing Thistle in either world frees him in both, because there
// is one world truth (`defeated`/flags key on the id).
import { REGION_FILES, REGION_WIP_PREFIX } from '../world/region-maps'
for (const f of Object.values(REGION_FILES)) {
  for (const n of [...NPCS_3D]) {
    const s = f.sources[n.zone]
    if (s) NPCS_3D.push({ ...n, zone: REGION_WIP_PREFIX + f.id, tileX: n.tileX + s.ox, tileY: n.tileY + s.oy })
  }
}

// ── Gregory's first-quest dialogue (raven-voiced, his deep/warm/measured keeper register). ──
export const GREG_INTRO_LINES: string[] = [
  'You found the glade. Good. Most folk walk right past it.',
  'But you have come empty-handed. No spirit at your side. That is no way for a Keeper to start.',
  'Hold still a moment. The Ather comes easier to a quiet hand.',
]
export const GREG_NUDGE = 'There. Young, curious, and yours now. Take it out past the well, to Spirit Meadows, where a Moglin named Thistle has been throwing his weight around.'
export const GREG_RETURN = 'Your spirit trusts you. That is what matters. Thistle is still out in the meadows, Keeper.'

// ── Thistle (Hold 1) — verbatim/near-verbatim from CANON/game/shimmer-quests-mainmap.md. ──
// No spirit yet → he just sneers and shoos you (go get your starter from Greg first).
export const THISTLE_TAUNT_NO_SPIRIT: string[] = [
  'Eyes front, little keeper. You are looking at Thistle, and this meadow is Thistle’s now. Mine. Every blade of it.',
  'See my friend here? See how it minds me? Bet you have not got one of these.',
  'Run along now. Shoo. This is no place for keepers with empty pots.',
]
// You have a bonded spirit → the pre-fight swagger, then the Reach battle.
export const THISTLE_PREFIGHT: string[] = [
  'You came back? You actually came back. With that little sprout at your heel?',
  'You think your sweet chosen friend is any match for mine? Mine does what it is told. Watch.',
  'Thistle does not lose his own meadow to a keeper with mud still on their boots. Come on then.',
]
// On defeat — the deflation beat, then he retreats east toward Vetch.
export const THISTLE_DEFEAT: string[] = [
  'No. No, no, that is not how it goes. My friend never. You never.',
  'This is not over. Thistle just needs to be somewhere safer, is all. Somewhere with bigger friends.',
  'East. Vetch will know what to do with the likes of you.',
]
export const FREED_SPIRIT_BEAT = 'The collar drops, useless. The freed spirit looks at you a long moment, then drifts back into the meadow, light again.'

// ── Vetch (Hold 2 — the stronghold) — verbatim from CANON/game/shimmer-quests-mainmap.md, Beat 6. ──
// He keeps two on the leash and shelters the fled Thistle; tougher than Hold 1, name-drops Brack.
export const VETCH_PREFIGHT: string[] = [
  'So you are the one. The little keeper who put my brother Thistle to flight. He came scampering up here with his tail in a knot, going on about a sprout with muddy boots.',
  'I am not Thistle. Thistle is soft. I keep two friends on the leash, not one, and they mind me twice as well. You will not find me so easy to chase off.',
  'And even if you did? Even if? You would only be doing me a favor. Brack is up the road, keeper. Brack is the biggest of us, with more friends on more leashes than you can count. You think you are climbing toward something. You are climbing toward him.',
  'Go home. Go home while it is still your idea.',
]
// On defeat — the meanness drains out; he falls back up the road to Brack.
export const VETCH_DEFEAT: string[] = [
  'How. How are you still standing. That is not. You should not be able to do that.',
  'Fine. Fine! Vetch knows when to fall back. Up the road I go, up to Brack, where it is safe, where you cannot follow without going through everything he has got.',
  'You will not climb that hill, keeper. Nobody climbs that hill. Brack will see to it.',
]
// Both collars snap at once when the stronghold falls.
export const FREED_PAIR_BEAT = 'Both collars drop at once. The two freed spirits drift apart from the leash, blinking, and go light again into the springs.'

// ── Brack (Hold 3 — the climax) — verbatim from CANON/game/shimmer-quests-mainmap.md, Beat 7 (LOCKED). ──
// The biggest swagger, the most collars. He huddles Thistle and Vetch behind him.
export const BRACK_PREFIGHT: string[] = [
  'So. The little keeper made it all the way up Brack’s hill. The whole long way, just to stand in front of the biggest friend-keeper in the country.',
  'Look at them all. Count them if you like. I have got more than Thistle, more than Vetch, more than the two of them stacked one on the other. That is what makes Brack Brack.',
  'You freed a meadow. Cute. You chased my brothers up a road. Cute. But this is the top, keeper, and the top is mine, and nobody, nobody, takes the top from Brack.',
  'Come on then. Bring your one little chosen friend against all of mine. Let us see whose is stronger. Let us settle it.',
]
// The defeat + triple deflation + welcome-home — a four-voice scene (Brack/Thistle/Vetch/Gregory,
// narration as '—'). Rendered with per-line speakers. This is the payoff that closes the liberation arc.
export interface ScriptLine { speaker: string; text: string }
export const BRACK_FINALE: ScriptLine[] = [
  { speaker: '—', text: 'The leashes give way, one after another, the dark metal cracking and falling into the grass. The dimmed spirits brighten all at once, color flooding back, and they scatter for the open sky, free.' },
  { speaker: 'Brack', text: 'Oh. Oh no. They are gone. The friends are gone, and I feel ever so small, and I do not, I do not actually want to fight anybody.' },
  { speaker: '—', text: 'Behind him, Thistle and Vetch slump the very same way, all the borrowed bigness draining out of the three of them at once, until they are only three round, drab, gentle folk standing close together, blinking like they just woke up.' },
  { speaker: 'Thistle', text: 'We were awfully loud, were we not.' },
  { speaker: 'Vetch', text: 'I said some unkind things. I did not mean them. The leash sort of says them for you.' },
  { speaker: 'Brack', text: 'We never knew how to be brave on our own, so we borrowed it. And it never fit. It pinched the whole time.' },
  { speaker: 'Gregory', text: 'There now. There is what was under all that noise the whole while. The gentlest folk in the Ather, the day they put the collars down.' },
  { speaker: 'Gregory', text: 'Well, you three. You squatted on this keeper’s road long enough. Time you made yourselves useful, the honest way.' },
  { speaker: 'Thistle', text: 'I will mind a corner for you, Keeper. Keep it ready. Keep it warm. For whatever comes next.' },
  { speaker: 'Vetch', text: 'And I am good with names. If ever a friend of yours wants a new one, a kinder one, you bring them to me. I will help you find the right fit.' },
  { speaker: 'Brack', text: 'I know the worth of things, Keeper. Spent years counting them on leashes, more shame to me. Let me count them the right way now. You bring me what you have, I will help you trade for what you need.' },
  { speaker: 'Gregory', text: 'You see, Keeper? You did not beat them. You freed them. There is a difference, and it is the whole of the work.' },
]
// Shown ahead of the finale only when the hold was forced (a captive KO'd) instead of reached.
export const BRACK_FORCED_BEAT: ScriptLine = { speaker: '—', text: 'You broke through by force, not by reaching — and some of what you came to free did not make it. Still, the leashes fall. Brack has nothing left to hold.' }
