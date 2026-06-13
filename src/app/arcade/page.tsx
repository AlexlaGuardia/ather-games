// THE ARCADE — the public games catalog and landing page of ather.games.
// Driven by the games registry: `live` games are playable cards, `coming-soon`
// shows a dimmed teaser, `back-room` games are hidden from the public entirely.

import Link from "next/link";
import { publicGames, type GameEntry } from "@/lib/games";

const STATUS_LABEL: Record<GameEntry["tier"], string> = {
  live: "PLAY",
  "coming-soon": "SOON",
  "back-room": "", // never rendered publicly
};

function GameCard({ g }: { g: GameEntry }) {
  const soon = g.tier === "coming-soon";
  const inner = (
    <>
      <div className="flex items-start justify-between mb-3">
        <span className="text-[#d4a843] text-3xl group-hover:scale-110 transition-transform">{g.glyph}</span>
        <span className="text-[8px] text-text-faint/40 group-hover:text-[#d4a843]/70 font-display tracking-[0.2em] border border-white/[0.07] rounded px-1.5 py-0.5 transition-colors">
          {STATUS_LABEL[g.tier]}
        </span>
      </div>
      <h2 className="font-display text-text text-lg tracking-wider mb-1.5 group-hover:text-[#d4a843] transition-colors">
        {g.title}
      </h2>
      <p className="text-text-faint/60 text-[11px] leading-relaxed">{g.tagline}</p>
      {!soon && (
        <span className="absolute bottom-3 right-4 text-[#d4a843]/0 group-hover:text-[#d4a843]/70 text-sm transition-colors">
          &#8594;
        </span>
      )}
    </>
  );

  const cls =
    "group relative rounded-xl border border-white/[0.06] bg-[#12121e]/70 p-5 transition-all overflow-hidden";

  // coming-soon = dimmed teaser, not playable by the public (owner-preview lands with auth).
  if (soon) {
    return <div className={`${cls} opacity-50 cursor-default`}>{inner}</div>;
  }
  return (
    <Link href={g.href} className={`${cls} hover:border-[#d4a843]/40 hover:bg-[#12121e]`}>
      {inner}
    </Link>
  );
}

export default function ArcadePage() {
  const games = publicGames();
  return (
    <div className="min-h-screen bg-[#08080f] text-text-dim">
      <div className="max-w-[1000px] mx-auto px-5 py-10">
        <header className="mb-8">
          <h1 className="font-display text-[#d4a843] text-2xl tracking-[0.35em] uppercase">The Arcade</h1>
          <p className="text-text-faint/50 text-xs mt-2 font-display tracking-wider">
            everything playable in the Athernyx world · more coming
          </p>
        </header>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((g) => (
            <GameCard key={g.id} g={g} />
          ))}

          {/* the catalog grows */}
          <div className="rounded-xl border border-dashed border-white/[0.06] bg-transparent p-5 flex flex-col items-center justify-center text-center min-h-[140px]">
            <span className="text-text-faint/25 text-2xl mb-2">+</span>
            <p className="text-text-faint/35 text-[10px] font-display tracking-wider">the next game lands here</p>
          </div>
        </div>

        <footer className="mt-10 text-center text-text-faint/25 text-[10px] font-display tracking-wider">
          built in the Akatskii studio · hand-drawn, hand-coded
        </footer>
      </div>
    </div>
  );
}
