import type { Metadata } from 'next'

// Per-game share metadata — a real title, description, and the card art as the
// OG/Twitter image, so a shared link to this game reads as the game (not the
// generic site card). Server component wrapping the client page; render unchanged.
const CARD = '/squall/card.webp'

export const metadata: Metadata = {
  title: "Squall",
  description: "a mote of Ather in the void's storm · no shield, no shots — read the patterns, weave, just survive",
  openGraph: {
    title: "Squall · ather.games",
    description: "a mote of Ather in the void's storm · no shield, no shots — read the patterns, weave, just survive",
    images: [{ url: CARD, width: 1344, height: 768, alt: "Squall" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Squall · ather.games",
    description: "a mote of Ather in the void's storm · no shield, no shots — read the patterns, weave, just survive",
    images: [CARD],
  },
}

export default function SquallLayout({ children }: { children: React.ReactNode }) {
  return children
}
