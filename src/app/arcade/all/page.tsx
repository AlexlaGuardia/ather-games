// THE ARCADE (catalog) — the full flat grid of every public game, reached from the
// Arcade widget on the hub. Pin a live game's star to surface it on the hub.

import Link from "next/link";
import CatalogGrid from "../_components/CatalogGrid";

export default function ArcadeCatalogPage() {
  return (
    <div className="min-h-screen bg-[#08080f] text-text-dim">
      <div className="max-w-[1000px] mx-auto px-5 py-10">
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[#d4a843] text-2xl tracking-[0.35em] uppercase">The Arcade</h1>
            <p className="text-text-faint/50 text-xs mt-2 font-display tracking-wider">
              everything playable in the Athernyx world · pin a ★ to favorite
            </p>
          </div>
          <Link
            href="/arcade"
            className="text-text-faint/50 hover:text-[#d4a843] text-[11px] font-display tracking-[0.2em] uppercase transition-colors whitespace-nowrap"
          >
            &#8592; hub
          </Link>
        </header>

        <CatalogGrid />

        <footer className="mt-10 text-center text-text-faint/25 text-[10px] font-display tracking-wider">
          built in the Akatskii studio · hand-drawn, hand-coded
        </footer>
      </div>
    </div>
  );
}
