import type { Metadata } from 'next'

// Per-game share metadata — a real title, description, and the card art as the
// OG/Twitter image, so a shared link to this game reads as the game (not the
// generic site card). Server component wrapping the client page; render unchanged.
const CARD = '/atherdash/card.webp'

export const metadata: Metadata = {
  title: "Atherdash",
  description: "dash the elemental lanes ahead of the Dying · read the gate, swap in time — a lane-runner",
  openGraph: {
    title: "Atherdash · ather.games",
    description: "dash the elemental lanes ahead of the Dying · read the gate, swap in time — a lane-runner",
    images: [{ url: CARD, width: 1344, height: 768, alt: "Atherdash" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Atherdash · ather.games",
    description: "dash the elemental lanes ahead of the Dying · read the gate, swap in time — a lane-runner",
    images: [CARD],
  },
}

export default function AtherdashLayout({ children }: { children: React.ReactNode }) {
  return children
}
