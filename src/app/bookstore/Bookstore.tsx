"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  type Book, type Chapter, type WorkGroup,
  bookRuntime, fmtRuntime, fmtClock,
} from "./lib/manifest";

// ── inline icons (ather-games ships no icon lib; Feather-style stroke SVGs) ────
type IconProps = { size?: number; className?: string; style?: React.CSSProperties };
function Svg({ size = 16, className, style, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden>
      {children}
    </svg>
  );
}
const ArrowLeft = (p: IconProps) => <Svg {...p}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></Svg>;
const Play = (p: IconProps) => <Svg {...p}><polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" /></Svg>;
const Pause = (p: IconProps) => <Svg {...p}><rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none" /><rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none" /></Svg>;
const SkipBack = (p: IconProps) => <Svg {...p}><polygon points="19 20 9 12 19 4 19 20" fill="currentColor" stroke="none" /><line x1="5" y1="19" x2="5" y2="5" /></Svg>;
const SkipForward = (p: IconProps) => <Svg {...p}><polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none" /><line x1="19" y1="5" x2="19" y2="19" /></Svg>;
const Gauge = (p: IconProps) => <Svg {...p}><path d="M12 14l4-4" /><circle cx="12" cy="14" r="8" /><path d="M4 14a8 8 0 0116 0" /></Svg>;
const X = (p: IconProps) => <Svg {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>;
const BookOpen = (p: IconProps) => <Svg {...p}><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" /></Svg>;
const Clock = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Svg>;

const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
const RESUME_KEY = "eyuun-bookstore-resume";
const SPEED_KEY = "eyuun-bookstore-speed";

const GOLD = "#d4a843";
const PARCHMENT = "#e7dcc4";

interface ResumeState { bookId: number; chapterN: number; seconds: number }

// ── cover ─────────────────────────────────────────────────────────────────────
function Cover({ book, className = "" }: { book: Book; className?: string }) {
  if (book.cover) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={book.cover} alt={book.title} loading="lazy" className={`object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-[#2a2150] to-[#0b1020] ${className}`}>
      <span className="px-2 text-center text-[10px] leading-tight text-amber-300/60 line-clamp-3">{book.title}</span>
    </div>
  );
}

export default function Bookstore({ groups, fromRoom }: { groups: WorkGroup[]; fromRoom: boolean }) {
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [pos, setPos] = useState(0); // current time (s)
  const [dur, setDur] = useState(0); // audio element duration (s)
  const [resume, setResume] = useState<ResumeState | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seekingRef = useRef(false);

  const allBooks = useMemo(() => groups.flatMap((g) => g.books), [groups]);

  // ── restore persisted speed + resume marker on mount ──────────────────────
  useEffect(() => {
    try {
      const sp = parseFloat(localStorage.getItem(SPEED_KEY) || "1");
      if (SPEEDS.includes(sp)) setRate(sp);
      const r = localStorage.getItem(RESUME_KEY);
      if (r) setResume(JSON.parse(r) as ResumeState);
    } catch { /* ignore */ }
  }, []);

  // ── keep the <audio> element in sync with rate ────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
    try { localStorage.setItem(SPEED_KEY, String(rate)); } catch { /* ignore */ }
  }, [rate, activeChapter]);

  const persistResume = useCallback((bookId: number, chapterN: number, seconds: number) => {
    try {
      const state: ResumeState = { bookId, chapterN, seconds };
      localStorage.setItem(RESUME_KEY, JSON.stringify(state));
      setResume(state);
    } catch { /* ignore */ }
  }, []);

  // ── play a specific chapter of a book ─────────────────────────────────────
  const play = useCallback((book: Book, chapter: Chapter, seekTo = 0) => {
    setActiveBook(book);
    setActiveChapter(chapter);
    setPos(seekTo);
    setDur(chapter.duration_seconds || 0);
    // let the <audio src> swap in, then load + seek + play
    requestAnimationFrame(() => {
      const el = audioRef.current;
      if (!el) return;
      el.playbackRate = rate;
      const start = () => {
        if (seekTo > 0) { try { el.currentTime = seekTo; } catch { /* ignore */ } }
        el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        el.removeEventListener("loadedmetadata", start);
      };
      el.addEventListener("loadedmetadata", start);
      el.load();
    });
  }, [rate]);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el || !activeChapter) return;
    if (el.paused) { el.play().then(() => setPlaying(true)).catch(() => {}); }
    else { el.pause(); setPlaying(false); }
  }, [activeChapter]);

  // step within the active book's chapter list
  const step = useCallback((delta: number) => {
    if (!activeBook || !activeChapter) return;
    const idx = activeBook.chapters.findIndex((c) => c.n === activeChapter.n);
    const next = activeBook.chapters[idx + delta];
    if (next) play(activeBook, next);
  }, [activeBook, activeChapter, play]);

  const cycleSpeed = useCallback(() => {
    setRate((r) => SPEEDS[(SPEEDS.indexOf(r) + 1) % SPEEDS.length] ?? 1);
  }, []);

  // ── audio element event wiring ────────────────────────────────────────────
  const onTime = () => {
    const el = audioRef.current;
    if (!el || seekingRef.current) return;
    setPos(el.currentTime);
    if (activeBook && activeChapter && Math.floor(el.currentTime) % 5 === 0) {
      persistResume(activeBook.id, activeChapter.n, el.currentTime);
    }
  };
  const onLoaded = () => { const el = audioRef.current; if (el) setDur(el.duration || 0); };
  const onEnded = () => {
    // auto-advance to the next chapter; stop cleanly at the end of the book
    if (!activeBook || !activeChapter) return;
    const idx = activeBook.chapters.findIndex((c) => c.n === activeChapter.n);
    const next = activeBook.chapters[idx + 1];
    if (next) play(activeBook, next);
    else { setPlaying(false); try { localStorage.removeItem(RESUME_KEY); } catch { /* ignore */ } setResume(null); }
  };

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current; if (!el) return;
    const t = Number(e.target.value);
    setPos(t);
    try { el.currentTime = t; } catch { /* ignore */ }
  };

  // resume affordance: find the book + chapter behind the saved marker
  const resumeTarget = useMemo(() => {
    if (!resume) return null;
    const book = allBooks.find((b) => b.id === resume.bookId);
    const chapter = book?.chapters.find((c) => c.n === resume.chapterN);
    return book && chapter ? { book, chapter } : null;
  }, [resume, allBooks]);

  const secretsHero = groups.find((g) => g.key === "secrets-of-athernyx")?.books[0] ?? null;
  const shelves = groups.filter((g) => g.key !== "secrets-of-athernyx" || g.books.length > 1);

  const empty = allBooks.length === 0;

  return (
    <div className="min-h-screen bg-void text-[#cdbfa6] pb-32" style={{ background: "radial-gradient(ellipse at 50% -10%, #1a1410 0%, #0b0906 55%, #070504 100%)" }}>
      {/* single audio element, driven by refs */}
      <audio
        ref={audioRef}
        src={activeChapter?.file}
        onTimeUpdate={onTime}
        onLoadedMetadata={onLoaded}
        onEnded={onEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        preload="none"
      />

      {/* ── header ─────────────────────────────────────────────────────── */}
      <header className="mx-auto max-w-5xl px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <Link
            href={fromRoom ? "/room?wall=2" : "/room"}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#8a7d64] transition hover:text-[#cdbfa6]"
            style={{ borderColor: `${GOLD}2a` }}
          >
            <ArrowLeft size={13} /> Room
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.24em] text-[#6b6250]">
            <BookOpen size={12} /> a listening room
          </span>
        </div>
        <div className="mt-6 text-center">
          <h1 className="text-4xl sm:text-5xl" style={{ fontFamily: "var(--font-display)", color: PARCHMENT, letterSpacing: "0.01em" }}>
            Eyuun&apos;s Bookstore
          </h1>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[#8a7d64]" style={{ fontFamily: "var(--font-display)" }}>
            Pull a book from the shelf and let it read to you. The tales of the Ather, narrated.
          </p>
        </div>
      </header>

      {empty && (
        <div className="mx-auto max-w-md px-5 py-24 text-center text-[#8a7d64]">
          <p style={{ fontFamily: "var(--font-display)" }} className="text-lg">The shelves are being stocked.</p>
          <p className="mt-2 text-[12px]">Come back soon — the narrations are on their way.</p>
        </div>
      )}

      {/* ── resume ribbon ─────────────────────────────────────────────── */}
      {resumeTarget && (!activeChapter) && (
        <div className="mx-auto max-w-5xl px-5">
          <button
            onClick={() => play(resumeTarget.book, resumeTarget.chapter, resume?.seconds ?? 0)}
            className="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition hover:-translate-y-0.5"
            style={{ borderColor: `${GOLD}33`, background: "#120d0733" }}
          >
            <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full" style={{ background: `${GOLD}1f` }}>
              <Play size={15} style={{ color: GOLD }} />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] uppercase tracking-[0.2em] text-[#8a7d64]">Continue listening</span>
              <span className="block truncate text-[13px] text-[#cdbfa6]">{resumeTarget.book.title} · {resumeTarget.chapter.title}</span>
            </span>
          </button>
        </div>
      )}

      {/* ── Secrets hero — Eyuun's own book, the front of his store ─────── */}
      {secretsHero && (
        <section className="mx-auto max-w-5xl px-5 pt-6">
          <HeroBook book={secretsHero} onPlay={play} active={activeBook?.id === secretsHero.id} activeChapterN={activeBook?.id === secretsHero.id ? activeChapter?.n : undefined} />
        </section>
      )}

      {/* ── shelves ────────────────────────────────────────────────────── */}
      {shelves.map((g) => (
        <section key={g.key} className="mx-auto max-w-5xl px-5 pt-10">
          {/* Secrets is already the hero; only render its shelf label when >1 volume */}
          {g.key === "secrets-of-athernyx" ? null : (
            <ShelfHeader label={g.label} count={g.books.length} />
          )}
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4">
            {g.books.map((b) => (
              <ShelfBook
                key={b.id}
                book={b}
                onPlay={play}
                active={activeBook?.id === b.id}
                activeChapterN={activeBook?.id === b.id ? activeChapter?.n : undefined}
              />
            ))}
          </div>
        </section>
      ))}

      {/* ── persistent player bar ──────────────────────────────────────── */}
      {activeChapter && activeBook && (
        <PlayerBar
          book={activeBook}
          chapter={activeChapter}
          playing={playing}
          pos={pos}
          dur={dur || activeChapter.duration_seconds}
          rate={rate}
          onToggle={togglePlay}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onScrubStart={() => (seekingRef.current = true)}
          onScrub={onScrub}
          onScrubEnd={() => (seekingRef.current = false)}
          onSpeed={cycleSpeed}
          onClose={() => { audioRef.current?.pause(); setPlaying(false); setActiveChapter(null); setActiveBook(null); }}
        />
      )}
    </div>
  );
}

// ── shelf header ───────────────────────────────────────────────────────────────
function ShelfHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 className="text-2xl" style={{ fontFamily: "var(--font-display)", color: PARCHMENT }}>{label}</h2>
      <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${GOLD}33, transparent)` }} />
      <span className="text-[10px] uppercase tracking-[0.2em] text-[#6b6250]">{count} {count === 1 ? "book" : "books"}</span>
    </div>
  );
}

// ── Secrets hero card ──────────────────────────────────────────────────────────
function HeroBook({ book, onPlay, active, activeChapterN }: {
  book: Book; onPlay: (b: Book, c: Chapter) => void; active: boolean; activeChapterN?: number;
}) {
  const [open, setOpen] = useState(false);
  const runtime = fmtRuntime(bookRuntime(book));
  return (
    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: `${GOLD}2e`, background: "linear-gradient(135deg, #14100a 0%, #0d0a06 100%)" }}>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
        <div className="mx-auto w-40 flex-shrink-0 sm:mx-0 sm:w-44">
          <Cover book={book} className="aspect-[2/3] w-full rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.6)]" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-[0.24em]" style={{ color: GOLD }}>The Main Line · Eyuun narrates</span>
          <h3 className="mt-1 text-3xl leading-tight" style={{ fontFamily: "var(--font-display)", color: PARCHMENT }}>{book.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#8a7d64]">
            <span className="inline-flex items-center gap-1"><BookOpen size={12} /> {book.chapters.length} chapters</span>
            <span className="inline-flex items-center gap-1"><Clock size={12} /> {runtime}</span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => onPlay(book, book.chapters[0])}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-[12px] font-medium uppercase tracking-[0.16em] transition hover:brightness-110"
              style={{ background: GOLD, color: "#1a1206" }}
            >
              <Play size={15} /> {active ? "Now playing" : "Start listening"}
            </button>
            <button
              onClick={() => setOpen((o) => !o)}
              className="text-[11px] uppercase tracking-[0.18em] text-[#8a7d64] transition hover:text-[#cdbfa6]"
            >
              {open ? "Hide chapters" : "Chapters"}
            </button>
          </div>
        </div>
      </div>
      {open && (
        <div className="border-t px-5 pb-4 pt-3 sm:px-6" style={{ borderColor: `${GOLD}1a` }}>
          <ChapterList book={book} onPlay={onPlay} activeChapterN={active ? activeChapterN : undefined} />
        </div>
      )}
    </div>
  );
}

// ── shelf book (cover → expands chapter drawer) ─────────────────────────────────
function ShelfBook({ book, onPlay, active, activeChapterN }: {
  book: Book; onPlay: (b: Book, c: Chapter) => void; active: boolean; activeChapterN?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="group">
      <button
        onClick={() => setOpen((o) => !o)}
        className="block w-full text-left"
        aria-label={`${book.title} — open chapters`}
      >
        <div className="comic-cover-glow overflow-hidden rounded-lg" style={active ? { boxShadow: `0 0 0 2px ${GOLD}, 0 8px 30px rgba(0,0,0,0.5)` } : undefined}>
          <Cover book={book} className="aspect-[2/3] w-full" />
        </div>
        <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-[#cdbfa6]" style={{ fontFamily: "var(--font-display)" }}>{book.title}</p>
        <p className="text-[10px] text-[#6b6250]">{book.chapters.length} ch · {fmtRuntime(bookRuntime(book))}</p>
      </button>
      {open && (
        <div className="col-span-full mt-2 rounded-lg border p-3" style={{ borderColor: `${GOLD}1f`, background: "#0d0a0699" }}>
          <ChapterList book={book} onPlay={onPlay} activeChapterN={active ? activeChapterN : undefined} compact />
        </div>
      )}
    </div>
  );
}

// ── chapter list ────────────────────────────────────────────────────────────────
function ChapterList({ book, onPlay, activeChapterN, compact }: {
  book: Book; onPlay: (b: Book, c: Chapter) => void; activeChapterN?: number; compact?: boolean;
}) {
  return (
    <ul className={compact ? "space-y-0.5" : "grid gap-x-6 gap-y-0.5 sm:grid-cols-2"}>
      {book.chapters.map((c) => {
        const on = c.n === activeChapterN;
        return (
          <li key={c.n}>
            <button
              onClick={() => onPlay(book, c)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition hover:bg-white/5"
              style={on ? { background: `${GOLD}1a` } : undefined}
            >
              <Play size={12} style={{ color: on ? GOLD : "#6b6250" }} className="flex-shrink-0" />
              <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: on ? PARCHMENT : "#a89b81" }}>{c.title}</span>
              <span className="flex-shrink-0 text-[10px] tabular-nums text-[#6b6250]">{fmtClock(c.duration_seconds)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ── persistent player bar ────────────────────────────────────────────────────────
function PlayerBar({
  book, chapter, playing, pos, dur, rate,
  onToggle, onPrev, onNext, onScrubStart, onScrub, onScrubEnd, onSpeed, onClose,
}: {
  book: Book; chapter: Chapter; playing: boolean; pos: number; dur: number; rate: number;
  onToggle: () => void; onPrev: () => void; onNext: () => void;
  onScrubStart: () => void; onScrub: (e: React.ChangeEvent<HTMLInputElement>) => void; onScrubEnd: () => void;
  onSpeed: () => void; onClose: () => void;
}) {
  const idx = book.chapters.findIndex((c) => c.n === chapter.n);
  const hasPrev = idx > 0;
  const hasNext = idx < book.chapters.length - 1;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur-md"
      style={{ borderColor: `${GOLD}22`, background: "#0b0906f2", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto max-w-5xl px-4 py-2.5">
        {/* scrubber */}
        <div className="flex items-center gap-2">
          <span className="w-9 text-right text-[10px] tabular-nums text-[#6b6250]">{fmtClock(pos)}</span>
          <input
            type="range" min={0} max={Math.max(dur, 1)} step={1} value={Math.min(pos, dur || 1)}
            onMouseDown={onScrubStart} onTouchStart={onScrubStart}
            onChange={onScrub}
            onMouseUp={onScrubEnd} onTouchEnd={onScrubEnd}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full"
            style={{ background: `linear-gradient(90deg, ${GOLD} ${(Math.min(pos, dur || 1) / (dur || 1)) * 100}%, #3a3327 ${(Math.min(pos, dur || 1) / (dur || 1)) * 100}%)` }}
            aria-label="Seek"
          />
          <span className="w-9 text-[10px] tabular-nums text-[#6b6250]">{fmtClock(dur)}</span>
        </div>
        {/* controls row */}
        <div className="mt-1.5 flex items-center gap-3">
          <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded">
            <Cover book={book} className="h-full w-full" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] text-[#cdbfa6]" style={{ fontFamily: "var(--font-display)" }}>{chapter.title}</p>
            <p className="truncate text-[10px] text-[#6b6250]">{book.title}</p>
          </div>
          <button onClick={onPrev} disabled={!hasPrev} className="p-1.5 text-[#a89b81] transition enabled:hover:text-[#cdbfa6] disabled:opacity-25" aria-label="Previous chapter"><SkipBack size={18} /></button>
          <button onClick={onToggle} className="grid h-11 w-11 place-items-center rounded-full transition hover:brightness-110" style={{ background: GOLD, color: "#1a1206" }} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button onClick={onNext} disabled={!hasNext} className="p-1.5 text-[#a89b81] transition enabled:hover:text-[#cdbfa6] disabled:opacity-25" aria-label="Next chapter"><SkipForward size={18} /></button>
          <button onClick={onSpeed} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] tabular-nums text-[#a89b81] transition hover:text-[#cdbfa6]" style={{ borderColor: `${GOLD}2a` }} aria-label="Playback speed">
            <Gauge size={13} /> {rate}×
          </button>
          <button onClick={onClose} className="hidden p-1.5 text-[#6b6250] transition hover:text-[#cdbfa6] sm:block" aria-label="Close player"><X size={17} /></button>
        </div>
      </div>
    </div>
  );
}
