import type { Metadata } from 'next'

// Per-game share metadata — a real title, description, and the card art as the
// OG/Twitter image, so a shared link to this game reads as the game (not the
// generic site card). Server component wrapping the client page; render unchanged.
const CARD = '/manana/card.webp'

export const metadata: Metadata = {
  title: "Mana'nana",
  description: "match three mana · cascades pay more — a sweet little puzzle",
  openGraph: {
    title: "Mana'nana · ather.games",
    description: "match three mana · cascades pay more — a sweet little puzzle",
    images: [{ url: CARD, width: 1344, height: 768, alt: "Mana'nana" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Mana'nana · ather.games",
    description: "match three mana · cascades pay more — a sweet little puzzle",
    images: [CARD],
  },
}

export default function ManaNanaLayout({ children }: { children: React.ReactNode }) {
  return children
}
