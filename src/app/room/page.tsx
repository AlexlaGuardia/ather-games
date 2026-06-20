"use client";

// ───────────────────────────────────────────────────────────────────
// ROOM — feel-slice v3: first-person room + the DOOR WALK-IN.
// Verbs: TURN (rotateY the room) and APPROACH (dolly the camera into a
// wall). The Mug wall is now a door: approach → swing open → warm light
// → step through to /magii. This is the shared approach spine; the TV
// and shutter will reuse it with a different "arrival tip".
// Throwaway /room; live /arcade untouched. See ROOM_DESIGN.md.
// ───────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Wall = { id: string; label: string; glyph: string; tagline: string; href?: string; accent: string };

const WALLS: Wall[] = [
  { id: "shimmer", label: "Shimmer", glyph: "❈", tagline: "the world", href: "/shimmer", accent: "#8b5cf6" },
  { id: "arcade", label: "The Arcade", glyph: "▦", tagline: "the cabinet", href: "/arcade/all", accent: "#d4a843" },
  { id: "desk", label: "Front Desk", glyph: "✦", tagline: "who you are", accent: "#00cccc" },
  { id: "magii", label: "Kindled Mug", glyph: "❖", tagline: "the tavern", href: "/magii", accent: "#d4a843" },
];

const N = WALLS.length;
const STEP = 360 / N;
const ROOM_R = 600;
const WALL_W = 1200;
const WALL_H = 720;
const PERSP = 720;
const TURN_MS = 420;

// the "stage": we design the room at this fixed resolution, then scale the whole
// thing to fit the real viewport (contain). All px above are in THIS space.
const STAGE_W = 1280;
const STAGE_H = 820;

// the tavern's music, heard muffled through the wall (Magii's own tracks)
const TAVERN_TRACKS = [
  "/magii/audio/balance.mp3",
  "/magii/audio/nebula-hopping.mp3",
  "/magii/audio/wormhole-ride.mp3",
  "/magii/audio/comet-my-space.mp3",
];
const MUG_INDEX = 3; // WALLS[3] = the Kindled Mug

// approach dolly: push the faced wall up until the door fills the view
const ENTER_DOLLY = 900;
const APPROACH_MS = 560;
const DOOR_MS = 460;
const THROUGH_MS = 320;

type Phase = "room" | "approach" | "open" | "through";

export default function RoomPrototype() {
  const router = useRouter();
  const [face, setFace] = useState(0);
  const [phase, setPhase] = useState<Phase>("room");
  const [fit, setFit] = useState(1); // viewport scale (contain)
  const [muted, setMuted] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const reduced = useRef(false);
  const touchX = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // muffled-tavern audio graph: <audio> → lowpass → gain → out
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const startedRef = useRef(false);
  const trackRef = useRef(TAVERN_TRACKS[0]);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // scale off the SMALLER viewport dimension (vmin), not a fixed aspect.
    // contain-against-1280-wide collapsed the room to ~30% on a portrait phone;
    // vmin keeps the faced wall filling the width in either orientation and lets
    // the side walls crop off-screen (you're inside the room — that reads right).
    const refit = () => setFit(Math.min(window.innerWidth, window.innerHeight) / STAGE_H);
    refit();
    window.addEventListener("resize", refit);
    return () => {
      window.removeEventListener("resize", refit);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const inRoom = phase === "room";
  const current = ((face % N) + N) % N;
  const accent = WALLS[current].accent;
  const facedWall = WALLS[current];

  const turn = useCallback((dir: 1 | -1) => {
    setPhase((p) => (p === "room" ? p : p)); // no-op guard; only turn in room
    setFace((f) => f + dir);
  }, []);

  const after = (ms: number, fn: () => void) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  };

  // shared APPROACH spine: dolly to the wall → flourish (open) → step through → route.
  // each wall renders its own flourish keyed on `phase`; the camera/timing is one path.
  const enter = useCallback((wall: Wall) => {
    const dest = wall.href ? `${wall.href}?from=room` : null;
    if (reduced.current) {
      if (dest) router.push(dest);
      else setPhase("open");
      return;
    }
    setPhase("approach");
    after(APPROACH_MS, () => {
      setPhase("open");
      if (!dest) return; // in-place wall (Front Desk): arrive at the desk and stop
      after(DOOR_MS, () => {
        setPhase("through");
        after(THROUGH_MS, () => router.push(dest));
      });
    });
  }, [router]);

  const retreat = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase("room");
  }, []);

  // keys: turn in room; Esc backs out of an approach
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!inRoom) {
        if (e.key === "Escape") retreat();
        return;
      }
      if (e.key === "ArrowRight") turn(1);
      else if (e.key === "ArrowLeft") turn(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inRoom, turn, retreat]);

  // ── muffled tavern audio ──────────────────────────────────────────
  // drive the lowpass cutoff + volume from how much you face/approach the Mug.
  const applyAudio = useCallback(() => {
    const ctx = audioCtxRef.current, flt = filterRef.current, g = gainRef.current;
    if (!ctx || !flt || !g) return;
    // facing factor: 1 = looking straight at the Mug, 0 = turned fully away
    const f = (Math.cos((face - MUG_INDEX) * STEP * (Math.PI / 180)) + 1) / 2;
    const facingMug = ((face % N) + N) % N === MUG_INDEX;
    const p = facingMug ? (phase === "room" ? 0 : phase === "approach" ? 0.55 : 1) : 0;
    // muffled + quiet across the hall; clearer + louder as you face/approach; open at the door
    const base = 320 + f * 380;                  // 320–700 Hz "through a wall"
    const cutoff = base + p * (16000 - base);    // → wide open at the door
    const gFacing = 0.05 + f * 0.17;             // 0.05–0.22 ambient
    const vol = muted ? 0 : gFacing + p * (0.55 - gFacing);
    const t = ctx.currentTime;
    flt.frequency.setTargetAtTime(cutoff, t, 0.18);
    g.gain.setTargetAtTime(vol, t, 0.18);
  }, [face, phase, muted]);

  const startAudio = useCallback(() => {
    if (startedRef.current) return;
    const el = audioElRef.current;
    if (!el) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const src = ctx.createMediaElementSource(el);
    const flt = ctx.createBiquadFilter();
    flt.type = "lowpass";
    flt.frequency.value = 320;
    flt.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(flt);
    flt.connect(g);
    g.connect(ctx.destination);
    audioCtxRef.current = ctx;
    filterRef.current = flt;
    gainRef.current = g;
    el.loop = true;
    el.play().catch(() => {});
    ctx.resume().catch(() => {});
    startedRef.current = true;
    setAudioOn(true);
  }, []);

  // pick a track once, unlock audio on the first interaction, clean up on exit
  useEffect(() => {
    trackRef.current = TAVERN_TRACKS[Math.floor(Math.random() * TAVERN_TRACKS.length)];
    if (audioElRef.current) audioElRef.current.src = trackRef.current;
    const onFirst = () => startAudio();
    window.addEventListener("pointerdown", onFirst, { once: true });
    window.addEventListener("keydown", onFirst, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
      audioCtxRef.current?.close();
    };
  }, [startAudio]);

  // re-aim the filter/volume whenever you turn, approach, mute, or audio starts
  useEffect(() => {
    if (startedRef.current) applyAudio();
  }, [applyAudio, audioOn]);

  const angle = face * STEP;
  // door/TV/arch fill the view (ENTER_DOLLY); the Front Desk approaches GENTLER so the whole
  // composition (profile/settings/news + attendant) stays in frame.
  const enterDolly = facedWall.id === "desk" ? 380 : ENTER_DOLLY;
  const dolly = phase === "room" ? 0 : phase === "through" ? enterDolly + 110 : enterDolly;
  const worldMs = phase === "approach" ? APPROACH_MS : phase === "through" ? THROUGH_MS : TURN_MS;

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-[#0a0a0f] text-[#e2e0ea] select-none"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (!inRoom || touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 45) turn(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <audio ref={audioElRef} preload="auto" loop crossOrigin="anonymous" />

      {/* ambient void fills the WHOLE viewport so the contain-margins aren't dead bars */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 700px at 50% 30%, rgba(139,92,246,0.08), transparent 60%)," +
            "radial-gradient(1400px 800px at 50% 100%, rgba(212,168,67,0.05), transparent 60%)",
        }}
      />

      {/* THE STAGE — fixed design space, scaled uniformly to fit the viewport */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `translate(-50%, -50%) scale(${fit})`,
        }}
      >
        {/* perspective layer (separate from the scale so they don't fight) */}
        <div className="absolute inset-0" style={{ perspective: `${PERSP}px`, perspectiveOrigin: "50% 50%" }}>
          <div
            className="absolute left-1/2 top-1/2 h-0 w-0"
            style={{
              transformStyle: "preserve-3d",
              transform: `translateZ(${dolly}px) rotateY(${angle}deg)`,
              transition: reduced.current ? "none" : `transform ${worldMs}ms cubic-bezier(0.34, 0.02, 0.2, 1)`,
            }}
          >
            <Plane axis="floor" />
            <Plane axis="ceiling" />

            {WALLS.map((w, i) => {
              const isFacing = i === current;
              return (
                <div
                  key={w.id}
                  className="absolute grid place-items-center"
                  style={{
                    width: WALL_W,
                    height: WALL_H,
                    left: -WALL_W / 2,
                    top: -WALL_H / 2,
                    transform: `rotateY(${-i * STEP}deg) translateZ(${-ROOM_R}px)`,
                    backfaceVisibility: "hidden",
                  }}
                >
                  {w.id === "magii" ? (
                    <MugDoor wall={w} active={isFacing} phase={isFacing ? phase : "room"} onEnter={() => enter(w)} />
                  ) : w.id === "shimmer" ? (
                    <ShimmerTV wall={w} active={isFacing} phase={isFacing ? phase : "room"} onEnter={() => enter(w)} />
                  ) : w.id === "arcade" ? (
                    <ArcadeArch wall={w} active={isFacing} phase={isFacing ? phase : "room"} onEnter={() => enter(w)} />
                  ) : w.id === "desk" ? (
                    <DeskWall wall={w} active={isFacing} phase={isFacing ? phase : "room"} onEnter={() => enter(w)} />
                  ) : (
                    <WallFace wall={w} active={isFacing} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── flat HUD (doesn't rotate) ── */}
      <header className="absolute top-6 left-1/2 -translate-x-1/2 z-30 text-center pointer-events-none">
        <p className="text-[#d4a843] text-xs tracking-[0.5em] uppercase">Ather · Games</p>
      </header>

      {/* music toggle — unlocks on first interaction; this just mutes/unmutes */}
      <button
        onClick={() => { startAudio(); setMuted((m) => !m); }}
        aria-label={muted || !audioOn ? "Unmute" : "Mute"}
        className="absolute top-5 right-5 z-40 grid place-items-center w-10 h-10 rounded-md border border-white/10 bg-[#12121e]/70 backdrop-blur text-[#8a879a] transition hover:text-[#d4a843] hover:border-[#d4a843]/40"
      >
        <span className="text-base leading-none">{muted || !audioOn ? "🔇" : "🔊"}</span>
      </button>

      {/* turn affordances — only while in the room */}
      {inRoom && (
        <>
          <TurnBtn side="left" label={WALLS[((current - 1) % N + N) % N].label} onClick={() => turn(-1)} />
          <TurnBtn side="right" label={WALLS[(current + 1) % N].label} onClick={() => turn(1)} />
          <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-30 flex gap-2.5">
            {WALLS.map((w, i) => (
              <button
                key={w.id}
                onClick={() => setFace(face + ((i - current + N + (N >> 1)) % N) - (N >> 1))}
                aria-label={w.label}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === current ? 26 : 8,
                  background: i === current ? accent : "rgba(255,255,255,0.18)",
                  boxShadow: i === current ? `0 0 10px ${accent}` : "none",
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* bulletproof exit — always present once you leave the room */}
      {!inRoom && (
        <button
          onClick={retreat}
          className="absolute top-5 left-5 z-40 flex items-center gap-2 rounded-md border border-white/10 bg-[#12121e]/70 backdrop-blur px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-[#8a879a] transition hover:text-[#d4a843] hover:border-[#d4a843]/40"
        >
          ‹ back to the room
        </button>
      )}

      {/* warm light flooding the WHOLE view as the door opens / steps through */}
      {(phase === "open" || phase === "through") && facedWall.id === "magii" && (
        <div
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            background: "radial-gradient(ellipse at 50% 50%, rgba(212,168,67,0.35), rgba(180,90,30,0.12) 45%, transparent 70%)",
            opacity: phase === "through" ? 1 : 0.7,
            transition: `opacity ${THROUGH_MS}ms ease`,
          }}
        />
      )}

      {/* Shimmer step-through: the screen's light swallows the view, masking the route load */}
      {phase === "through" && facedWall.id === "shimmer" && (
        <div
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            background: "radial-gradient(ellipse at 50% 50%, rgba(220,210,255,0.55), rgba(139,92,246,0.25) 45%, transparent 75%)",
            animation: "none",
          }}
        />
      )}

      {/* Arcade step-through: the hall's multi-colour glow washes over as you cross under the arch */}
      {phase === "through" && facedWall.id === "arcade" && (
        <div
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            background:
              "radial-gradient(ellipse at 40% 55%, rgba(139,92,246,0.30), transparent 60%)," +
              "radial-gradient(ellipse at 60% 45%, rgba(0,255,255,0.22), transparent 60%)," +
              "radial-gradient(ellipse at 50% 50%, rgba(212,168,67,0.30), transparent 70%)",
          }}
        />
      )}
    </div>
  );
}

function Plane({ axis }: { axis: "floor" | "ceiling" }) {
  const depth = ROOM_R * 2;
  const sign = axis === "floor" ? 1 : -1;
  const isFloor = axis === "floor";
  return (
    <div
      className="absolute"
      style={{
        width: WALL_W,
        height: depth,
        left: -WALL_W / 2,
        top: -depth / 2,
        transform: `rotateX(${90 * sign}deg) translateZ(${WALL_H / 2}px)`,
        backgroundColor: "#08080d",
        // floor: the generated compass-rose medallion; ceiling: faint grid for now
        backgroundImage: isFloor
          ? "url(/room/floor.webp)"
          : "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
        backgroundSize: isFloor ? "100% 100%" : "60px 60px",
        WebkitMaskImage: "radial-gradient(ellipse at 50% 50%, #000 25%, transparent 75%)",
        maskImage: "radial-gradient(ellipse at 50% 50%, #000 25%, transparent 75%)",
      }}
    />
  );
}

function TurnBtn({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={`turn ${side}`}
      className={`group absolute top-1/2 -translate-y-1/2 z-30 flex items-center gap-2 ${
        side === "left" ? "left-4" : "right-4 flex-row-reverse"
      }`}
    >
      <span className="grid place-items-center w-11 h-11 rounded-md border border-white/10 bg-[#12121e]/70 backdrop-blur text-xl text-[#8a879a] transition group-hover:text-[#d4a843] group-hover:border-[#d4a843]/40">
        {side === "left" ? "‹" : "›"}
      </span>
      <span
        className={`hidden sm:block max-w-0 overflow-hidden whitespace-nowrap text-[10px] uppercase tracking-[0.25em] text-[#5a576a] opacity-0 transition-all duration-300 group-hover:max-w-[140px] group-hover:opacity-100 ${
          side === "right" ? "text-right" : ""
        }`}
      >
        {label}
      </span>
    </button>
  );
}

// generic wall (Shimmer / Arcade / Desk) — direct link for now
function WallFace({ wall, active }: { wall: Wall; active: boolean }) {
  return (
    <div className="relative w-full h-full grid place-items-center text-center">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 45%, ${wall.accent}1f 0%, transparent 60%)`,
          opacity: active ? 1 : 0.25,
          transition: "opacity 320ms ease",
        }}
      />
      <Seams />
      <div className="relative" style={{ opacity: active ? 1 : 0.4, transition: "opacity 320ms ease" }}>
        <span className="block text-7xl mb-4" style={{ color: wall.accent }}>{wall.glyph}</span>
        <h2 className="text-5xl tracking-[0.3em] uppercase" style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}>
          {wall.label}
        </h2>
        <p className="mt-2 text-xs text-[#8a879a] tracking-[0.3em] uppercase">{wall.tagline}</p>
        {wall.href && active && (
          <Link
            href={wall.href}
            className="mt-7 inline-flex items-center gap-2 rounded-md border px-6 py-2.5 text-sm uppercase tracking-[0.2em] transition"
            style={{ borderColor: `color-mix(in srgb, ${wall.accent} 50%, transparent)`, color: wall.accent }}
          >
            ▶ Enter
          </Link>
        )}
      </div>
    </div>
  );
}

// the Kindled Mug — a door that swings open into warm tavern light
function MugDoor({ wall, active, phase, onEnter }: { wall: Wall; active: boolean; phase: Phase; onEnter: () => void }) {
  const opening = phase === "open" || phase === "through";
  const armed = active && phase === "room";
  return (
    <div className="relative w-full h-full grid place-items-center text-center">
      <Seams />
      {/* door frame — the WHOLE door is the click target when armed */}
      <div
        className={`group/door relative ${armed ? "cursor-pointer" : ""}`}
        style={{ width: 360, height: 540, perspective: 1200 }}
        onClick={armed ? onEnter : undefined}
        role={armed ? "button" : undefined}
        aria-label={armed ? "Open the door to the Kindled Mug" : undefined}
      >
        {/* warm room glimpsed BEHIND the door */}
        <div
          className="absolute inset-0 rounded-t-[140px] overflow-hidden grid place-items-center"
          style={{
            background: "radial-gradient(ellipse at 50% 35%, #f0c46a 0%, #c8842f 38%, #5a2e12 75%, #1a0d06 100%)",
          }}
        >
          <span className="text-6xl mb-6" style={{ color: "#3a1d0a", opacity: opening ? 1 : 0.0, transition: "opacity 300ms ease" }}>
            {wall.glyph}
          </span>
        </div>

        {/* the door leaf (swings inward on its left hinge) */}
        <div
          className="absolute inset-0 rounded-t-[140px] border-2 grid place-items-center"
          style={{
            transformOrigin: "left center",
            transformStyle: "preserve-3d",
            transform: opening ? "rotateY(-108deg)" : "rotateY(0deg)",
            transition: `transform ${DOOR_MS}ms cubic-bezier(0.4, 0.0, 0.2, 1)`,
            background: "linear-gradient(150deg, #2a1c12, #16100a)",
            borderColor: active ? "color-mix(in srgb, #d4a843 45%, transparent)" : "rgba(255,255,255,0.08)",
            boxShadow: active ? "0 0 50px -16px #d4a843, inset 0 0 50px rgba(0,0,0,0.6)" : "inset 0 0 40px rgba(0,0,0,0.5)",
            backfaceVisibility: "hidden",
          }}
        >
          {/* hover lift: whole door brightens when armed */}
          {armed && (
            <div className="pointer-events-none absolute inset-0 rounded-t-[140px] opacity-0 transition-opacity duration-200 group-hover/door:opacity-100" style={{ boxShadow: "0 0 70px -10px #d4a843, inset 0 0 60px rgba(212,168,67,0.12)" }} />
          )}
          {/* plank seams + handle */}
          <div className="absolute inset-3 rounded-t-[120px] border border-[#d4a843]/15" />
          <div className="absolute right-5 top-1/2 -translate-y-1/2 w-2 h-7 rounded-full bg-[#d4a843]/70" />
          <div className="relative" style={{ opacity: active ? 1 : 0.5, transition: "opacity 320ms ease" }}>
            <span className="block text-6xl mb-3" style={{ color: wall.accent }}>{wall.glyph}</span>
            <h2 className="text-3xl tracking-[0.3em] uppercase" style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}>
              {wall.label}
            </h2>
            <p className="mt-2 text-[10px] text-[#8a879a] tracking-[0.3em] uppercase">{wall.tagline}</p>
          </div>
        </div>
      </div>

      {/* warm flicker leaking from under the door even from across the room (ambient) */}
      <div
        className="pointer-events-none absolute bottom-[18%] left-1/2 -translate-x-1/2 w-48 h-6"
        style={{ background: "radial-gradient(ellipse, rgba(212,168,67,0.5), transparent 70%)", filter: "blur(6px)", opacity: active ? 0.8 : 0.35 }}
      />

      {armed && (
        <span className="pointer-events-none absolute bottom-[10%] left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-[#d4a843]/60">
          open the door
        </span>
      )}
    </div>
  );
}

// the Shimmer wall — a screen you power ON. Idle attract-glow across the room,
// CRT turn-on (line expands → full glow → resolve) on approach, then into /shimmer.
function ShimmerTV({ wall, active, phase, onEnter }: { wall: Wall; active: boolean; phase: Phase; onEnter: () => void }) {
  const powering = phase === "open" || phase === "through";
  const armed = active && phase === "room";
  return (
    <div className="relative w-full h-full grid place-items-center text-center">
      <Seams />
      {/* the cabinet / TV */}
      <div
        className={`group/tv relative rounded-2xl border-[10px] ${armed ? "cursor-pointer" : ""}`}
        style={{
          width: 560,
          height: 380,
          borderColor: "#15151f",
          background: "#0c0c12",
          boxShadow: active
            ? `0 0 60px -18px ${wall.accent}, inset 0 0 40px rgba(0,0,0,0.7)`
            : "inset 0 0 40px rgba(0,0,0,0.6)",
          transition: "box-shadow 320ms ease",
        }}
        onClick={armed ? onEnter : undefined}
        role={armed ? "button" : undefined}
        aria-label={armed ? "Turn on the screen — enter Shimmer" : undefined}
      >
        {/* SCREEN */}
        <div className="absolute inset-0 m-1 rounded-lg overflow-hidden" style={{ background: "#050508" }}>
          {/* idle attract glow — alive even when off, brighter when faced */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 45%, ${wall.accent}26 0%, transparent 60%)`,
              opacity: powering ? 0 : active ? 0.9 : 0.3,
              transition: "opacity 320ms ease",
            }}
          />
          {/* attract title (dim ghost when off) */}
          {!powering && (
            <div className="absolute inset-0 grid place-items-center" style={{ opacity: active ? 1 : 0.45, transition: "opacity 320ms ease" }}>
              <div className="shimmer-hero-glyph text-6xl" style={{ color: wall.accent }}>{wall.glyph}</div>
            </div>
          )}

          {/* CRT turn-on: a bright line expands to fill the tube */}
          <div
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2"
            style={{
              height: "100%",
              transformOrigin: "center",
              transform: `scaleY(${powering ? 1 : 0.012})`,
              opacity: phase === "open" ? 1 : phase === "through" ? 0 : 0,
              background: "linear-gradient(0deg, rgba(220,210,255,0.0), rgba(235,230,255,0.95), rgba(220,210,255,0.0))",
              transition: `transform ${DOOR_MS}ms cubic-bezier(0.5,0,0.2,1), opacity ${THROUGH_MS}ms ease`,
            }}
          />
          {/* resolved content after the tube fills (the world, glowing) */}
          <div
            className="absolute inset-0 grid place-items-center"
            style={{
              background: `radial-gradient(ellipse at 50% 45%, ${wall.accent}55 0%, ${wall.accent}14 40%, transparent 75%)`,
              opacity: phase === "through" ? 1 : 0,
              transition: `opacity ${THROUGH_MS}ms ease`,
            }}
          >
            <div className="text-5xl tracking-[0.35em] uppercase" style={{ fontFamily: "Cormorant Garamond, Georgia, serif", color: "#efeaff" }}>
              {wall.label}
            </div>
          </div>

          {/* scanlines over everything (the CRT skin) */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0) 4px)",
              opacity: 0.5,
            }}
          />
          {/* hover bloom when armed */}
          {armed && (
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover/tv:opacity-100" style={{ boxShadow: `inset 0 0 60px ${wall.accent}55` }} />
          )}
        </div>

        {/* standby LED on the bezel */}
        <div className="absolute bottom-2 right-3 w-1.5 h-1.5 rounded-full" style={{ background: active ? wall.accent : "#3a3a44", boxShadow: active ? `0 0 6px ${wall.accent}` : "none" }} />
      </div>

      {/* label below the cabinet */}
      <div className="absolute bottom-[12%] left-1/2 -translate-x-1/2 text-center" style={{ opacity: active ? 1 : 0.4, transition: "opacity 320ms ease" }}>
        <h2 className="text-3xl tracking-[0.3em] uppercase" style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}>{wall.label}</h2>
        {armed && <p className="mt-1 text-[10px] uppercase tracking-[0.3em]" style={{ color: `${wall.accent}99` }}>turn it on</p>}
      </div>
    </div>
  );
}

// the Arcade wall — a grand archway; through it, a hall of glowing cabinets
// receding into the dark. Approach walks you under the arch into /arcade/all.
const CABINETS = [
  { x: 9, y: 64, s: 1.0, c: "#8b5cf6" },
  { x: 22, y: 52, s: 0.68, c: "#d4a843" },
  { x: 32, y: 44, s: 0.46, c: "#4ade80" },
  { x: 91, y: 64, s: 1.0, c: "#00ffff" },
  { x: 78, y: 52, s: 0.68, c: "#f87171" },
  { x: 68, y: 44, s: 0.46, c: "#60a5fa" },
];

function ArcadeArch({ wall, active, phase, onEnter }: { wall: Wall; active: boolean; phase: Phase; onEnter: () => void }) {
  const armed = active && phase === "room";
  return (
    <div className="relative w-full h-full grid place-items-center text-center">
      <Seams />
      <div
        className={`group/arch relative ${armed ? "cursor-pointer" : ""}`}
        style={{ width: 780, height: 660 }}
        onClick={armed ? onEnter : undefined}
        role={armed ? "button" : undefined}
        aria-label={armed ? "Step through the archway into the Arcade" : undefined}
      >
        {/* the hall seen THROUGH the arch (clipped to the arch shape) */}
        <div
          className="absolute overflow-hidden"
          style={{ inset: 16, borderRadius: "384px 384px 8px 8px", background: "radial-gradient(ellipse at 50% 30%, #14142a 0%, #08080f 70%)" }}
        >
          {/* receding floor */}
          <div
            className="absolute left-1/2 bottom-0 w-[160%] h-[55%] -translate-x-1/2 origin-bottom"
            style={{
              transform: "perspective(360px) rotateX(58deg)",
              backgroundColor: "#0a0a14",
              backgroundImage:
                "linear-gradient(rgba(150,140,255,0.12) 1px, transparent 1px)," +
                "linear-gradient(90deg, rgba(150,140,255,0.12) 1px, transparent 1px)",
              backgroundSize: "34px 34px",
              WebkitMaskImage: "linear-gradient(to top, #000 10%, transparent 85%)",
              maskImage: "linear-gradient(to top, #000 10%, transparent 85%)",
            }}
          />
          {/* vanishing-point glow at the back of the hall */}
          <div className="absolute left-1/2 top-[34%] -translate-x-1/2 w-40 h-40 rounded-full" style={{ background: "radial-gradient(circle, rgba(212,168,67,0.25), transparent 70%)", filter: "blur(8px)" }} />
          {/* cabinets flanking the hall, receding */}
          {CABINETS.map((cab, idx) => (
            <div
              key={idx}
              className="absolute"
              style={{ left: `${cab.x}%`, top: `${cab.y}%`, transform: `translate(-50%, -50%) scale(${cab.s})`, width: 64, height: 92, opacity: 0.35 + cab.s * 0.55 }}
            >
              <div className="w-full h-full rounded-md border border-white/10" style={{ background: "linear-gradient(160deg, #1a1a26, #0c0c14)" }} />
              {/* glowing screen */}
              <div
                className="absolute left-1/2 top-3 -translate-x-1/2 w-9 h-7 rounded-sm arcade-attract"
                style={{ background: cab.c, boxShadow: `0 0 12px ${cab.c}`, opacity: 0.85, animationDelay: `${idx * 0.4}s` }}
              />
            </div>
          ))}
          {/* brighten the hall as you cross the threshold */}
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 50% 60%, rgba(212,168,67,0.18), transparent 65%)", opacity: phase === "room" ? 0 : 1, transition: `opacity ${DOOR_MS}ms ease` }}
          />
        </div>

        {/* the arch FRAME — thick bordered ring, interior open to the hall */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            border: "16px solid",
            borderColor: active ? "color-mix(in srgb, #d4a843 40%, #1c1c28)" : "#1c1c28",
            borderRadius: "390px 390px 10px 10px",
            boxShadow: active ? "0 0 50px -16px #d4a843, inset 0 0 40px rgba(0,0,0,0.6)" : "inset 0 0 30px rgba(0,0,0,0.5)",
            transition: "border-color 320ms ease, box-shadow 320ms ease",
          }}
        />
        {/* hover bloom when armed */}
        {armed && (
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover/arch:opacity-100" style={{ borderRadius: "390px 390px 10px 10px", boxShadow: "0 0 70px -8px #d4a843, inset 0 0 50px rgba(212,168,67,0.12)" }} />
        )}
      </div>

      {/* glow spilling from the opening into the room */}
      <div className="pointer-events-none absolute bottom-[14%] left-1/2 -translate-x-1/2 w-56 h-8" style={{ background: "radial-gradient(ellipse, rgba(212,168,67,0.4), transparent 70%)", filter: "blur(8px)", opacity: active ? 0.8 : 0.35 }} />

      <div className="absolute bottom-[9%] left-1/2 -translate-x-1/2 text-center" style={{ opacity: active ? 1 : 0.4, transition: "opacity 320ms ease" }}>
        <h2 className="text-3xl tracking-[0.3em] uppercase" style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}>{wall.label}</h2>
        {armed && <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-[#d4a843]/60">step inside</p>}
      </div>
    </div>
  );
}

// the Front Desk — a greeter at a podium; Profile (top-left), Settings (top-right),
// a News feed (right). In-place UI wall: walk up and interact, no route-out.
const DESK_NEWS = [
  "Atherdash is live — thread the element gates",
  "Lucernyx torch-race retuned",
  "Shimmer party combat in the works",
  "New: the Room hub (you're standing in it)",
];

function DeskWall({ wall, active, phase, onEnter }: { wall: Wall; active: boolean; phase: Phase; onEnter: () => void }) {
  const accent = wall.accent; // cyan
  const armed = active && phase === "room"; // far away → click anywhere to approach
  const arrived = active && phase !== "room"; // at the desk → UI is interactive
  return (
    <div
      className={`relative w-full h-full ${armed ? "cursor-pointer" : ""}`}
      onClick={armed ? onEnter : undefined}
      role={armed ? "button" : undefined}
      aria-label={armed ? "Approach the front desk" : undefined}
    >
      <Seams />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 50% 45%, ${accent}1a 0%, transparent 60%)`, opacity: active ? 1 : 0.25, transition: "opacity 320ms ease" }}
      />

      {/* attendant + podium (decor; clicking it bubbles to approach when armed) */}
      <div className="absolute" style={{ left: "39%", top: "30%", transform: "translate(-50%,0)", opacity: active ? 1 : 0.45, transition: "opacity 320ms ease" }}>
        <div className="relative" style={{ width: 220, height: 270 }}>
          {/* figure */}
          <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 0 }}>
            <div className="relative mx-auto rounded-full" style={{ width: 76, height: 76, background: "linear-gradient(160deg,#1b2630,#0e151b)", border: `1px solid ${accent}66`, boxShadow: `0 0 26px -6px ${accent}` }}>
              <div className="absolute rounded-full" style={{ left: 23, top: 32, width: 7, height: 7, background: accent }} />
              <div className="absolute rounded-full" style={{ right: 23, top: 32, width: 7, height: 7, background: accent }} />
              <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 45, width: 28, height: 14, borderBottom: `2px solid ${accent}`, borderRadius: "0 0 28px 28px" }} />
            </div>
            <div className="mx-auto" style={{ marginTop: -6, width: 158, height: 130, borderRadius: "84px 84px 18px 18px", background: "linear-gradient(160deg,#16202a,#0b1016)", border: `1px solid ${accent}33` }} />
          </div>
          {/* podium in front */}
          <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 0, width: 210 }}>
            <div style={{ width: "100%", height: 22, borderRadius: 8, background: `linear-gradient(180deg, ${accent}33, #0c1218)`, border: `1px solid ${accent}55`, boxShadow: `0 0 26px -8px ${accent}` }} />
            <div className="mx-auto" style={{ marginTop: -2, width: 158, height: 86, background: "linear-gradient(180deg,#121a22,#0a0e13)", border: `1px solid ${accent}22`, borderTop: "none", clipPath: "polygon(7% 0, 93% 0, 100% 100%, 0% 100%)" }} />
          </div>
        </div>
      </div>

      {/* interactive cluster — only live once you've arrived at the desk */}
      <div className="absolute inset-0" style={{ pointerEvents: arrived ? "auto" : "none" }}>
        {/* Profile — top-left */}
        <button
          className="group/pf absolute flex items-center gap-3 rounded-md border px-4 py-3 bg-[#0e1820]/70 backdrop-blur transition"
          style={{ left: "26%", top: "11%", transform: "translate(-50%,0)", borderColor: `${accent}33` }}
          onClick={(e) => { e.stopPropagation(); /* TODO: open profile / sign-in */ }}
        >
          <span className="grid place-items-center rounded-full" style={{ width: 30, height: 30, border: `1px solid ${accent}66`, color: accent }}>☺</span>
          <span className="text-sm uppercase tracking-[0.22em]" style={{ color: "#dfeaf0" }}>Profile</span>
        </button>

        {/* Settings — top-right */}
        <button
          className="absolute grid place-items-center rounded-md border bg-[#0e1820]/70 backdrop-blur transition hover:rotate-45"
          style={{ left: "72%", top: "11%", transform: "translate(-50%,0)", width: 46, height: 46, borderColor: `${accent}33`, color: `${accent}cc`, transitionDuration: "300ms" }}
          aria-label="Settings"
          onClick={(e) => { e.stopPropagation(); /* TODO: open settings */ }}
        >
          <span className="text-2xl leading-none">⚙</span>
        </button>

        {/* News — right side */}
        <div className="absolute rounded-md border p-4 bg-[#0e1820]/70 backdrop-blur" style={{ left: "72%", top: "34%", width: "26%", borderColor: `${accent}33` }}>
          <h3 className="text-lg uppercase tracking-[0.25em] mb-3" style={{ color: accent }}>News</h3>
          <ul className="space-y-2.5 text-left">
            {DESK_NEWS.map((n, i) => (
              <li key={i} className="flex gap-2 text-xs leading-snug text-[#aebfc8]">
                <span style={{ color: accent }}>›</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="absolute bottom-[7%] left-1/2 -translate-x-1/2 text-center" style={{ opacity: active ? 1 : 0.4, transition: "opacity 320ms ease" }}>
        <h2 className="text-3xl tracking-[0.3em] uppercase" style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}>{wall.label}</h2>
        {armed && <p className="mt-1 text-[10px] uppercase tracking-[0.3em]" style={{ color: `${accent}99` }}>approach the desk</p>}
      </div>
    </div>
  );
}

function Seams() {
  return (
    <>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
    </>
  );
}
