import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Magii — Athernyx",
  description:
    "Play Magii, a tavern card game of sets and stakes. Four elements, seven runes, twenty truths, one winner.",
};

export default function MagiiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {/* Step through the Mug door → you're inside the tavern. Full-bleed hearth-lit
          interior, dimmed so the table + UI read on top. Matches room/mug-beyond. */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: "url(/magii/tavern-bg.webp)" }}
      />
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse at 50% 38%, rgba(255,150,60,0.06), transparent 55%)," +
            "linear-gradient(rgba(10,7,4,0.62), rgba(8,5,3,0.78))",
        }}
      />
      {children}
    </div>
  );
}
