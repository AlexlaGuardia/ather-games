import Link from "next/link";
import Image from "next/image";
import OnlineCount from "./_components/OnlineCount";
import AccountWidget from "./_components/AccountWidget";

// The front door of ather.games (2026-11-13). The open-world game is the hero; the Arcade and
// the Kindled Mug are places INSIDE it (their cards link to where they live today until they move
// in); Eyuun's Bookstore keeps a fixed icon so readers are one tap away from any scroll position.
// The Room (/room) is retired from the front door (Alex 2026-11-14): no nav or footer link.
// Sign-in (Google, one door: first time through creates the account) lives in the top bar.
//
// GAME_TITLE: "Ather", Alex 2026-11-13 (the name and the domain are the same word on purpose).
const GAME_TITLE = "Ather";
// Play lands at HOME: the Ather plot, whose one gate (the Hallway) opens the Wilds and the city doors on the
// continent (2026-11-14). /shimmer/open redirects there too; the old P0 hillside lives at /shimmer/open/hillside.
const PLAY_HREF = "/shimmer/open/ather";
const GOLD = "#d4a843";

const NAV = [
  { label: "Play", href: PLAY_HREF },
  { label: "Devlog", href: "#devlog" },
  { label: "Places", href: "#places" },
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
    blurb: "A floating garden in the Ather that is yours. Grow it square by square.",
    img: "/open/landing-plot.webp",
    href: PLAY_HREF,
  },
];

// Newest first. Plain data on purpose: add a line, ship. Only what Play reaches: the voxel-era lines (the Slack,
// co-op raids, Expeditions) came off 2026-11-14 because the open world is the game now and none of it is in there yet.
const DEVLOG = [
  { date: "2026-11-14", tag: "World", title: "Your plot in the Ather, and one gate to everywhere you have been" },
  { date: "2026-11-14", tag: "World", title: "Drive the whole continent: roads, bridges, ferries, and a tunnel through the spine" },
  { date: "2026-11-13", tag: "World", title: "The open world begins: a first hillside to walk" },
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
      <header className="absolute inset-x-0 top-0 z-40 bg-gradient-to-b from-[#05060e]/70 to-transparent">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4 sm:pr-40">
          <Link href="/" className="font-display text-2xl font-semibold tracking-wide" style={{ color: GOLD }}>
            {GAME_TITLE}
          </Link>
          <div className="hidden gap-5 sm:flex">
            {NAV.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                className="font-[family-name:var(--font-game)] text-xs font-semibold tracking-[0.2em] text-text/80 uppercase transition hover:text-text"
              >
                {n.label}
              </Link>
            ))}
          </div>
          <AccountWidget className="ml-auto" tone="gold" />
        </nav>
      </header>

      {/* ── hero ── */}
      <section className="relative flex min-h-[88svh] items-end overflow-hidden">
        {/* Key art: the home plot, a cloud-walled floating island under the Core (out of frame above; it pours down, it
            is never a disc in the sky). tools/art/gen_landing.py, flux-1.1-pro-ultra (commercial), built to canon. */}
        <Image src="/open/landing-hero.webp" alt="" fill priority sizes="100vw" className="object-cover object-[78%_40%] sm:object-[60%_40%]" />
        {/* Keep the sky a DAY sky: darkening it whole turned the blue to navy and the motes into stars, which canon's
            Ather day never shows. Fade only the bottom into the page; the text carries its own shadow. */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#05060e] from-0% via-[#05060e]/45 via-25% to-transparent to-55%" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05060e]/55 via-[#05060e]/20 via-30% to-transparent to-55%" />
        <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 [text-shadow:0_2px_14px_rgba(5,6,14,0.55)] sm:pb-24">
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
                      <span className="font-[family-name:var(--font-game)] text-xs tracking-[0.3em] text-text/40 uppercase">{p.href ? "Open now" : "Coming to the world"}</span>
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
          <Link href="/arcade" className="hover:text-text/70">All games</Link>
          <Link href="/privacy" className="hover:text-text/70">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
