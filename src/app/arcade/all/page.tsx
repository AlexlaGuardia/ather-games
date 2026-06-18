// THE ARCADE (catalog) — the full flat grid of every public game, reached from the
// Arcade widget on the hub. Pin a live game's star to surface it on the hub.

import Link from "next/link";
import CatalogGrid from "../_components/CatalogGrid";

export default function ArcadeCatalogPage() {
  return (
    <div className="min-h-screen bg-[#08080f] text-text-dim">
      <div className="max-w-[1000px] mx-auto px-5 py-10">
        <header className="gx-chrome mb-8 flex items-center justify-between gap-4">
          <h1 className="gx-label text-[#d4a843] text-2xl" style={{ textShadow: "0 0 14px rgba(212,168,67,0.35)" }}>The Arcade</h1>
          <Link
            href="/arcade"
            className="gx-label text-text-faint/50 hover:text-[#d4a843] text-[11px] transition-colors whitespace-nowrap"
          >
            &#8592; hub
          </Link>
        </header>

        <CatalogGrid />
      </div>
    </div>
  );
}
