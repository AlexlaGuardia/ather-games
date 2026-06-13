import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
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
  // PREVIEW: noindex until Alex eyeballs the live site and blesses the launch.
  // Flip both to true at launch (the only change needed to go fully public).
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-void text-text antialiased">
        <main>{children}</main>
      </body>
    </html>
  );
}
