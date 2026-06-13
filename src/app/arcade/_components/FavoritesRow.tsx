// The hub's favorites strip — up to 3 pinned games under the Shimmer hero.
// Empty by default falls back to the live games so the row is never bare.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { gameById, liveGames, tierLabel, type GameEntry } from "@/lib/games";
import { getFavs, MAX_FAVS } from "@/lib/favorites";

function resolveFavs(favIds: string[]): GameEntry[] {
  // Only live games can sit here; pins to a game that isn't live yet are ignored.
  const pinned = favIds.map(gameById).filter((g): g is GameEntry => !!g && g.tier === "live");
  if (pinned.length > 0) return pinned.slice(0, MAX_FAVS);
  // No pins yet → show the live games as a sensible default.
  return liveGames().slice(0, MAX_FAVS);
}

function FavCard({ g }: { g: GameEntry }) {
  return (
    <Link
      href={g.href}
      className="group relative flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#12121e]/60 px-4 py-3 transition-all hover:border-[#d4a843]/40 hover:bg-[#12121e]"
    >
      <span className="text-[#d4a843] text-2xl group-hover:scale-110 transition-transform">{g.glyph}</span>
      <span className="min-w-0">
        <span className="block font-display text-text text-sm tracking-wider group-hover:text-[#d4a843] transition-colors">
          {g.title}
        </span>
        <span className="block text-[9px] text-text-faint/45 font-display tracking-[0.2em]">{tierLabel(g)}</span>
      </span>
    </Link>
  );
}

function EmptySlot() {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.06] px-4 py-3 flex items-center justify-center min-h-[58px]">
      <span className="text-text-faint/30 text-[10px] font-display tracking-wider">pin a game ★</span>
    </div>
  );
}

export default function FavoritesRow() {
  const [favs, setFavs] = useState<string[] | null>(null);
  useEffect(() => setFavs(getFavs()), []);

  // Pre-hydration: render nothing-height-stable placeholder to avoid layout jump.
  const games = favs === null ? liveGames().slice(0, MAX_FAVS) : resolveFavs(favs);
  const slots = [...games, ...Array(Math.max(0, MAX_FAVS - games.length)).fill(null)];

  return (
    <div className="mt-8">
      <p className="text-center text-text-faint/35 text-[10px] font-display tracking-[0.25em] uppercase mb-3">
        favorites
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-[640px] mx-auto">
        {slots.map((g, i) => (g ? <FavCard key={g.id} g={g} /> : <EmptySlot key={`empty-${i}`} />))}
      </div>
    </div>
  );
}
