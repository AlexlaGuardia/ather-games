import type { Metadata } from 'next'

// Per-game share metadata — a real title, description, and the card art as the
// OG/Twitter image, so a shared link to this game reads as the game (not the
// generic site card). Server component wrapping the client page; render unchanged.
const CARD = '/voranyx/card.webp'

export const metadata: Metadata = {
  title: "Voranyx",
  description: "a worm of Ather-light in the Silt · eat, grow, boost, don't crash — a glowing slither",
  openGraph: {
    title: "Voranyx · ather.games",
    description: "a worm of Ather-light in the Silt · eat, grow, boost, don't crash — a glowing slither",
    images: [{ url: CARD, width: 1344, height: 768, alt: "Voranyx" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Voranyx · ather.games",
    description: "a worm of Ather-light in the Silt · eat, grow, boost, don't crash — a glowing slither",
    images: [CARD],
  },
}

export default function VoranyxLayout({ children }: { children: React.ReactNode }) {
  return children
}
