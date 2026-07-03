import type { Metadata } from 'next'

// Per-game share metadata — a real title, description, and the card art as the
// OG/Twitter image, so a shared link to this game reads as the game (not the
// generic site card). Server component wrapping the client page; render unchanged.
const CARD = '/dewdrop/card.webp'

export const metadata: Metadata = {
  title: "Dewdrop",
  description: "a wild Dewbear in the Moglins' burrow · gobble the dew, dodge the collar, snap it with a wildbloom — a maze chase",
  openGraph: {
    title: "Dewdrop · ather.games",
    description: "a wild Dewbear in the Moglins' burrow · gobble the dew, dodge the collar, snap it with a wildbloom — a maze chase",
    images: [{ url: CARD, width: 1344, height: 768, alt: "Dewdrop" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Dewdrop · ather.games",
    description: "a wild Dewbear in the Moglins' burrow · gobble the dew, dodge the collar, snap it with a wildbloom — a maze chase",
    images: [CARD],
  },
}

export default function DewdropLayout({ children }: { children: React.ReactNode }) {
  return children
}
