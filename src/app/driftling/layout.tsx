import type { Metadata } from 'next'

// Per-game share metadata — a real title, description, and the card art as the
// OG/Twitter image, so a shared link to this game reads as the game (not the
// generic site card). Server component wrapping the client page; render unchanged.
const CARD = '/driftling/card.webp'

export const metadata: Metadata = {
  title: "Driftling",
  description: "a newborn spirit-fish adrift · eat small, flee big, evolve up the food chain — the first bite forks your branch",
  openGraph: {
    title: "Driftling · ather.games",
    description: "a newborn spirit-fish adrift · eat small, flee big, evolve up the food chain — the first bite forks your branch",
    images: [{ url: CARD, width: 1344, height: 768, alt: "Driftling" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Driftling · ather.games",
    description: "a newborn spirit-fish adrift · eat small, flee big, evolve up the food chain — the first bite forks your branch",
    images: [CARD],
  },
}

export default function DriftlingLayout({ children }: { children: React.ReactNode }) {
  return children
}
