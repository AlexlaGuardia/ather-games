// THE HUB — the landing of ather.games. Shimmer (the world) is the centered hero,
// flanked by two portal widgets: the Kindled Mug (the tavern → Magii) and the
// Arcade (the full catalog). A favorites strip of up to 3 pinned games sits below.
// The flat catalog grid lives at /arcade/all behind the Arcade widget.

import Link from "next/link";
import { gameById } from "@/lib/games";
import FavoritesRow from "./_components/FavoritesRow";

function PortalWidget({
  href,
  glyph,
  title,
  align,
}: {
  href: string;
  glyph: string;
  title: string;
  align: "left" | "right";
}) {
  // glyph is a placeholder — swap for a pixel-art icon (mug / cabinet) when painted.
  return (
    <Link
      href={href}
      className={`group relative block w-full lg:w-[170px] rounded-xl border border-white/[0.07] bg-[#12121e]/60 backdrop-blur-sm p-4 transition-all hover:border-[#d4a843]/40 hover:bg-[#12121e]/90 ${
        align === "right" ? "lg:text-right" : "lg:text-left"
      }`}
    >
      <span className="block text-[#d4a843] text-3xl mb-2 group-hover:scale-110 transition-transform">{glyph}</span>
      <span className="block font-display text-text text-base tracking-wider group-hover:text-[#d4a843] transition-colors">
        {title}
      </span>
    </Link>
  );
}

function ShimmerHero() {
  const shimmer = gameById("shimmer")!;
  return (
    <div className="relative w-full max-w-[440px] rounded-2xl border border-white/[0.08] bg-[#0e0e16]/70 backdrop-blur-sm px-8 py-12 text-center overflow-hidden">
      {/* inner aura */}
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, rgba(139,92,246,0.14) 0%, transparent 55%), radial-gradient(ellipse at 50% 80%, rgba(212,168,67,0.07) 0%, transparent 50%)",
        }}
      />
      <div className="relative">
        <span className="block text-[#d4a843] text-6xl mb-5 shimmer-hero-glyph">{shimmer.glyph}</span>
        <h1 className="font-display text-text text-4xl tracking-[0.35em] uppercase">Shimmer</h1>
        <span className="inline-block mt-5 text-[9px] text-text-faint/50 font-display tracking-[0.3em] uppercase border border-white/[0.08] rounded-full px-3 py-1">
          Coming Soon
        </span>
      </div>
    </div>
  );
}

export default function HubPage() {
  return (
    <div className="relative min-h-screen bg-void text-text-dim hero-void-glow overflow-hidden">
      <div className="pointer-events-none absolute inset-0 hero-stars opacity-60" />

      <div className="relative max-w-[1000px] mx-auto px-5 py-12">
        {/* wordmark */}
        <header className="text-center mb-8">
          <p className="font-display text-[#d4a843] text-sm tracking-[0.5em] uppercase">Ather · Games</p>
        </header>

        {/* stage: widgets flank the hero */}
        <div className="relative flex flex-col items-center">
          <div className="grid grid-cols-2 w-full gap-3 mb-6 lg:flex lg:justify-between lg:mb-0 lg:absolute lg:inset-x-0 lg:top-0 lg:z-10">
            <PortalWidget href="/magii" glyph="✦" title="Kindled Mug" align="left" />
            <PortalWidget href="/arcade/all" glyph="▦" title="The Arcade" align="right" />
          </div>

          <div className="lg:pt-6 flex justify-center w-full">
            <ShimmerHero />
          </div>
        </div>

        <FavoritesRow />
      </div>
    </div>
  );
}
