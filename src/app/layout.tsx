import type { Metadata, Viewport } from "next";
import { cormorant, inter } from "@/fonts/site";
import { chakra } from "@/fonts/chakra";
import "./globals.css";
import "./gameui.css";
import SaveOwnerBoot from "./_components/SaveOwnerBoot";
import AnalyticsBoot from "./_components/AnalyticsBoot";

// Fonts are self-hosted (src/fonts, M221). Chakra Petch = the game display face, exposed as
// --font-game for the game-UI layer (gameui.css); see GAME_UI_LAYER.md.

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#05060e", // mobile browser chrome tint
};

export const metadata: Metadata = {
  // default brand title + a template so per-page titles get the brand suffix
  title: {
    default: "Ather: an open world in the Athernyx universe",
    template: "%s · ather.games",
  },
  description: "An open-world sandbox in the Athernyx universe. Walk it, build on it, play it with friends, free in your browser.",
  applicationName: "ather.games",
  metadataBase: new URL("https://ather.games"),
  // icons auto-wired from app/icon.svg, app/apple-icon.png, app/favicon.ico
  openGraph: {
    type: "website",
    siteName: "ather.games",
    title: "Ather: an open world in the Athernyx universe",
    description: "An open-world sandbox in the Athernyx universe. Walk it, build on it, play it with friends, free in your browser.",
    url: "https://ather.games",
    images: [{ url: "/og-ather.png", width: 1200, height: 630, alt: "Ather: a floating island garden in the sky" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ather: an open world in the Athernyx universe",
    description: "An open-world sandbox in the Athernyx universe. Walk it, build on it, play it with friends, free in your browser.",
    images: ["/og-ather.png"],
  },
  // Public games site — indexable.
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable} ${chakra.variable}`}>
      <body className="min-h-screen bg-void text-text antialiased">
        {/* Answers "who is playing" once for the whole site, so the Marks purse is the right
            player's on every page rather than only inside Shimmer's two boot gates. Renders
            nothing; deliberately not a cookie read, which would make every static page dynamic. */}
        <SaveOwnerBoot />
        {/* PostHog pageviews + DOM-layer replay; renders nothing, no-op without a key. */}
        <AnalyticsBoot />
        <main>{children}</main>
      </body>
    </html>
  );
}
