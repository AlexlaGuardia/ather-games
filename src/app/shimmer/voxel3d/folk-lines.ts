// The Glade's spoken lines — Beat 0½ and Yarrow's return beat of `CANON/game/shimmer-quests-mainmap.md`,
// TRANSCRIBED VERBATIM. `<RIGHT>` / `<WRONG>` stay as the script writes them; recipe-book.ts fills them.
//
// ★ NOTHING HERE IS WRITTEN HERE. Every string is a copy of a locked line (Lark, Alex sign-off
// 2026-09-11 / 09-15; Magii's wiring sheet athernyx 17e2223). Jin owns WHEN a line fires and what
// the world does around it; the words are the Magii seat's. `folk-lines.test.ts` re-parses the
// canon file and fails on one changed character, so a re-ruled line shows up as a red test, not as
// a stale copy — the same discipline the sizes copy in creature-size.ts learned the hard way.
//
// The shape mirrors the script: a trigger is a list of beats, each a spoken line (`who`+`text`),
// a stage direction (`scene`, rendered dim and italic, never spoken), or a player option (`option`,
// the choice's two answers). Speaker names are the script's own caps.
//
// Regenerate: `python3 scripts/folk-lines-gen.py > src/app/shimmer/voxel3d/folk-lines.ts`.

export type Beat =
  | { who: 'GREG' | 'HAZEL' | 'SAX' | 'YARROW' | 'FENNEL' | 'MALLOW'; text: string }
  | { scene: string }
  | { option: string }

export const SCRIPT = {
  "warning": [
    { who: "GREG", text: "It is not all as it should be out here, Keeper. I will not dress it up." },
    { who: "GREG", text: "The grey is winning ground. Where nobody tends, it comes in. Where the wrong somebody does, it comes in faster." },
    { who: "GREG", text: "This garden was mine from wall to wall, once. Three plots went. One, then the next, then the next." },
    { who: "GREG", text: "I kept this one. The glade, the pool, and the folk who came to sit by it. That is what I have." },
    { scene: "Blue leans against his leg. Greg puts a hand on him without looking down." },
    { who: "GREG", text: "So. Now you know the worst of it. Nobody would think less of you for turning around." },
  ],
  "offer": [
    { who: "GREG", text: "But if you mean to stay, I can teach you a few things. Not all at once. A few." },
    { who: "GREG", text: "Start with the glade. Five doors, five folk, and every one of them better at their trade than I am." },
    { who: "GREG", text: "Knock. Ask what they want. Ask what they give. That is most of what there is to know about how this place runs." },
    { who: "GREG", text: "Go on. I will be here. I am always here." },
  ],
  "greg:bark": [
    { who: "GREG", text: "Five doors, Keeper. Then come and find me." },
  ],
  "folk:HAZEL:greet": [
    { scene: "Hazel is bent over a plank, one eye shut, and does not look up straight away." },
    { who: "HAZEL", text: "One moment. This cut wants finishing before it wants company." },
    { who: "HAZEL", text: "There. Hazel. Carpenter. If it stands up straight in this glade, I had a word with it first." },
  ],
  "folk:HAZEL:want": [
    { who: "HAZEL", text: "Bring me planks. Goldwood before anything else, it takes a joint and keeps it. Cord for the lashing, sap for the seams." },
    { who: "HAZEL", text: "And stack them square, Keeper. A crooked stack is a crooked table, and I will know." },
  ],
  "folk:HAZEL:lend": [
    { scene: "Hazel glances at the keeper's empty hands, then at the log waiting by the path." },
    { who: "HAZEL", text: "No blade of your own yet. Fine. Take mine." },
    { who: "HAZEL", text: "Hold it toward the wood and let it work. Bring it back square, blade and all." },
  ],
  "folk:HAZEL:give": [
    { who: "HAZEL", text: "What you get is tables. Shelves. A chest to keep your things dry. Whatever a pocket needs to feel like somebody lives there." },
    { who: "HAZEL", text: "You bring the wood. I make it hold. That is the whole trade." },
  ],
  "folk:HAZEL:bark": [
    { who: "HAZEL", text: "Measure it twice. The wood already knows the number, you are only catching up." },
  ],
  "folk:HAZEL:bark:owed": [
    { who: "HAZEL", text: "Planks, square, and my blade back. In that order." },
  ],
  "folk:HAZEL:turn-in": [
    { scene: "Hazel runs a hand along the stack, corner to corner, and does not sigh." },
    { who: "HAZEL", text: "Square. Good. That is a keeper who measures twice." },
    { who: "HAZEL", text: "These will make something worth having." },
    { who: "HAZEL", text: "My blade back now, if you please. It is mine, and I am not done with it." },
  ],
  "folk:SAX:greet": [
    { scene: "Sax is carrying a stone that should take two people, and sets it down without a sound." },
    { who: "SAX", text: "Sax." },
    { who: "SAX", text: "The rim of the pool. That was me. I say that once, so there it is." },
  ],
  "folk:SAX:want": [
    { who: "SAX", text: "Cooled-cloud stone. As much as you can carry, and then a little less, so you can still walk." },
    { who: "SAX", text: "Mana crystal for the good work. Not often. When it matters." },
  ],
  "folk:SAX:give": [
    { who: "SAX", text: "Paving. Low walls. Anything that has to hold weight and hold still." },
    { who: "SAX", text: "Ground stays where I put it. That is all I do. It is enough." },
  ],
  "folk:SAX:bark": [
    { who: "SAX", text: "Still standing. Good." },
  ],
  "folk:YARROW:greet": [
    { who: "YARROW", text: "Do not touch the jars. Good. You listen. Yarrow. Apothecary." },
  ],
  "folk:YARROW:want": [
    { who: "YARROW", text: "Herbs, bark, raw shards. Anything you pull out of the ground that smells like it means something." },
    { who: "YARROW", text: "And brews. Yours, once you can make one. I pay fair, and I pay better for whatever I am out of that week." },
  ],
  "folk:YARROW:give": [
    { who: "YARROW", text: "Jars. Catalysts. And your first recipe, when you are ready for it, which is not today." },
    { who: "YARROW", text: "I will not brew for you. I will show you once, and after that it is your hands or nobody's." },
  ],
  "folk:YARROW:bark": [
    { who: "YARROW", text: "Here. Hold this. No, that one is wrong. Now you know a wrong one." },
  ],
  "folk:FENNEL:greet": [
    { who: "FENNEL", text: "Have you eaten? You have not eaten. Fennel. I do the cooking, and everybody here eats, so we will get on." },
  ],
  "folk:FENNEL:want": [
    { who: "FENNEL", text: "Bring me whatever is in season. Crops, rinn, anything sweet. If it grew this week, I want it this week." },
  ],
  "folk:FENNEL:give": [
    { who: "FENNEL", text: "Meals for you. Spirit food for whoever comes to sit by you one day. Nobody else on this row makes it, so you will be back." },
    { scene: "Fennel whistles, two notes. A round little Dewbear tumbles out of the grass to see what is on offer." },
    { who: "FENNEL", text: "We all eat here, come evening. Hazel talks to the table, Sax eats for two, and Yarrow complains about the salt and has thirds." },
  ],
  "folk:FENNEL:bark": [
    { who: "FENNEL", text: "Eat something. I can hear your stomach from the door." },
  ],
  "folk:MALLOW:greet": [
    { who: "MALLOW", text: "Careful with the door, it sticks. Mallow. I keep the shop, and the shop keeps the rest of us." },
  ],
  "folk:MALLOW:want": [
    { who: "MALLOW", text: "What do I want? Depends on the day. Look at the list. It changes, and I do not apologise for it." },
    { who: "MALLOW", text: "Today it is one thing. Tomorrow the world wants something else, and I only write down what it asks for." },
  ],
  "folk:MALLOW:give": [
    { who: "MALLOW", text: "Marks for whatever is on the list. Goods off the shelf for Marks. That is the loop, and it closes right here." },
    { who: "MALLOW", text: "Bring me something I asked for and I will remember it. I remember everything anybody ever sold me. It is not a threat. It is just true." },
  ],
  "folk:MALLOW:bark": [
    { who: "MALLOW", text: "The list has changed. Have a look before you go gathering." },
  ],
  "greg:ask": [
    { scene: "Greg reaches into his coat and comes out with a raw shard, small and dim, turning it once before he holds it out." },
    { who: "GREG", text: "One more thing, before you find me again." },
    { who: "GREG", text: "This path goes dark early. I would like a light on it." },
    { who: "GREG", text: "Take this shard. Work some wood around it, same as Hazel taught, and set it where the dark sits thickest." },
    { who: "GREG", text: "A tended thing holds the dark back better than one nobody minds. You have seen why already." },
  ],
  "greg:bark:light": [
    { who: "GREG", text: "The path is still dark, Keeper. That shard will not light itself." },
  ],
  "greg:lit": [
    { who: "GREG", text: "There now. Look at that." },
    { who: "GREG", text: "A tended thing, right where the dark used to sit. Come and find me." },
  ],
  "choice": [
    { scene: "Back at the pool. Greg has not moved. Blue has, a little, to be nearer the water." },
    { who: "GREG", text: "Five doors. Good. Then you have seen the shape of it." },
    { who: "GREG", text: "Bring what is wanted, take what is given, and a place like this holds. That is the whole trick, and it took me longer than five doors to learn it." },
    { who: "GREG", text: "It could be yours, in time. A glade like this one. Nobody promises it will be. It is only on offer." },
    { who: "GREG", text: "So. Are you staying, Keeper?" },
    { option: "I am staying." },
    { option: "Not yet." },
  ],
  "choice:not-yet": [
    { who: "GREG", text: "Then take your time. Walk the glade. I am not going anywhere, and neither is the question." },
    { scene: "The door the Keeper came through is still there, still open. Through it, small and far off, the lantern light of the square." },
  ],
  "fold": [
    { who: "GREG", text: "Good. I hoped so. Now then. Hold still a moment, this part is mine to do." },
    { scene: "Greg turns to the path out of the glade and lifts one hand, the way you would smooth a creased cloth. Somewhere down the path, the air settles." },
    { who: "GREG", text: "There. Nobody folds their own, the first time. Somebody has to do it for you." },
  ],
  "folk:YARROW:teach": [
    { scene: "Yarrow looks at the keeper's hands, then turns to the shelf without waiting to be asked." },
    { who: "YARROW", text: "You have a cauldron of your own now. Then it is today." },
    { scene: "Yarrow puts <WRONG> into the keeper's hand, steps back, and waits without saying anything." },
    { option: "Point at the other one." },
    { option: "Say nothing." },
  ],
  "folk:YARROW:teach:pointed": [
    { who: "YARROW", text: "You looked at the plant and not the shelf. Good." },
  ],
  "folk:YARROW:teach:silent": [
    { who: "YARROW", text: "Wrong one. Same look. Not the same plant." },
  ],
  "folk:YARROW:teach:page": [
    { scene: "Yarrow sets <RIGHT> in the keeper's other hand, lays a folded page on top of it, and does not ask for the first one back." },
    { who: "YARROW", text: "<RIGHT>. That is the one with mana in it. Cauldron, then pour. Mana Draught." },
    { who: "YARROW", text: "The page is yours. I said I would show you once, and that was once." },
  ],
} as const satisfies Record<string, readonly Beat[]>

export type Trigger = keyof typeof SCRIPT

/** The beats of a trigger, in script order. */
export function beatsOf(t: Trigger): readonly Beat[] { return SCRIPT[t] }
