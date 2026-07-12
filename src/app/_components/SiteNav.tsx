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
import { useCallback, useEffect, useRef, useState } from "react";
import { liveGames, gameById, type GameEntry } from "@/lib/games";
import { getFavs, toggleFav } from "@/lib/favorites";
import { getRecents, pushRecent } from "@/lib/recents";
import { hasSave, saveHint } from "@/lib/saves";
import { getMarks, MARKS_EVENT } from "@/lib/wallet";

const GOLD = "#d4a843"; // arcade "furniture" colour — the nav is furniture, fixed across games
const CLOSE_MS = 170; // must match the sitenav-slide-out duration below

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Focusable descendants, in DOM order. Enough for a drawer of links and buttons. */
const focusables = (root: HTMLElement) =>
  Array.from(
    root.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
  ).filter((el) => el.offsetParent !== null);

export type Crumb = { label: string; href?: string; onClick?: () => void };

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
  // `closing` keeps the drawer mounted for one exit animation. Without it the
  // drawer slid in and then vanished on a hard cut.
  const [closing, setClosing] = useState(false);
  // re-read local state each open so recents/faves reflect the latest play
  const [recents, setRecents] = useState<GameEntry[]>([]);
  const [favs, setFavs] = useState<GameEntry[]>([]);
  const [isFav, setIsFav] = useState(false);
  // the shared Marks balance — live across the whole hub (MARKS_EVENT fires on any
  // earn/spend in any game; storage event catches another tab). The component is
  // always mounted, so the subscription outlives the drawer's open/close.
  const [marks, setMarksBal] = useState(0);
  useEffect(() => {
    const sync = () => setMarksBal(getMarks());
    sync();
    window.addEventListener(MARKS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MARKS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const navRef = useRef<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roomHref = wall === undefined ? "/room" : `/room?wall=${wall}`;

  // record this game as most-recently-played on mount — zero per-game wiring
  useEffect(() => {
    if (gameId) pushRecent(gameId);
  }, [gameId]);

  const refresh = useCallback(() => {
    // Resolve against the JUMPABLE set, not the whole registry. `gameById` happily
    // returns a shelved back-room game (Lucernyx, Gravitar) or a room wall, and its
    // chip then routes into a redirect. localStorage outlives a game's tier, so ids
    // linger here long after the game leaves the lineup. Same pool surprise-me uses.
    const jumpable = new Set(liveGames().map((g) => g.id));
    const resolve = (ids: string[]) =>
      ids
        .map(gameById)
        .filter((g): g is GameEntry => !!g && g.id !== gameId && jumpable.has(g.id));
    setRecents(resolve(getRecents()).slice(0, 6));
    setFavs(resolve(getFavs()));
    setIsFav(!!gameId && getFavs().includes(gameId));
  }, [gameId]);

  // pin/unpin the game you're currently on — Favorites was only reachable from
  // the All Games catalog before; now it's one tap from inside any game.
  const toggleFavHere = () => { if (gameId) { toggleFav(gameId); refresh(); } };

  const openMenu = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setClosing(false);
    refresh();
    setOpen(true);
  };

  // Unmount after the exit animation — but immediately when motion is reduced,
  // so the drawer can never linger for someone who opted out of animation.
  const close = useCallback(() => {
    if (closeTimer.current) return; // already closing; don't queue a second timer
    if (prefersReducedMotion()) { setOpen(false); return; }
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
      closeTimer.current = null;
    }, CLOSE_MS);
  }, []);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // `aria-modal` promises focus lives inside the dialog. It didn't: focus stayed
  // on the page behind, so Tab walked the game instead of the drawer. Move focus
  // in on open, trap Tab, and hand it back to the ☰ button on close.
  useEffect(() => {
    if (!open || closing) return;
    const nav = navRef.current;
    if (!nav) return;
    focusables(nav)[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables(nav);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !nav.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    nav.addEventListener("keydown", onKey);
    return () => nav.removeEventListener("keydown", onKey);
  }, [open, closing]);

  // Restore focus to the opener once the drawer is fully gone — but only if it
  // was actually open. Without the guard this fires on mount and steals focus to
  // the ☰ button on every page load.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) { wasOpen.current = true; return; }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    buttonRef.current?.focus({ preventScroll: true });
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
        ref={buttonRef}
        type="button"
        aria-label="Menu — get around the site"
        aria-expanded={open}
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
            data-sitenav-anim
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            style={{
              animation: closing
                ? `sitenav-fade-out ${CLOSE_MS}ms ease-in forwards`
                : "sitenav-fade .18s ease-out",
            }}
          />
          {/* the sheet — slides in from the right, full height, scrollable */}
          <nav
            ref={navRef}
            data-sitenav-anim
            className="gx-chrome absolute right-0 top-0 h-full w-[min(84vw,340px)] overflow-y-auto border-l bg-[#0b0b14]/95 backdrop-blur"
            style={{
              borderColor: `${GOLD}33`,
              animation: closing
                ? `sitenav-slide-out ${CLOSE_MS}ms cubic-bezier(.4,0,.8,.3) forwards`
                : "sitenav-slide .22s cubic-bezier(.2,.7,.3,1)",
            }}
          >
            <div className="flex flex-col gap-5 px-5 py-6">
              {/* breadcrumb — orientation folded into the drawer (the hybrid) —
                  + a star to pin the current game to Favorites from anywhere */}
              <div className="flex items-start justify-between gap-2">
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
                {here && (
                  <button
                    type="button"
                    onClick={toggleFavHere}
                    aria-pressed={isFav}
                    aria-label={isFav ? `Unpin ${here.title} from favorites` : `Pin ${here.title} to favorites`}
                    title={isFav ? "Pinned to favorites" : "Pin to favorites"}
                    className="-mt-0.5 shrink-0 text-base leading-none transition-transform active:scale-90"
                    style={{ color: isFav ? GOLD : `${GOLD}55` }}
                  >
                    {isFav ? "★" : "☆"}
                  </button>
                )}
              </div>

              {/* the shared purse — Marks, the realm's coin (earned at the games, spent down the Passage) */}
              <div className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs" style={{ borderColor: `${GOLD}33`, background: `${GOLD}0d` }}>
                <span aria-hidden style={{ color: GOLD }}>✶</span>
                <b className="tabular-nums" style={{ color: "#e8e8f0" }}>{marks.toLocaleString()}</b>
                <span className="uppercase tracking-[0.16em] text-[9px]" style={{ color: `${GOLD}99` }}>marks</span>
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
            @keyframes sitenav-fade-out { from { opacity: 1 } to { opacity: 0 } }
            @keyframes sitenav-slide-out { from { transform: none } to { transform: translateX(100%) } }
            /* Reduced motion unmounts immediately (see close()), so these never run —
               but if one somehow does, collapse it rather than animate. */
            @media (prefers-reduced-motion: reduce) {
              [data-sitenav-anim] { animation: none !important }
            }
          `}</style>
        </div>
      )}
    </>
  );
}

// compact chip for the recents strip — glyph + short name, accent-tinted.
// A save-backed game with a live save reads as "Resume": gold-tinted border, a
// trailing ↻, and its progress hint (Node 4 · Quest 5) so the tap says "continue".
function GameChip({ g, onClick }: { g: GameEntry; onClick: () => void }) {
  const resumable = hasSave(g.id);
  const hint = resumable ? saveHint(g.id) : null;
  return (
    <Link
      href={g.href}
      onClick={onClick}
      aria-label={resumable ? `Resume ${g.title}${hint ? ` — ${hint}` : ""}` : g.title}
      className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition hover:bg-white/5"
      style={{ borderColor: resumable ? `${GOLD}66` : "#ffffff1f", color: "#dcdcea" }}
    >
      <span aria-hidden style={{ color: GOLD }}>{g.glyph}</span>
      <span className="max-w-[9ch] truncate">{g.title}</span>
      {resumable && (
        <span aria-hidden className="flex items-center gap-1 pl-0.5" style={{ color: `${GOLD}cc` }}>
          {hint && <span className="text-[9px] tabular-nums tracking-tight opacity-90">{hint}</span>}
          <span className="text-[11px] leading-none">↻</span>
        </span>
      )}
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
