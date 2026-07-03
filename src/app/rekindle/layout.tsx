import type { Metadata } from 'next'

// Per-game share metadata — a real title, description, and the card art as the
// OG/Twitter image, so a shared link to this game reads as the game (not the
// generic site card). Server component wrapping the client page; render unchanged.
const CARD = '/rekindle/card.webp'

export const metadata: Metadata = {
  title: "Rekindle",
  description: "route the Ather · relight the dark machines — a cozy conduit puzzle",
  openGraph: {
    title: "Rekindle · ather.games",
    description: "route the Ather · relight the dark machines — a cozy conduit puzzle",
    images: [{ url: CARD, width: 1344, height: 768, alt: "Rekindle" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Rekindle · ather.games",
    description: "route the Ather · relight the dark machines — a cozy conduit puzzle",
    images: [CARD],
  },
}

export default function RekindleLayout({ children }: { children: React.ReactNode }) {
  return children
}
