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
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getHubAudio } from "@/lib/hub-audio";

type Wall = { id: string; label: string; glyph: string; tagline: string; href?: string; accent: string };

const WALLS: Wall[] = [
  { id: "shimmer", label: "Shimmer", glyph: "❈", tagline: "the world", href: "/shimmer/play3d", accent: "#8b5cf6" },
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

// The tavern's music (Magii's own tracks) lives in the shared hub-audio service
// so the SAME element/playhead carries through the door into /magii. See lib/hub-audio.ts.
const MUG_INDEX = 3; // WALLS[3] = the Kindled Mug

// approach dolly: push the faced wall up until the door fills the view
const ENTER_DOLLY = 900;
const APPROACH_MS = 560;
const DOOR_MS = 460;
const THROUGH_MS = 320;

type Phase = "room" | "approach" | "open" | "through";

export default function RoomPrototype() {
  const router = useRouter();
  // ?wall=N deep-links a faced wall (also lets headless screenshots target a wall with no turn animation)
  const [face, setFace] = useState(() => {
    if (typeof window === "undefined") return 0;
    const w = new URLSearchParams(window.location.search).get("wall");
    return w !== null && !Number.isNaN(Number(w)) ? Number(w) : 0;
  });
  const [phase, setPhase] = useState<Phase>("room");
  const [fit, setFit] = useState(1); // viewport scale (contain)
  const reduced = useRef(false);
  const touchX = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // muffled-tavern audio lives in the shared hub service (survives the route into /magii)
  const hub = getHubAudio();
  const muted = useSyncExternalStore(hub.subscribe, () => hub.muted, () => false);
  const audioOn = useSyncExternalStore(hub.subscribe, () => hub.isStarted, () => false);

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

  // ── muffled tavern audio (shared hub bed) ─────────────────────────
  // drive the lowpass cutoff + volume from how much you face/approach the Mug.
  // The bed is the SAME track that plays in /magii — opening the door swells it,
  // and crossing the threshold carries it through (hub survives the route change).
  const startAudio = useCallback(() => getHubAudio().start(), []);

  const applyAudio = useCallback(() => {
    const f = (Math.cos((face - MUG_INDEX) * STEP * (Math.PI / 180)) + 1) / 2; // 1 = facing Mug
    const facingMug = ((face % N) + N) % N === MUG_INDEX;
    // approaching a wall that ISN'T the tavern → fade the bed out (we're leaving it behind).
    const leaving = phase !== "room" && !facingMug;
    const p = facingMug ? (phase === "room" ? 0 : phase === "approach" ? 0.55 : 1) : 0;
    const base = 320 + f * 380;                  // 320–700 Hz "through a wall"
    const cutoff = base + p * (16000 - base);    // → wide open at the door
    const gFacing = 0.05 + f * 0.17;             // 0.05–0.22 ambient
    const vol = leaving ? 0 : gFacing + p * (0.55 - gFacing);
    getHubAudio().tune(cutoff, vol);
  }, [face, phase]);

  // unlock audio on the first interaction (autoplay policy)
  useEffect(() => {
    const onFirst = () => startAudio();
    window.addEventListener("pointerdown", onFirst, { once: true });
    window.addEventListener("keydown", onFirst, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
    };
  }, [startAudio]);

  // re-aim the filter/volume whenever you turn, approach, mute, or audio starts
  useEffect(() => {
    if (audioOn) applyAudio();
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
                    // shared dressed-stone wall — same surface on all four sides so the
                    // room reads continuous; features mount on top of it.
                    backgroundColor: "#08080d",
                    backgroundImage: "url(/room/wall.webp)",
                    backgroundSize: "100% 100%",
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

      {/* drifting dust motes — room-wide ambient life over the whole viewport */}
      <DustMotes />

      {/* music toggle — unlocks on first interaction; this just mutes/unmutes */}
      <button
        onClick={() => { const h = getHubAudio(); h.start(); h.toggleMuted(); }}
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
        // floor: dressed-stone w/ inlaid compass medallion; ceiling: dark timber beams.
        // both humble dark stone to match the walls and recede (they're grazed by the camera).
        backgroundImage: isFloor ? "url(/room/floor.webp)" : "url(/room/ceiling.webp)",
        backgroundSize: "100% 100%",
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
        style={{ width: 360, height: 540, perspective: 1200, transform: "translateY(84px)" }}
        onClick={armed ? onEnter : undefined}
        role={armed ? "button" : undefined}
        aria-label={armed ? "Open the door to the Kindled Mug" : undefined}
      >
        {/* warm tavern interior glimpsed BEHIND the door */}
        <div
          className="absolute inset-0 rounded-t-[140px] overflow-hidden"
          style={{
            backgroundImage: "url(/room/mug-beyond.webp)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundColor: "#1a0d06",
          }}
        />
        {/* firelight warming when the door is open */}
        <div
          className="pointer-events-none absolute inset-0 rounded-t-[140px]"
          style={{
            background: "radial-gradient(ellipse at 50% 60%, rgba(240,180,90,0.35), transparent 70%)",
            opacity: opening ? 1 : 0,
            transition: "opacity 300ms ease",
          }}
        />

        {/* the door leaf (swings inward on its left hinge) */}
        <div
          className="absolute inset-0 rounded-t-[140px] border-2 grid place-items-center"
          style={{
            transformOrigin: "left center",
            transformStyle: "preserve-3d",
            transform: opening ? "rotateY(-108deg)" : "rotateY(0deg)",
            transition: `transform ${DOOR_MS}ms cubic-bezier(0.4, 0.0, 0.2, 1)`,
            backgroundImage: "url(/room/mug-leaf.webp)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundColor: "#16100a",
            borderColor: active ? "color-mix(in srgb, #d4a843 45%, transparent)" : "rgba(255,255,255,0.08)",
            boxShadow: active ? "0 0 50px -16px #d4a843, inset 0 0 50px rgba(0,0,0,0.6)" : "inset 0 0 40px rgba(0,0,0,0.5)",
            backfaceVisibility: "hidden",
          }}
        >
          {/* hover lift: whole door brightens when armed */}
          {armed && (
            <div className="pointer-events-none absolute inset-0 rounded-t-[140px] opacity-0 transition-opacity duration-200 group-hover/door:opacity-100" style={{ boxShadow: "0 0 70px -10px #d4a843, inset 0 0 60px rgba(212,168,67,0.12)" }} />
          )}
        </div>

        {/* FIXED stone frame — IN FRONT, clipped to a ring (arched hole) so the leaf shows
            through and the stone lip overlaps the door edges = recessed look. Does NOT swing. */}
        <div
          className="pointer-events-none absolute"
          style={{
            width: 480,
            height: 720,
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            backgroundImage: "url(/room/mug-frame.webp?v=2)",
            backgroundSize: "100% 100%",
            clipPath: "path(evenodd, 'M0,0 H480 V720 H0 Z M144,641 V281 Q144,150 240,150 Q334,150 334,281 V641 Z')",
            WebkitClipPath: "path(evenodd, 'M0,0 H480 V720 H0 Z M144,641 V281 Q144,150 240,150 Q334,150 334,281 V641 Z')",
            // mug-frame.webp now carries a luminance-keyed alpha channel (dark field → transparent),
            // so it composites straight onto the brick — no black rectangle, no blend-mode hacks needed.
            // calm the hot orange a touch so it sits with the gold mortar seams
            filter: active ? "saturate(0.82)" : "brightness(0.5) saturate(0.68)",
            transition: "filter 320ms ease",
          }}
        />
      </div>

      {/* hanging tavern sign above the doorway — carries the wall's name */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={{ top: -8, width: 300, opacity: active ? 1 : 0.55, transition: "opacity 320ms ease" }}
      >
        <div style={{ position: "relative", width: 300, height: 200 }}>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "url(/room/mug-sign.webp?v=2)",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "top center",
              filter: "saturate(0.82)",
            }}
          />
          <span
            className="absolute left-0 right-0 text-center"
            style={{
              top: 84,
              fontFamily: "Cormorant Garamond, Georgia, serif",
              color: "#e8c887",
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              textShadow: "0 1px 6px rgba(0,0,0,0.95)",
            }}
          >
            {wall.label}
          </span>
        </div>
      </div>

      {/* warm firelight leaking from under the door, even across the room (ambient).
          wrapper carries the distance opacity; the inner layer flickers like a hearth
          (parent × child opacity = flicker scaled by how close you're facing it) */}
      <div
        className="pointer-events-none absolute bottom-[18%] left-1/2 -translate-x-1/2 w-48 h-6"
        style={{ opacity: active ? 0.8 : 0.35, transition: "opacity 320ms ease" }}
      >
        <div
          className="mug-firelight absolute inset-0"
          style={{ background: "radial-gradient(ellipse, rgba(212,168,67,0.55), transparent 70%)", filter: "blur(6px)" }}
        />
      </div>

      {armed && (
        <span className="pointer-events-none absolute bottom-[10%] left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-[#d4a843]/60">
          open the door
        </span>
      )}
    </div>
  );
}

// the Shimmer wall — a screen you power ON. Idle attract-loop across the room,
// CRT turn-on (line expands → full glow → resolve) on approach, then into /shimmer.
// 3-layer pattern (mirrors the Mug/Arcade): the world attract BEYOND → ornate stone
// BEZEL in front, clipped to a ring so the screen shows through the opening = recessed.
const SHM_FW = 600;
const SHM_FH = 400;
// the rectangular screen opening, in the bezel box's own coordinate space (600×400)
const SHM_HOLE = "M157,84 H443 Q453,84 453,94 V293 Q453,303 443,303 H157 Q147,303 147,293 V94 Q147,84 157,84 Z";
const SHM_RING = `M0,0 H${SHM_FW} V${SHM_FH} H0 Z ${SHM_HOLE}`; // donut (evenodd)
// fireflies drifting over the meadow vista (positions in the 600×400 screen box, inside the hole)
const SHM_TWINKLES = [
  { x: 190, y: 142, s: 3,   c: "rgba(255,238,170,0.95)", dur: 2.8, delay: 0 },
  { x: 322, y: 112, s: 2,   c: "rgba(205,255,205,0.9)",  dur: 3.4, delay: 1.1 },
  { x: 402, y: 178, s: 3,   c: "rgba(255,240,180,0.95)", dur: 3.0, delay: 0.6 },
  { x: 240, y: 232, s: 2.5, c: "rgba(184,162,255,0.9)",  dur: 3.8, delay: 1.8 },
  { x: 360, y: 250, s: 2,   c: "rgba(255,235,160,0.9)",  dur: 2.6, delay: 2.3 },
  { x: 204, y: 204, s: 2,   c: "rgba(212,255,212,0.85)", dur: 3.2, delay: 0.9 },
  { x: 430, y: 128, s: 2.5, c: "rgba(190,170,255,0.85)", dur: 3.5, delay: 1.5 },
];

function ShimmerTV({ wall, active, phase, onEnter }: { wall: Wall; active: boolean; phase: Phase; onEnter: () => void }) {
  const powering = phase === "open" || phase === "through";
  const armed = active && phase === "room";
  return (
    <div className="relative w-full h-full grid place-items-center text-center">
      <Seams />
      <div
        className={`group/tv relative ${armed ? "cursor-pointer" : ""}`}
        style={{ width: SHM_FW, height: SHM_FH }}
        onClick={armed ? onEnter : undefined}
        role={armed ? "button" : undefined}
        aria-label={armed ? "Turn on the screen — enter Shimmer" : undefined}
      >
        {/* SCREEN — everything clipped to the bezel's opening */}
        <div
          className="absolute inset-0"
          style={{ clipPath: `path('${SHM_HOLE}')`, WebkitClipPath: `path('${SHM_HOLE}')`, background: "#050508" }}
        >
          {/* the Shimmer world attract image (dim when off, lit when faced, hidden while powering on) */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "url(/room/shimmer-beyond.webp)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: powering ? 0 : active ? 1 : 0.45,
              filter: active ? "none" : "brightness(0.7) saturate(0.8)",
              transition: "opacity 320ms ease, filter 320ms ease",
            }}
          />
          {/* idle attract glow — faint accent wash, alive when faced */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 45%, ${wall.accent}1f 0%, transparent 65%)`,
              opacity: powering ? 0 : active ? 0.6 : 0.25,
              transition: "opacity 320ms ease",
            }}
          />
          {/* fireflies twinkling over the meadow vista — the screen's attract life.
              hidden while powering on (the CRT sweep owns the screen then) */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ opacity: powering ? 0 : active ? 1 : 0.45, transition: "opacity 320ms ease" }}
          >
            {SHM_TWINKLES.map((t, i) => (
              <span
                key={i}
                className="shimmer-twinkle"
                style={{
                  left: t.x,
                  top: t.y,
                  width: t.s,
                  height: t.s,
                  background: `radial-gradient(circle, ${t.c}, transparent 70%)`,
                  boxShadow: `0 0 6px ${t.c}`,
                  ["--tw-dur" as string]: `${t.dur}s`,
                  ["--tw-delay" as string]: `${t.delay}s`,
                }}
              />
            ))}
          </div>

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
            <div className="text-4xl tracking-[0.35em] uppercase" style={{ fontFamily: "Cormorant Garamond, Georgia, serif", color: "#efeaff" }}>
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

        {/* the ornate BEZEL — IN FRONT, clipped to a ring so the screen shows through the opening */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "url(/room/shimmer-bezel.webp)",
            backgroundSize: "100% 100%",
            clipPath: `path(evenodd, '${SHM_RING}')`,
            WebkitClipPath: `path(evenodd, '${SHM_RING}')`,
            // feather the outer edge so the housing melts into the wall (no rectangle seam)
            maskImage: "radial-gradient(ellipse 86% 90% at 50% 50%, #000 64%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 86% 90% at 50% 50%, #000 64%, transparent 100%)",
            filter: active ? "saturate(0.9)" : "brightness(0.5) saturate(0.7)",
            transition: "filter 320ms ease",
          }}
        />

        {/* standby LED tucked at the screen's bottom-right corner */}
        <div className="absolute w-1.5 h-1.5 rounded-full" style={{ right: 162, bottom: 104, background: active ? wall.accent : "#3a3a44", boxShadow: active ? `0 0 6px ${wall.accent}` : "none" }} />
      </div>

      {/* label below the screen */}
      <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 text-center" style={{ opacity: active ? 1 : 0.4, transition: "opacity 320ms ease" }}>
        <h2 className="text-3xl tracking-[0.3em] uppercase" style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}>{wall.label}</h2>
        {armed && <p className="mt-1 text-[10px] uppercase tracking-[0.3em]" style={{ color: `${wall.accent}99` }}>turn it on</p>}
      </div>
    </div>
  );
}

// the Arcade wall — a grand stone archway; through it, a hall of glowing cabinets
// receding into the dark. Approach walks you under the arch into /arcade/all.
// 3-layer pattern (mirrors the Mug door): hall BEYOND → stone arch FRAME in front,
// clipped to a ring so the hall shows through the opening = recessed, not pasted.
const ARC_FW = 820;
const ARC_FH = 656;
// the arched opening, in the frame box's own coordinate space (820×656)
const ARC_HOLE = "M258,652 V243 Q258,121 412,121 Q566,121 566,243 V652 Z";
const ARC_RING = `M0,0 H${ARC_FW} V${ARC_FH} H0 Z ${ARC_HOLE}`; // donut (evenodd)
// cabinet marquees blinking down the two converging rows of the hall (820×656 box,
// inside the arch opening) — closer cabinets bigger/brighter, deeper ones small & dim
const ARC_BLINKS = [
  { x: 302, y: 556, s: 6, c: "rgba(0,255,255,0.95)",   dur: 2.6, delay: 0 },
  { x: 524, y: 556, s: 6, c: "rgba(212,168,67,0.95)",  dur: 3.1, delay: 0.8 },
  { x: 350, y: 438, s: 4, c: "rgba(168,140,255,0.9)",  dur: 2.9, delay: 1.6 },
  { x: 472, y: 438, s: 4, c: "rgba(0,255,255,0.85)",   dur: 3.4, delay: 0.4 },
  { x: 384, y: 338, s: 3, c: "rgba(212,168,67,0.8)",   dur: 2.7, delay: 2.1 },
  { x: 440, y: 338, s: 3, c: "rgba(168,140,255,0.8)",  dur: 3.2, delay: 1.2 },
];

function ArcadeArch({ wall, active, phase, onEnter }: { wall: Wall; active: boolean; phase: Phase; onEnter: () => void }) {
  const armed = active && phase === "room";
  const crossing = phase !== "room";
  return (
    <div className="relative w-full h-full grid place-items-center text-center">
      <Seams />
      <div
        className={`group/arch relative ${armed ? "cursor-pointer" : ""}`}
        style={{ width: ARC_FW, height: ARC_FH, transform: "translateY(34px)" }}
        onClick={armed ? onEnter : undefined}
        role={armed ? "button" : undefined}
        aria-label={armed ? "Step through the archway into the Arcade" : undefined}
      >
        {/* the hall of cabinets seen THROUGH the arch (clipped to the opening shape) */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(/room/arcade-beyond.webp)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundColor: "#06060c",
            clipPath: `path('${ARC_HOLE}')`,
            WebkitClipPath: `path('${ARC_HOLE}')`,
            filter: active ? "none" : "brightness(0.55)",
            transition: "filter 320ms ease",
          }}
        />
        {/* live pulse at the vanishing point so the hall breathes */}
        <div
          className="pointer-events-none absolute arcade-attract"
          style={{ left: "50%", top: "44%", width: 130, height: 130, transform: "translate(-50%,-50%)", borderRadius: "9999px", background: "radial-gradient(circle, rgba(212,168,67,0.22), transparent 70%)", filter: "blur(8px)", opacity: active ? 0.9 : 0.4 }}
        />
        {/* cabinet marquees blinking down the hall (clipped to the opening) */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ clipPath: `path('${ARC_HOLE}')`, WebkitClipPath: `path('${ARC_HOLE}')`, opacity: active ? 1 : 0.4, transition: "opacity 320ms ease" }}
        >
          {ARC_BLINKS.map((b, i) => (
            <span
              key={i}
              className="cabinet-blink"
              style={{
                left: b.x,
                top: b.y,
                width: b.s,
                height: b.s,
                background: `radial-gradient(circle, ${b.c}, transparent 72%)`,
                boxShadow: `0 0 8px ${b.c}`,
                ["--cb-dur" as string]: `${b.dur}s`,
                ["--cb-delay" as string]: `${b.delay}s`,
              }}
            />
          ))}
        </div>
        {/* brighten the hall as you cross the threshold */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ clipPath: `path('${ARC_HOLE}')`, WebkitClipPath: `path('${ARC_HOLE}')`, background: "radial-gradient(ellipse at 50% 60%, rgba(212,168,67,0.20), transparent 65%)", opacity: crossing ? 1 : 0, transition: `opacity ${DOOR_MS}ms ease` }}
        />

        {/* the stone arch FRAME — IN FRONT, clipped to a ring so the hall shows through the opening */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "url(/room/arcade-frame.webp?v=2)",
            backgroundSize: "100% 100%",
            clipPath: `path(evenodd, '${ARC_RING}')`,
            WebkitClipPath: `path(evenodd, '${ARC_RING}')`,
            // arcade-frame.webp now carries a luminance-keyed alpha channel (dark field → transparent),
            // so it composites straight onto the brick — no black rectangle, no blend-mode hacks needed.
            // calm the hot orange so it sits with the gold mortar seams
            filter: active ? "saturate(0.82)" : "brightness(0.5) saturate(0.68)",
            transition: "filter 320ms ease",
          }}
        />
        {/* hover bloom when armed — warm wash over the opening */}
        {armed && (
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover/arch:opacity-100"
            style={{ clipPath: `path('${ARC_HOLE}')`, WebkitClipPath: `path('${ARC_HOLE}')`, boxShadow: "inset 0 0 70px rgba(212,168,67,0.22)" }}
          />
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
// News feed — live from /public/room/news.json (editable / automatable, no rebuild).
// The inline list below is the SSR/offline fallback if the fetch fails.
type NewsItem = { date?: string; tag?: string; title: string };
// AtherPages Folk-volume accent (matches folk.json's "neutral / The Folk" gold) — distinguishes the Folk sub-link from the cyan Grimoire one.
const FOLK_GOLD = "#caa24e";
const DESK_NEWS_FALLBACK: NewsItem[] = [
  { tag: "New", title: "Atherdash is live — thread the element gates" },
  { tag: "Arcade", title: "Lucernyx torch-race retuned" },
  { tag: "Shimmer", title: "Party combat in the works" },
  { tag: "Hub", title: "The Room hub — you're standing in it" },
];
const NEWS_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtNewsDate(iso?: string): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${NEWS_MONTHS[+m[2] - 1]} ${+m[3]}` : "";
}

// the Hall of Fame — the Athernyx cast you can hang in your profile frame.
// Art lives in /public/characters; portraits crop to frame top-center so faces stay in.
type CastMember = { id: string; name: string; title: string };
const CAST: CastMember[] = [
  { id: "kael", name: "Kael", title: "The Heretic" },
  { id: "veyra", name: "Veyra", title: "The Hunter" },
  { id: "eyuun", name: "Eyuun", title: "The Ancient" },
  { id: "samantha", name: "Samantha", title: "The Healer" },
  { id: "helga", name: "Helga", title: "The Mother" },
  { id: "lazerin", name: "Lazerin", title: "The Patient" },
];
const CAST_BY_ID = Object.fromEntries(CAST.map((c) => [c.id, c]));
const PROFILE_KEY = "ather-room-profile";

function DeskWall({ wall, active, phase, onEnter }: { wall: Wall; active: boolean; phase: Phase; onEnter: () => void }) {
  const accent = wall.accent; // cyan
  const armed = active && phase === "room"; // far away → click anywhere to approach
  const arrived = active && phase !== "room"; // at the desk → UI is interactive

  // single profile frame → opens a combined Profile panel (portrait picker + settings)
  const [profileId, setProfileId] = useState<string>("kael");
  const [panelOpen, setPanelOpen] = useState(false);
  useEffect(() => {
    let saved = "kael";
    try { saved = localStorage.getItem(PROFILE_KEY) || "kael"; } catch {}
    if (!CAST_BY_ID[saved]) saved = "kael";
    setProfileId(saved);
  }, []);
  const chooseProfile = (id: string) => {
    setProfileId(id);
    try { localStorage.setItem(PROFILE_KEY, id); } catch {}
  };
  const profile = CAST_BY_ID[profileId] || CAST[0];
  // audio mute lives in Settings now (singleton hub — shared with the room HUD toggle)
  const hub = getHubAudio();
  const muted = useSyncExternalStore(hub.subscribe, () => hub.muted, () => false);

  // live News feed — fetch the JSON, fall back to the inline list
  const [news, setNews] = useState<NewsItem[]>(DESK_NEWS_FALLBACK);
  useEffect(() => {
    let alive = true;
    fetch("/room/news.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && Array.isArray(d) && d.length) setNews(d as NewsItem[]); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const sortedNews = [...news].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

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

      {/* the Mana'mal greeter + podium (one cutout image; clicking it bubbles to approach when armed) */}
      <div
        className="pointer-events-none absolute"
        style={{ left: "50%", top: "48%", transform: "translate(-50%,0)", width: 380, height: 462, opacity: active ? 1 : 0.5, transition: "opacity 320ms ease" }}
      >
        {/* contact shadow at the podium base — sits across the wall/floor seam so it reads planted */}
        <div className="pointer-events-none absolute" style={{ left: "50%", bottom: 60, width: 220, height: 42, transform: "translate(-50%,0)", background: "radial-gradient(ellipse, rgba(0,0,0,0.62), transparent 72%)", filter: "blur(8px)" }} />
        {/* soft glow pool the greeter sits in (pulses with the breath once you're at the desk) */}
        <div className={`pointer-events-none absolute ${active ? "desk-glow-pulse" : ""}`} style={{ left: "50%", top: "32%", width: 340, height: 300, transform: "translate(-50%,-50%)", background: `radial-gradient(circle, ${accent}22, transparent 68%)`, filter: "blur(10px)", opacity: active ? 0.9 : 0.4 }} />
        <div
          className="desk-breath absolute inset-0"
          style={{
            backgroundImage: "url(/room/desk-greeter.png)",
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            filter: active ? "none" : "brightness(0.7)",
            transition: "filter 320ms ease",
          }}
        />
      </div>

      {/* interactive cluster — only live once you've arrived at the desk */}
      <div className="absolute inset-0" style={{ pointerEvents: arrived ? "auto" : "none" }}>
        {/* the profile frame — a single portrait hung above the greeter; click to open
            the Profile panel (pick a cast portrait + settings). */}
        <div className="absolute flex justify-center" style={{ left: "50%", top: "8%", transform: "translate(-50%,0)" }}>
          <button
            className="group/fr flex flex-col items-center transition hover:-translate-y-0.5"
            aria-label={`Profile: ${profile.name}. Open profile and settings`}
            onClick={(e) => { e.stopPropagation(); setPanelOpen(true); }}
          >
            {/* gilt frame, dark mat, portrait cover */}
            <span
              className="block rounded-[3px]"
              style={{
                width: 116, height: 152, padding: 7,
                background: "linear-gradient(145deg,#caa24e,#7a5c1e 45%,#e7c878 70%,#6e5018)",
                boxShadow: `0 8px 24px rgba(0,0,0,0.55), 0 0 0 1px ${accent}55, 0 0 18px ${accent}44`,
              }}
            >
              <span
                className="block w-full h-full rounded-[1px]"
                style={{
                  backgroundImage: `url(/characters/${profile.id}.png)`,
                  backgroundSize: "cover",
                  backgroundPosition: "center 18%",
                  boxShadow: "inset 0 0 0 2px #1a140a, inset 0 0 14px rgba(0,0,0,0.6)",
                  filter: "saturate(0.95)",
                }}
              />
            </span>
            {/* nameplate */}
            <span className="mt-1.5 text-center leading-tight">
              <span className="block text-[12px] uppercase tracking-[0.18em]" style={{ color: accent }}>{profile.name}</span>
              <span className="block text-[8px] uppercase tracking-[0.22em] text-[#8a9aa2] opacity-0 transition group-hover/fr:opacity-100">edit ⚙</span>
            </span>
          </button>
        </div>

        {/* AtherPages — left side; the living record, both volumes (Grimoire spirits + The Folk people) */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute rounded-md border p-4 bg-[#0e1820]/70 backdrop-blur"
          style={{ left: "1%", top: "30%", width: "27%", borderColor: `${accent}33` }}
        >
          <h3 className="text-lg uppercase tracking-[0.25em]" style={{ color: accent }}>AtherPages</h3>
          <p className="text-[10px] leading-snug text-[#aebfc8]/80 mb-3">the living record of Athernyx — two volumes.</p>

          {/* The Grimoire — spirits */}
          <Link
            href="/grimoire?from=room"
            onClick={(e) => e.stopPropagation()}
            className="group/grim block rounded-md border p-2.5 mb-2 transition hover:-translate-y-0.5"
            style={{ borderColor: `${accent}22` }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: accent }}>The Grimoire</span>
              <span className="text-[9px] uppercase tracking-[0.18em] text-[#8a9aa2]">spirits</span>
            </div>
            <div className="flex items-center gap-1.5">
              {["vulnyx", "croakling", "hovari"].map((id) => (
                <span key={id} className="block h-9 w-9 rounded-sm" style={{ background: `radial-gradient(circle, ${accent}22, transparent 70%)` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/grimoire/${id}.png`} alt="" aria-hidden className="h-full w-full object-contain" />
                </span>
              ))}
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em]" style={{ color: `${accent}cc` }}>
                open <span className="transition group-hover/grim:translate-x-0.5">&#8250;</span>
              </span>
            </div>
          </Link>

          {/* The Folk — the people */}
          <Link
            href="/grimoire?v=folk&from=room"
            onClick={(e) => e.stopPropagation()}
            className="group/folk block rounded-md border p-2.5 transition hover:-translate-y-0.5"
            style={{ borderColor: `${FOLK_GOLD}2a` }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: FOLK_GOLD }}>The Folk</span>
              <span className="text-[9px] uppercase tracking-[0.18em] text-[#8a9aa2]">the people</span>
            </div>
            <div className="flex items-center gap-1.5">
              {["moglin", "bramble", "hemlock"].map((id) => (
                <span key={id} className="block h-9 w-9 rounded-sm overflow-hidden" style={{ background: `radial-gradient(circle, ${FOLK_GOLD}22, transparent 70%)` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/atherpages/folk/${id}.png`} alt="" aria-hidden className="h-full w-full object-cover" />
                </span>
              ))}
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em]" style={{ color: `${FOLK_GOLD}cc` }}>
                open <span className="transition group-hover/folk:translate-x-0.5">&#8250;</span>
              </span>
            </div>
          </Link>
        </div>

        {/* News — right side; live from /room/news.json */}
        <div className="absolute rounded-md border p-4 bg-[#0e1820]/70 backdrop-blur" style={{ left: "72%", top: "34%", width: "27%", borderColor: `${accent}33` }}>
          <h3 className="text-lg uppercase tracking-[0.25em] mb-3" style={{ color: accent }}>News</h3>
          <ul className="space-y-3 text-left max-h-[260px] overflow-y-auto pr-1">
            {sortedNews.map((n, i) => (
              <li key={i} className="text-left">
                <div className="flex items-center gap-2 mb-0.5">
                  {n.tag && (
                    <span className="rounded-sm px-1.5 py-0.5 text-[8px] uppercase tracking-[0.18em] font-medium" style={{ color: accent, border: `1px solid ${accent}44`, background: `${accent}14` }}>{n.tag}</span>
                  )}
                  {n.date && <span className="text-[9px] uppercase tracking-[0.16em] tabular-nums text-[#6e7e86]">{fmtNewsDate(n.date)}</span>}
                </div>
                <span className="block text-xs leading-snug text-[#aebfc8]">{n.title}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Profile panel — pick a cast portrait + settings (folded in from the old gear) */}
        {panelOpen && (
          <div
            className="absolute inset-0 z-30 grid place-items-center bg-black/70 backdrop-blur-sm"
            onClick={(e) => { e.stopPropagation(); setPanelOpen(false); }}
          >
            <div
              className="w-[min(88%,560px)] max-h-[88%] overflow-y-auto rounded-lg border p-5 bg-[#0b1218]/95"
              style={{ borderColor: `${accent}44`, boxShadow: `0 0 40px ${accent}22` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg uppercase tracking-[0.28em]" style={{ color: accent }}>Profile</h3>
                <button className="text-[#8a9aa2] hover:text-white text-xl leading-none" aria-label="Close" onClick={() => setPanelOpen(false)}>×</button>
              </div>

              {/* portrait picker */}
              <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-[#7e8e96]">Your portrait</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {CAST.map((c) => {
                  const sel = c.id === profileId;
                  return (
                    <button
                      key={c.id}
                      className="flex flex-col items-center transition hover:-translate-y-0.5"
                      onClick={() => chooseProfile(c.id)}
                      aria-label={`Set ${c.name} as your profile`}
                    >
                      <span
                        className="block w-full rounded-[2px]"
                        style={{
                          aspectRatio: "3 / 4",
                          backgroundImage: `url(/characters/${c.id}.png)`,
                          backgroundSize: "cover",
                          backgroundPosition: "center 18%",
                          boxShadow: sel ? `0 0 0 2px ${accent}, 0 0 14px ${accent}66` : "inset 0 0 0 1px #1a140a",
                          filter: sel ? "none" : "saturate(0.85) brightness(0.85)",
                        }}
                      />
                      <span className="mt-1 text-[10px] uppercase tracking-[0.14em] text-center leading-tight" style={{ color: sel ? accent : "#cdd8de" }}>{c.name}</span>
                      <span className="text-[8px] uppercase tracking-[0.16em] text-[#7e8e96]">{c.title}</span>
                    </button>
                  );
                })}
              </div>

              {/* settings */}
              <div className="mt-5 border-t pt-4" style={{ borderColor: `${accent}22` }}>
                <p className="mb-2.5 text-[10px] uppercase tracking-[0.22em] text-[#7e8e96]">Settings</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.18em] text-[#aebfc8]">Sound</span>
                  <button
                    role="switch"
                    aria-checked={!muted}
                    onClick={() => { const h = getHubAudio(); h.start(); h.toggleMuted(); }}
                    className="relative rounded-full transition"
                    style={{ width: 46, height: 24, background: muted ? "#1c2730" : `${accent}55`, border: `1px solid ${muted ? "#33424c" : accent}` }}
                  >
                    <span className="absolute top-1/2 rounded-full transition-all" style={{ width: 18, height: 18, transform: "translateY(-50%)", left: muted ? 3 : 25, background: muted ? "#6e7e86" : accent }} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desk title sits up top (greeter now drops to the floor line and would cover a bottom label) */}
      <div className="absolute top-[3%] left-1/2 -translate-x-1/2 text-center" style={{ opacity: active ? 1 : 0.4, transition: "opacity 320ms ease" }}>
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

// drifting dust motes — a room-wide ambient layer over the whole viewport.
// Deterministic config (no Math.random) so SSR/CSR markup matches; the CSS
// keyframe (roomMoteDrift) carries each mote up on its own slow loop.
const MOTES = [
  { left: 8,  top: 72, size: 3,   dur: 17, delay: 0,   dx: 12,  max: 0.42 },
  { left: 17, top: 88, size: 2,   dur: 21, delay: 4,   dx: -8,  max: 0.3 },
  { left: 26, top: 64, size: 4,   dur: 15, delay: 9,   dx: 16,  max: 0.5 },
  { left: 34, top: 92, size: 2.5, dur: 19, delay: 2,   dx: -14, max: 0.36 },
  { left: 43, top: 78, size: 3,   dur: 23, delay: 7,   dx: 6,   max: 0.46 },
  { left: 50, top: 96, size: 2,   dur: 16, delay: 11,  dx: 10,  max: 0.32 },
  { left: 58, top: 68, size: 3.5, dur: 20, delay: 1,   dx: -10, max: 0.48 },
  { left: 66, top: 86, size: 2.5, dur: 18, delay: 6,   dx: 14,  max: 0.38 },
  { left: 74, top: 74, size: 3,   dur: 22, delay: 3,   dx: -6,  max: 0.44 },
  { left: 82, top: 90, size: 2,   dur: 15, delay: 10,  dx: 9,   max: 0.3 },
  { left: 90, top: 66, size: 4,   dur: 24, delay: 5,   dx: -12, max: 0.5 },
  { left: 12, top: 58, size: 2.5, dur: 19, delay: 13,  dx: 8,   max: 0.34 },
  { left: 38, top: 56, size: 3,   dur: 21, delay: 8,   dx: -9,  max: 0.4 },
  { left: 70, top: 60, size: 2,   dur: 17, delay: 14,  dx: 11,  max: 0.3 },
];

function DustMotes() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="room-mote"
          style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: m.size,
            height: m.size,
            ["--mote-dur" as string]: `${m.dur}s`,
            ["--mote-delay" as string]: `${m.delay}s`,
            ["--mote-dx" as string]: `${m.dx}px`,
            ["--mote-max" as string]: m.max,
          }}
        />
      ))}
    </div>
  );
}
