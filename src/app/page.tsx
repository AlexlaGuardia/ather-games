import Link from "next/link";
import Image from "next/image";
import OnlineCount from "./_components/OnlineCount";

// The front door of ather.games (2026-11-13). The open-world game is the hero; the Arcade and
// the Kindled Mug are places INSIDE it (their cards link to where they live today until they move
// in); Eyuun's Bookstore keeps a fixed icon so readers are one tap away from any scroll position.
// The Room (/room) is still reachable, it just isn't the front door any more.
//
// GAME_TITLE: "Ather", Alex 2026-11-13 (the name and the domain are the same word on purpose).
const GAME_TITLE = "Ather";
const PLAY_HREF = "/shimmer/open";
const GOLD = "#d4a843";

const NAV = [
  { label: "Play", href: PLAY_HREF },
  { label: "Devlog", href: "#devlog" },
  { label: "Places", href: "#places" },
  { label: "The Room", href: "/room" },
];

const PLACES = [
  {
    name: "The Kindled Mug",
    kind: "Tavern",
    blurb: "Pull up a bench by the fire. Cards, company, and whoever wanders in.",
    img: "/magii/tavern-bg.webp",
    href: "/magii",
  },
  {
    name: "The Arcade",
    kind: "Cabinets",
    blurb: "A hall of small games. Play them on the cabinets, chase the daily board.",
    img: "/room/arcade-beyond.webp",
    href: "/arcade/all",
  },
  {
    name: "Your Plot",
    kind: "Home",
    blurb: "A piece of land that is yours. Build on it, piece by piece.",
    img: null,
    href: null,
  },
];

// Newest first. Plain data on purpose: add a line, ship.
const DEVLOG = [
  { date: "2026-11-13", tag: "World", title: "The open world begins: a first hillside to walk" },
  { date: "2026-09-30", tag: "Boss", title: "The Slack, rebalanced: lee stones and a Stillwind with a body" },
  { date: "2026-09-29", tag: "Co-op", title: "Raid the Slack together with your party" },
  { date: "2026-09-29", tag: "World", title: "Expeditions: generated mazes, elites, and caches to bring home" },
];

function BookstoreIcon() {
  return (
    <Link
      href="/bookstore?from=home"
      aria-label="Eyuun's Bookstore: listen to the Athernyx books"
      className="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full border px-3 py-2 backdrop-blur-md transition hover:scale-105 sm:top-3 sm:bottom-auto"
      style={{ borderColor: `${GOLD}66`, background: "rgba(5,6,14,0.72)", color: GOLD }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z" />
        <path d="M12 6v13.5" />
      </svg>
      <span className="font-[family-name:var(--font-game)] text-[11px] font-semibold tracking-[0.18em] uppercase">Bookstore</span>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-void text-text">
      <BookstoreIcon />

      {/* ── top bar ── */}
      <header className="absolute inset-x-0 top-0 z-40">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4 sm:pr-40">
          <Link href="/" className="font-display text-2xl font-semibold tracking-wide" style={{ color: GOLD }}>
            {GAME_TITLE}
          </Link>
          <div className="hidden gap-5 sm:flex">
            {NAV.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                className="font-[family-name:var(--font-game)] text-xs font-semibold tracking-[0.2em] text-text/60 uppercase transition hover:text-text"
              >
                {n.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      {/* ── hero ── */}
      <section className="relative flex min-h-[88svh] items-end overflow-hidden">
        <Image src="/room/shimmer-beyond.webp" alt="" fill priority sizes="100vw" className="-scale-x-100 object-cover object-[45%_70%] sm:object-[25%_70%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05060e] via-[#05060e]/45 to-[#05060e]/30" />
        <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 sm:pb-24">
          <p className="font-[family-name:var(--font-game)] text-xs font-semibold tracking-[0.3em] uppercase" style={{ color: GOLD }}>
            An open-world sandbox
          </p>
          <h1 className="font-display mt-3 text-6xl leading-none font-semibold sm:text-8xl">{GAME_TITLE}</h1>
          <p className="mt-5 max-w-xl text-lg text-text/80 sm:text-xl">
            The world is just beginning. Come see it first.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={PLAY_HREF}
              className="font-[family-name:var(--font-game)] rounded-md px-8 py-4 text-base font-bold tracking-[0.2em] text-[#05060e] uppercase shadow-[0_0_40px_rgba(212,168,67,0.35)] transition hover:brightness-110"
              style={{ background: GOLD }}
            >
              Play free
            </Link>
            <Link
              href="#devlog"
              className="font-[family-name:var(--font-game)] rounded-md border px-6 py-4 text-sm font-semibold tracking-[0.2em] text-text/80 uppercase transition hover:text-text"
              style={{ borderColor: `${GOLD}55` }}
            >
              What&apos;s new
            </Link>
            <OnlineCount color={GOLD} />
          </div>
          <p className="mt-6 text-sm text-text/50">
            Latest: <span style={{ color: GOLD }}>{DEVLOG[0].title}.</span>
          </p>
        </div>
      </section>

      {/* ── places inside the world ── */}
      <section id="places" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-16">
        <h2 className="font-[family-name:var(--font-game)] text-xs font-semibold tracking-[0.3em] text-text/50 uppercase">Inside the world</h2>
        <p className="font-display mt-2 text-3xl sm:text-4xl">Places you&apos;ll find</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {PLACES.map((p) => {
            const body = (
              <>
                <div className="relative aspect-[4/3] overflow-hidden">
                  {p.img ? (
                    <Image src={p.img} alt="" fill sizes="(min-width:640px) 33vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_50%_60%,#1b2140,#05060e)]">
                      <span className="font-[family-name:var(--font-game)] text-xs tracking-[0.3em] text-text/40 uppercase">Coming to the world</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#05060e] via-transparent" />
                </div>
                <div className="p-5">
                  <p className="font-[family-name:var(--font-game)] text-[11px] font-semibold tracking-[0.25em] uppercase" style={{ color: GOLD }}>{p.kind}</p>
                  <p className="font-display mt-1 text-2xl">{p.name}</p>
                  <p className="mt-2 text-sm text-text/60">{p.blurb}</p>
                </div>
              </>
            );
            const cls = "group block overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]";
            return p.href ? (
              <Link key={p.name} href={p.href} className={`${cls} transition hover:border-white/25`}>{body}</Link>
            ) : (
              <div key={p.name} className={`${cls} opacity-70`}>{body}</div>
            );
          })}
        </div>
      </section>

      {/* ── devlog ── */}
      <section id="devlog" className="mx-auto max-w-6xl scroll-mt-8 px-4 pb-20">
        <h2 className="font-[family-name:var(--font-game)] text-xs font-semibold tracking-[0.3em] text-text/50 uppercase">Devlog</h2>
        <p className="font-display mt-2 text-3xl sm:text-4xl">What&apos;s new</p>
        <ul className="mt-8 divide-y divide-white/10 border-y border-white/10">
          {DEVLOG.map((d) => (
            <li key={d.title} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6">
              <span className="font-mono text-xs text-text/40 tabular-nums">{d.date}</span>
              <span className="font-[family-name:var(--font-game)] w-20 text-[11px] font-semibold tracking-[0.2em] uppercase" style={{ color: GOLD }}>{d.tag}</span>
              <span className="text-text/85">{d.title}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── footer ── */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 pb-20 text-sm text-text/40 sm:pb-8">
          <span className="font-display" style={{ color: GOLD }}>{GAME_TITLE}</span>
          <Link href="/bookstore?from=home" className="hover:text-text/70">Eyuun&apos;s Bookstore</Link>
          <Link href="/room" className="hover:text-text/70">The Room</Link>
          <Link href="/arcade" className="hover:text-text/70">All games</Link>
          <Link href="/privacy" className="hover:text-text/70">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
