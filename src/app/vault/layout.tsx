import type { Metadata } from 'next'

// Per-game share metadata — a real title, description, and the card art as the
// OG/Twitter image, so a shared link to this game reads as the game (not the
// generic site card). Server component wrapping the client page; render unchanged.
const CARD = '/vault/card.webp'

export const metadata: Metadata = {
  title: "Vault",
  description: "a mote of Ather-light runs the greying ground · vault the void's tears, unmake the grey — the crossing",
  openGraph: {
    title: "Vault · ather.games",
    description: "a mote of Ather-light runs the greying ground · vault the void's tears, unmake the grey — the crossing",
    images: [{ url: CARD, width: 1344, height: 768, alt: "Vault" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Vault · ather.games",
    description: "a mote of Ather-light runs the greying ground · vault the void's tears, unmake the grey — the crossing",
    images: [CARD],
  },
}

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return children
}
