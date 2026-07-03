import type { Metadata } from 'next'

// Per-game share metadata — a real title, description, and the card art as the
// OG/Twitter image, so a shared link to this game reads as the game (not the
// generic site card). Server component wrapping the client page; render unchanged.
const CARD = '/seedfall/card.webp'

export const metadata: Metadata = {
  title: "Seedfall",
  description: "guide a Mana Seed down the wind · land it soft to plant — a cozy descent",
  openGraph: {
    title: "Seedfall · ather.games",
    description: "guide a Mana Seed down the wind · land it soft to plant — a cozy descent",
    images: [{ url: CARD, width: 1344, height: 768, alt: "Seedfall" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Seedfall · ather.games",
    description: "guide a Mana Seed down the wind · land it soft to plant — a cozy descent",
    images: [CARD],
  },
}

export default function SeedfallLayout({ children }: { children: React.ReactNode }) {
  return children
}
