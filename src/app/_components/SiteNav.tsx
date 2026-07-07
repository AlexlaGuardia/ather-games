"use client";

// SiteNav — the site's one wayfinding affordance. Replaces the ad-hoc trio
// (RoomReturn pill + ArcadeHeaderBack + per-game exits). One button, same corner
// everywhere; tap → a quick-menu drawer whose HERO is game→game hopping (the pain
// that used to bounce you all the way back to the Room to move sideways).
//
// The "hybrid": the breadcrumb lives INSIDE the drawer header (orientation on
// demand) — no always-on bar stealing canvas. The Room stays the scenic front
// door; this is the utility layer beside it. Ruling: GBOARD "SITE NAVIGATION".

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { liveGames, gameById, type GameEntry } from "@/lib/games";
import { getFavs } from "@/lib/favorites";
import { getRecents, pushRecent } from "@/lib/recents";

const GOLD = "#d4a843"; // arcade "furniture" colour — the nav is furniture, fixed across games

type Crumb = { label: string; href?: string; onClick?: () => void };

export default function SiteNav({
  gameId,
  wall,
  gameHome,
  homeLabel,
  soundOn,
  onToggleSound,
  crumbs,
}: {
  /** current game's registry id — records it as "recently played" + labels "you are here" */
  gameId?: string;
  /** which room wall this page sits behind, so "The Room" lands facing the threshold you came through */
  wall?: number;
  /** in-app jump to THIS game's own Home/menu (contextual row; omit when already home or game has no menu) */
  gameHome?: () => void;
  /** label for the game-home row, e.g. "Mana'nana Home" */
  homeLabel?: string;
  /** optional sound state + toggle; row only shows when onToggleSound is provided */
  soundOn?: boolean;
  onToggleSound?: () => void;
  /** override the breadcrumb trail; defaults to Room ▸ Arcade ▸ <game> */
  crumbs?: Crumb[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // re-read local state each open so recents/faves reflect the latest play
  const [recents, setRecents] = useState<GameEntry[]>([]);
  const [favs, setFavs] = useState<GameEntry[]>([]);

  const roomHref = wall === undefined ? "/room" : `/room?wall=${wall}`;

  // record this game as most-recently-played on mount — zero per-game wiring
  useEffect(() => {
    if (gameId) pushRecent(gameId);
  }, [gameId]);

  const refresh = useCallback(() => {
    const resolve = (ids: string[]) =>
      ids.map(gameById).filter((g): g is GameEntry => !!g && g.id !== gameId);
    setRecents(resolve(getRecents()).slice(0, 6));
    setFavs(resolve(getFavs()));
  }, [gameId]);

  const openMenu = () => { refresh(); setOpen(true); };
  const close = () => setOpen(false);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const surprise = () => {
    const skip = new Set([gameId, ...getRecents().slice(0, 3)].filter(Boolean) as string[]);
    const pool = liveGames().filter((g) => !skip.has(g.id));
    const pick = (pool.length ? pool : liveGames().filter((g) => g.id !== gameId));
    if (!pick.length) return;
    const g = pick[Math.floor(Math.random() * pick.length)];
    close();
    router.push(g.href);
  };

  const here = gameId ? gameById(gameId) : undefined;
  const trail: Crumb[] = crumbs ?? [
    { label: "Room", href: roomHref },
    { label: "Arcade", href: "/arcade/all" },
    ...(here ? [{ label: here.title }] : []),
  ];

  return (
    <>
      {/* the one persistent affordance — same corner on every game + hub */}
      <button
        type="button"
        aria-label="Menu — get around the site"
        onClick={openMenu}
        className="fixed top-4 right-4 z-[60] flex items-center gap-2 rounded-md border bg-[#12121e]/80 backdrop-blur px-3 py-2 text-[11px] uppercase tracking-[0.2em] transition"
        style={{ borderColor: `${GOLD}4d`, color: `${GOLD}cc` }}
      >
        <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>☰</span>
        <span className="hidden sm:inline">menu</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Site navigation">
          {/* scrim */}
          <button
            aria-label="Close menu"
            onClick={close}
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            style={{ animation: "sitenav-fade .18s ease-out" }}
          />
          {/* the sheet — slides from the left, full height, scrollable */}
          <nav
            className="gx-chrome absolute right-0 top-0 h-full w-[min(84vw,340px)] overflow-y-auto border-l bg-[#0b0b14]/95 backdrop-blur"
            style={{ borderColor: `${GOLD}33`, animation: "sitenav-slide .22s cubic-bezier(.2,.7,.3,1)" }}
          >
            <div className="flex flex-col gap-5 px-5 py-6">
              {/* breadcrumb — orientation folded into the drawer (the hybrid) */}
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] uppercase tracking-[0.18em]">
                {trail.map((c, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && <span aria-hidden style={{ color: `${GOLD}66` }}>▸</span>}
                    {c.href && i < trail.length - 1 ? (
                      <Link href={c.href} onClick={close} className="transition-colors" style={{ color: `${GOLD}99` }}>{c.label}</Link>
                    ) : (
                      <span style={{ color: i === trail.length - 1 ? "#e8e8f0" : `${GOLD}99` }}>{c.label}</span>
                    )}
                  </span>
                ))}
              </div>

              {/* HERO: jump to a game */}
              <section className="flex flex-col gap-3">
                <h2 className="gx-label text-[10px]" style={{ color: `${GOLD}aa`, letterSpacing: "0.22em" }}>Jump to a game</h2>

                {recents.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] uppercase tracking-[0.18em] text-text-faint/50">Recently played</span>
                    <div className="flex flex-wrap gap-2">
                      {recents.map((g) => (
                        <GameChip key={g.id} g={g} onClick={close} />
                      ))}
                    </div>
                  </div>
                )}

                {favs.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] uppercase tracking-[0.18em] text-text-faint/50">Favorites</span>
                    <div className="flex flex-col gap-1">
                      {favs.map((g) => (
                        <GameRow key={g.id} g={g} onClick={close} />
                      ))}
                    </div>
                  </div>
                )}

                <button type="button" onClick={surprise} className="flex items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-text-dim transition hover:bg-white/5" style={{ color: "#cfcfe0" }}>
                  <span aria-hidden className="w-5 text-center" style={{ color: GOLD }}>⤨</span>
                  <span>Surprise me</span>
                </button>
                <Link href="/arcade/all" onClick={close} className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition hover:bg-white/5" style={{ color: "#cfcfe0" }}>
                  <span aria-hidden className="w-5 text-center" style={{ color: GOLD }}>▦</span>
                  <span>All games</span>
                  <span aria-hidden className="ml-auto text-text-faint/40">→</span>
                </Link>
              </section>

              <div className="h-px w-full" style={{ background: `${GOLD}22` }} />

              {/* destinations */}
              <section className="flex flex-col gap-1">
                {gameHome && (
                  <button type="button" onClick={() => { close(); gameHome(); }} className="flex items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition hover:bg-white/5" style={{ color: "#cfcfe0" }}>
                    <span aria-hidden className="w-5 text-center" style={{ color: GOLD }}>↺</span>
                    <span>{homeLabel ?? `${here?.title ?? "Game"} Home`}</span>
                  </button>
                )}
                <Link href={roomHref} onClick={close} className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition hover:bg-white/5" style={{ color: "#cfcfe0" }}>
                  <span aria-hidden className="w-5 text-center" style={{ color: GOLD }}>⌂</span>
                  <span>The Room</span>
                </Link>
                {onToggleSound && (
                  <button type="button" onClick={onToggleSound} className="flex items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition hover:bg-white/5" style={{ color: "#cfcfe0" }}>
                    <span aria-hidden className="w-5 text-center" style={{ color: GOLD }}>{soundOn ? "🔊" : "🔇"}</span>
                    <span>Sound {soundOn ? "on" : "off"}</span>
                  </button>
                )}
              </section>
            </div>
          </nav>

          <style>{`
            @keyframes sitenav-fade { from { opacity: 0 } to { opacity: 1 } }
            @keyframes sitenav-slide { from { transform: translateX(100%) } to { transform: none } }
          `}</style>
        </div>
      )}
    </>
  );
}

// compact chip for the recents strip — glyph + short name, accent-tinted
function GameChip({ g, onClick }: { g: GameEntry; onClick: () => void }) {
  return (
    <Link
      href={g.href}
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition hover:bg-white/5"
      style={{ borderColor: "#ffffff1f", color: "#dcdcea" }}
    >
      <span aria-hidden style={{ color: GOLD }}>{g.glyph}</span>
      <span className="max-w-[9ch] truncate">{g.title}</span>
    </Link>
  );
}

// full row for favorites — glyph + name + tagline snippet
function GameRow({ g, onClick }: { g: GameEntry; onClick: () => void }) {
  return (
    <Link href={g.href} onClick={onClick} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition hover:bg-white/5">
      <span aria-hidden className="w-5 text-center" style={{ color: GOLD }}>{g.glyph}</span>
      <span className="text-sm" style={{ color: "#dcdcea" }}>{g.title}</span>
    </Link>
  );
}
