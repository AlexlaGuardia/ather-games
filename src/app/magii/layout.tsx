import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Magii — Athernyx",
  description:
    "Play Magii, a tavern card game of sets and stakes. Four elements, seven runes, twenty truths, one winner.",
};

export default function MagiiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
