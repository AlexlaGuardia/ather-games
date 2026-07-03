import type { Metadata } from 'next'

// Per-game share metadata — a real title, description, and the card art as the
// OG/Twitter image, so a shared link to this game reads as the game (not the
// generic site card). Server component wrapping the client page; render unchanged.
const CARD = '/nolmir/card.webp'

export const metadata: Metadata = {
  title: "Nolmir",
  description: "hold the breach · forge the core — an idle Athernyx story",
  openGraph: {
    title: "Nolmir · ather.games",
    description: "hold the breach · forge the core — an idle Athernyx story",
    images: [{ url: CARD, width: 1344, height: 768, alt: "Nolmir" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Nolmir · ather.games",
    description: "hold the breach · forge the core — an idle Athernyx story",
    images: [CARD],
  },
}

export default function NolmirLayout({ children }: { children: React.ReactNode }) {
  return children
}
