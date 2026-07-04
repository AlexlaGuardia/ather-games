import type { Metadata } from "next";

// Per-surface share metadata — Eyuun's Bookstore reads as itself when shared, with
// the Secrets of Athernyx cover as the card art. Server component wrapping the client
// page; renders unchanged.
const COVER = "https://akatskii.com/listen/secrets-of-athernyx-1-cover.png";
const DESC = "A listening room for the tales of the Ather — the Athernyx books, narrated. Pull one from the shelf and let it read to you.";

export const metadata: Metadata = {
  title: "Eyuun's Bookstore",
  description: DESC,
  openGraph: {
    title: "Eyuun's Bookstore · ather.games",
    description: DESC,
    images: [{ url: COVER, alt: "Eyuun's Bookstore" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Eyuun's Bookstore · ather.games",
    description: DESC,
    images: [COVER],
  },
};

export default function BookstoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
