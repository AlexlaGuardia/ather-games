import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Arcade — Athernyx",
  description:
    "The full hall of Athernyx games. Step under the arch into the arcade and pick a cabinet.",
};

export default function ArcadeHallLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {/* Walk under the Arcade arch → you're standing IN the hall of cabinets.
          Full-bleed hall interior, dimmed so the catalog grid reads on top.
          Matches room/arcade-beyond — the view the arch shows. */}
      <div
        aria-hidden
        className="fixed inset-0 -z-20 bg-cover bg-center"
        style={{ backgroundImage: "url(/arcade/hall-bg.webp)" }}
      />
      {/* Dim + vignette: dark void tint keeps cards legible; a faint gold wash up top
          echoes the ceiling seams so the chrome and the hall read as one space. */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% 0%, rgba(212,168,67,0.07), transparent 60%)," +
            "radial-gradient(ellipse 90% 70% at 50% 120%, rgba(8,8,15,0.85), transparent 70%)," +
            "linear-gradient(rgba(8,8,15,0.55), rgba(8,8,15,0.74))",
        }}
      />
      {children}
    </div>
  );
}
