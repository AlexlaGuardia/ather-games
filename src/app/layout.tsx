import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter, Chakra_Petch } from "next/font/google";
import "./globals.css";
import "./gameui.css";

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
};

export const metadata: Metadata = {
  title: "Ather — Games",
  description: "Playable corners of the Athernyx world. Idle, puzzle, and pixel games.",
  metadataBase: new URL("https://ather.games"),
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  // Public games site — indexable.
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable} ${chakra.variable}`}>
      <body className="min-h-screen bg-void text-text antialiased">
        <main>{children}</main>
      </body>
    </html>
  );
}
