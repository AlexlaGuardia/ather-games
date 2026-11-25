// M95 load-screen tips. DRAFT PENDING ALEX SIGN-OFF (lark draft, docs/handoff/m95-load-tips.md, text verbatim).
// Pure data + picker: no React, no storage import, so the test runs under plain tsx.
export type TipSide = 'ather' | 'nyx' | 'both'
export type TipRegister = 'plain' | 'dry' | 'sarcastic'
export interface LoadTip { text: string; register: TipRegister; side: TipSide }

/** DRAFT, pending Alex sign-off. Do not edit the text without lark. */
export const LOAD_TIPS: readonly LoadTip[] = [
  { text: "Hold F to charge your Mana Skin. It costs a little mana and soaks blows until it pops.", register: 'plain', side: 'both' },
  { text: "R draws your gun. Tap again to swap. Hold R to put it away.", register: 'plain', side: 'both' },
  { text: "Hands free, you move a little faster, and a node gets the right tool on its own.", register: 'plain', side: 'both' },
  { text: "Stand at one of your waymarks and press E to travel.", register: 'plain', side: 'ather' },
  { text: "Press L at your own waymark to lift it back into your bag.", register: 'plain', side: 'ather' },
  { text: "Out in the Wilds, press H to walk home.", register: 'plain', side: 'ather' },
  { text: "Walk over grey matter to pick it up. Gregory, at Moonwell Glade, trades it for new ground.", register: 'plain', side: 'ather' },
  { text: "Every potion shares one cooldown. Drink, then give it fifteen seconds.", register: 'plain', side: 'both' },
  { text: "Mana refills after a short rest from spending it. Casting, gathering and reloading all count.", register: 'plain', side: 'both' },
  { text: "Keys can be moved. Open Options, then Controls, and press the key you want.", register: 'plain', side: 'both' },
  { text: "Right-click with empty hands to swing. Three hits pop a placed piece back into your bag.", register: 'plain', side: 'ather' },
  { text: "Every city keeps a pitstop — visit it once, and the door stays open to you.", register: 'plain', side: 'nyx' },
  { text: "Press Space again in the air. You get one more jump than seems fair.", register: 'dry', side: 'both' },
  { text: "Stand still a while and your companion finds somewhere to nap. The camera gets curious too.", register: 'dry', side: 'ather' },
  { text: "A rinn that gets away takes the bait with it. The line never breaks, so there is that.", register: 'dry', side: 'ather' },
  { text: "When a rinn fights, give a little. When it tires, take. Hold to take, let go to give.", register: 'dry', side: 'ather' },
  { text: "Morel only speaks when it matters. Running low on rounds matters.", register: 'dry', side: 'both' },
  { text: "Your Moglins keep the stations busy while you are away. You will hear all about it.", register: 'dry', side: 'ather' },
  { text: "Only one companion walks with you at a time. Choose on the Character tab, and choose kindly.", register: 'dry', side: 'both' },
  { text: "The Corkhouse buys your bottles. Nobody else will — ask around if you like.", register: 'dry', side: 'nyx' },
  { text: "A farm on its own sells its produce raw — and cheap.", register: 'dry', side: 'nyx' },
  { text: "Your businesses keep working while you are gone — eight hours of it. After that, they wait.", register: 'dry', side: 'nyx' },
  { text: "You start with 1,500 Marks. The cheapest deed is 35,000. Pace yourself.", register: 'sarcastic', side: 'nyx' },
  { text: "Fell to the Hollows? Your pack is where you fell. Go back soon. How soon is a secret.", register: 'sarcastic', side: 'ather' },
  { text: "Reloading costs mana. Yes, every time. Shoot like you meant it.", register: 'sarcastic', side: 'both' },
  { text: "Your hands are busy at the wheel. E gets you out of the Darter. The shop will wait.", register: 'sarcastic', side: 'nyx' },
  { text: "A blank glove casts nothing. It will tell you so, every single time you try.", register: 'sarcastic', side: 'both' },
  { text: "Mana Skin takes a second to start filling. Mid-fight is a bold time to begin.", register: 'sarcastic', side: 'both' },
  { text: "You can plant twelve waymarks. One on every hill was a lovely plan.", register: 'sarcastic', side: 'ather' },
  { text: "Gregory sells the ground under the mist. He does not take compliments. Bring grey matter.", register: 'sarcastic', side: 'ather' },
]

/** Indexes (into LOAD_TIPS) eligible for a side: its own tips plus the [both] ones. */
export function tipPool(side: 'ather' | 'nyx'): number[] {
  const out: number[] = []
  LOAD_TIPS.forEach((t, i) => { if (t.side === 'both' || t.side === side) out.push(i) })
  return out
}

/** Pick one tip index for `side`, never `last` (when the pool has another). `rnd` is injectable for tests. */
export function pickTip(side: 'ather' | 'nyx', last: number | null, rnd: () => number = Math.random): number {
  const pool = tipPool(side)
  const ok = pool.length > 1 ? pool.filter(i => i !== last) : pool
  return ok[Math.min(ok.length - 1, Math.floor(rnd() * ok.length))]
}

/** Load images (public/shimmer/load/). `title` = ATHER is drawn over it as text (never baked into the file). */
export interface LoadImage { src: string; side: 'ather' | 'nyx' | 'both'; title: boolean; pos?: string }
export const LOAD_IMAGES: readonly LoadImage[] = [
  { src: '/shimmer/load/ather-green.webp', side: 'ather', title: true },
  { src: '/shimmer/load/wilds-sky.webp', side: 'ather', title: true, pos: '50% 80%' },
  { src: '/shimmer/load/glade.webp', side: 'ather', title: false },
  { src: '/shimmer/load/wilds-seam.webp', side: 'ather', title: false },
  { src: '/shimmer/load/nyx-street-a.webp', side: 'nyx', title: false, pos: '50% 40%' },
]
