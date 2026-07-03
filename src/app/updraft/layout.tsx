import type { Metadata } from 'next'

// Per-game share metadata — a real title, description, and the card art as the
// OG/Twitter image, so a shared link to this game reads as the game (not the
// generic site card). Server component wrapping the client page; render unchanged.
const CARD = '/updraft/card.webp'

export const metadata: Metadata = {
  title: "Updraft",
  description: "a spark of Ather rides the rising light · one tap to climb, mind the void — endless flight",
  openGraph: {
    title: "Updraft · ather.games",
    description: "a spark of Ather rides the rising light · one tap to climb, mind the void — endless flight",
    images: [{ url: CARD, width: 1344, height: 768, alt: "Updraft" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Updraft · ather.games",
    description: "a spark of Ather rides the rising light · one tap to climb, mind the void — endless flight",
    images: [CARD],
  },
}

export default function UpdraftLayout({ children }: { children: React.ReactNode }) {
  return children
}
