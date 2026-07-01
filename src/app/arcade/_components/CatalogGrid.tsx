// The full games catalog — every public game as a card. Live cards are links and
// carry a pin/star to favorite them onto the hub; coming-soon are dimmed teasers.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { publicGames, tierLabel, type GameEntry } from "@/lib/games";
import { getFavs, toggleFav } from "@/lib/favorites";

// Games with generated card art (public/<id>/card.webp) — canon briefs in world/arcade.md.
const CARD_ART = new Set(["rekindle", "voranyx", "lucernyx", "manana", "ward", "seedfall", "updraft", "magii", "nolmir", "atherdash", "driftling", "squall", "dewdrop", "vault"]);

function PinButton({ id, favs, onToggle }: { id: string; favs: string[]; onToggle: (id: string) => void }) {
  const pinned = favs.includes(id);
  return (
    <button
      type="button"
      aria-label={pinned ? "Unpin from hub" : "Pin to hub"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(id);
      }}
      className={`absolute top-3 right-3 z-20 text-base leading-none transition-colors ${
        pinned ? "text-[#d4a843]" : "text-text-faint/30 hover:text-[#d4a843]/70"
      }`}
    >
      {pinned ? "★" : "☆"}
    </button>
  );
}

function CatalogCard({ g, favs, onToggle }: { g: GameEntry; favs: string[]; onToggle: (id: string) => void }) {
  const soon = g.tier === "coming-soon";
  // gx-card + gx-scan = the game-UI plate (framed, scanline texture); see GAME_UI_LAYER.md
  const cls = "group gx-card gx-scan p-5 min-h-[140px]";

  // Dimmed card-art backdrop (negative-z so text stays readable + the link stays clickable).
  const art = CARD_ART.has(g.id) ? (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/${g.id}/card.webp`}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50 transition-opacity duration-300 group-hover:opacity-[0.65]"
      />
      <div className="absolute inset-0 -z-10 bg-[#0d0d16]/55" />
    </>
  ) : null;

  const body = (
    <>
      <div className="flex items-start justify-between mb-3">
        <span className="text-[#d4a843] text-3xl group-hover:scale-110 transition-transform">{g.glyph}</span>
        <span className="gx-label text-[8px] text-text-faint/45 group-hover:text-[#d4a843]/80 border border-[#d4a843]/15 rounded-[2px] px-1.5 py-0.5 transition-colors mr-6">
          {tierLabel(g)}
        </span>
      </div>
      <h2 className="gx-title text-text text-lg mb-1.5 group-hover:text-[#d4a843] transition-colors">
        {g.title}
      </h2>
      <p className="text-text-faint/60 text-[11px] leading-relaxed">{g.tagline}</p>
    </>
  );

  if (soon) {
    return <div className={`${cls} opacity-50 cursor-default`}>{art}{body}</div>;
  }
  return (
    <div className={`${cls} is-interactive`}>
      {art}
      <PinButton id={g.id} favs={favs} onToggle={onToggle} />
      <Link href={g.href} className="absolute inset-0 z-10" aria-label={g.title} />
      {body}
      <span className="absolute bottom-3 right-4 text-[#d4a843]/0 group-hover:text-[#d4a843]/70 text-sm transition-colors">
        &#8594;
      </span>
    </div>
  );
}

export default function CatalogGrid() {
  const games = publicGames();
  const [favs, setFavs] = useState<string[]>([]);
  useEffect(() => setFavs(getFavs()), []);
  const onToggle = (id: string) => setFavs(toggleFav(id));

  return (
    <div className="gx-chrome grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {games.map((g) => (
        <CatalogCard key={g.id} g={g} favs={favs} onToggle={onToggle} />
      ))}
      <div className="rounded-[3px] border border-dashed border-white/[0.07] bg-transparent p-5 flex flex-col items-center justify-center text-center min-h-[140px]">
        <span className="text-text-faint/25 text-2xl mb-2">+</span>
        <p className="gx-label text-text-faint/35 text-[10px]">the next game lands here</p>
      </div>
    </div>
  );
}
