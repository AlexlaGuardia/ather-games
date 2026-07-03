import type { Metadata } from 'next'

// Per-game share metadata — a real title, description, and the card art as the
// OG/Twitter image, so a shared link to this game reads as the game (not the
// generic site card). Server component wrapping the client page; render unchanged.
const CARD = '/ward/card.webp'

export const metadata: Metadata = {
  title: "Ward",
  description: "the void rains on the spires · bloom Ather to hold the line — a vector defense",
  openGraph: {
    title: "Ward · ather.games",
    description: "the void rains on the spires · bloom Ather to hold the line — a vector defense",
    images: [{ url: CARD, width: 1344, height: 768, alt: "Ward" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Ward · ather.games",
    description: "the void rains on the spires · bloom Ather to hold the line — a vector defense",
    images: [CARD],
  },
}

export default function WardLayout({ children }: { children: React.ReactNode }) {
  return children
}
