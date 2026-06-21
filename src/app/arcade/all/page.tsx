// THE ARCADE (catalog) — the full flat grid of every public game, reached from the
// Arcade widget on the hub. Pin a live game's star to surface it on the hub.

import CatalogGrid from "../_components/CatalogGrid";
import RoomReturn from "../../_components/RoomReturn";
import ArcadeHeaderBack from "../_components/ArcadeHeaderBack";

export default function ArcadeCatalogPage() {
  return (
    <div className="min-h-screen text-text-dim">
      <RoomReturn wall={1} />
      <div className="max-w-[1000px] mx-auto px-5 py-10">
        <header className="gx-chrome mb-8 flex items-center justify-between gap-4 backdrop-blur-[2px] bg-[#08080f]/30 border-b border-[#d4a843]/15">
          <h1 className="gx-label text-[#d4a843] text-2xl" style={{ textShadow: "0 0 18px rgba(212,168,67,0.5)" }}>The Arcade</h1>
          <ArcadeHeaderBack className="gx-label text-text-faint/50 hover:text-[#d4a843] text-[11px] transition-colors whitespace-nowrap" />
        </header>

        <CatalogGrid />
      </div>
    </div>
  );
}
