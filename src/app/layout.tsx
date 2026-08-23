import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter, Chakra_Petch } from "next/font/google";
import "./globals.css";
import "./gameui.css";
import SaveOwnerBoot from "./_components/SaveOwnerBoot";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

// the squared, industrial game display face — Eurostile's free cousin. Exposed as
// --font-game for the game-UI layer (gameui.css); does NOT change anything until a
// .gx-title/.gx-label opts in. See GAME_UI_LAYER.md.
const chakra = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-game",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#05060e", // mobile browser chrome tint
};

export const metadata: Metadata = {
  // default brand title + a template so per-page titles get the brand suffix
  title: {
    default: "ather.games — the Athernyx arcade",
    template: "%s · ather.games",
  },
  description: "Playable corners of the Athernyx world — an arcade of original games.",
  applicationName: "ather.games",
  metadataBase: new URL("https://ather.games"),
  // icons auto-wired from app/icon.svg, app/apple-icon.png, app/favicon.ico
  openGraph: {
    type: "website",
    siteName: "ather.games",
    title: "ather.games — the Athernyx arcade",
    description: "Playable corners of the Athernyx world — an arcade of original games.",
    url: "https://ather.games",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "ather.games" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ather.games — the Athernyx arcade",
    description: "Playable corners of the Athernyx world — an arcade of original games.",
    images: ["/og.png"],
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
        <main>{children}</main>
      </body>
    </html>
  );
}
