# THE ROOM — ather.games spatial hub (design doc)

> First-person 3D room as the front door of ather.games. You stand in the
> center; the room (the "console") rotates around you. Prototype route: `/room`
> (throwaway). Live `/arcade` hub untouched until this is blessed.

## Core architecture — TWO verbs, one camera
Everything is one CSS-3D world transformed around a centered viewer.
- **TURN** = `rotateY` on the room (face a different wall).
- **APPROACH** = dolly the camera forward (`translateZ` + perspective scale) into the faced wall.
Every per-wall "enter" is just **approach + a short arrival flourish**. One shared
`approach()/retreat()` spine; each wall owns only its small custom tip.

## The four walls
1. **Shimmer** — "the world." Walk up, **turn the TV on** (CRT flicker/scanline sweep/glow,
   reuse `gameui.css` scanlines). Idle attract-loop of Shimmer plays on the screen from across
   the room. Flourish masks the route load into `/shimmer`.
2. **The Arcade** — "the cabinet." Walk up, wall lifts like a **shutter**, cabinet cards power on
   in a quick stagger. Keep its flourish the SHORTEST (it's a directory inside the directory).
3. **The Front Desk** (was "Your Shelf") — the attendant hands you your stuff. **Absorbs favorites.**
   = who you are + what's yours: profile setup, sign-in (natural home for the owner gate),
   favorites, recent, settings. Onboarding lives here.
4. **Kindled Mug** — "the tavern." A **door that opens** (rotateY door leaf, warm firelight bloom,
   step through into `/magii`). Most physical of the four.

## Decisions / guardrails (locked with Alex)
- **Flourish on FIRST approach, express lane after.** Dolly always fast (~400ms); flourish short
  (~300ms) and a second click SKIPS it. Delight you can't skip = friction. (Honors the "keep it fast" rule.)
- **One shared approach spine**, not four bespoke scenes (timing/feel won't drift; maintainable).
- **Bulletproof exit.** One persistent back affordance + Esc + swipe-down, same on every wall.
  Forward = in, back = out to the room. Always.
- **Lazy-mount.** Distant walls stay cheap/static; mount heavy content (esp. the Shimmer screen)
  only on approach, unmount on leave. `prefers-reduced-motion` collapses dolly+flourish to a clean cut.
- **NOT a single-page god-app.** Heavy walls (Shimmer, Magii) route OUT under cover of the transition;
  light stuff (arcade grid, desk profile) lives in-place. Keep `/arcade/all` as the canonical flat directory underneath.

## Knobs (in /room page.tsx)
`ROOM_R` wall distance · `WALL_W/WALL_H` · `PERSP` (FOV, lower = wider) · `TURN_MS`.

## PARKED IDEAS (pin for whenever)
- ✅ **🔊 Muffled tavern audio — BUILT 2026-06-20.** WebAudio: Magii track → BiquadFilter lowpass
  (320Hz muffled → 16kHz open) → gain. Both driven by facing factor cos(angle to Mug) × approach factor
  (room/approach/open). Unlocks on first gesture (autoplay policy); mute toggle top-right; glides via
  setTargetAtTime(0.18). Adjacent walls ~half vol. Knobs: gain 0.05–0.22, floor 320Hz, glide 0.18.
  Generalizes to per-wall ambient beds (Shimmer world-hum, Arcade attract bleeps) on the same rig — not built.
- Ambient life per wall: dust motes, warm flicker leaking under the Mug door from across the room,
  Arcade attract-glow, the Shimmer TV attract-loop. Polish pass, after core dolly.
- Each wall's enter direction matches its metaphor (screen on / shutter up / door in / lean to desk) =
  consistent "forward = in."

## Build order
1. ✅ Rotation (first-person turn) — DONE, Alex: "nailed it."
2. ✅ Door walk-in (Mug) — DONE, Alex: "nailed it." Zoom pulled back ~50% (ENTER_DOLLY 900,
   step-through +110). Whole door clickable + hover bloom. Magii gets `?from=room` return button.
3. ✅ Shimmer TV power-on — DONE. Shared `enter(wall)` spine generalized from the door. Idle
   attract-glow across the room → CRT line-expand turn-on → resolve → flash into /shimmer?from=room.
   ⚠ TODO: Shimmer page (4400-line game) needs the matching `from=room` return button — wire
   deliberately when Shimmer is connected for real (it's owner-gated coming-soon, not the live path).
4. ✅ Arcade ARCHWAY — DONE (changed from "shutter" per Alex: an archway with a hall of glowing
   cabinets receding behind it; walk UNDER the arch into /arcade/all). Reusable `_components/RoomReturn.tsx`
   (gated on ?from=room) added there.
5. ✅ Front Desk — DONE. Attendant at a podium (CSS stand-in) + Profile (top-left) + Settings gear
   (top-right, spins on hover) + News feed (right), per Alex's sketch. In-place UI wall: gentler approach
   (enterDolly 380 so the whole composition stays in frame), arrives + STOPS (no route-out), back returns.
   Profile/Settings = TODO action stubs (sign-in / settings panels = the functional layer, next when wanted).
   News = placeholder copy. All 4 walls now have distinct thresholds: Mug door / Shimmer screen / Arcade arch / Desk step-up.
6. ✅ Muffled tavern audio — DONE (see Parked Ideas). NEXT: ambient life + real art (attendant/arch/door)
   + wire Profile/Settings panels + Shimmer-page return button.

## Responsive (locked)
- Design at a fixed STAGE (1280×820); scale the whole 3D room by ONE factor. Lesson: don't tune a
  constant to your window — make the window the input.
- Scale = **vmin** (`min(vw,vh)/820`), NOT contain-against-fixed-aspect (that crushed portrait to ~30%).
  First-person space → edge-crop is fine/immersive, so vmin is the right pick. Knob: the 820 base (lower=bigger).
- Controls pinned to the real viewport edges (outside the scaled stage) so they stay thumb-sized.
- Buttons/labels/swipe/keys all agree (wall index increases to the RIGHT: wall placement rotateY(-i*STEP),
  world rotateY(+angle)).

## 3D DETOUR — tried & REVERTED (2026-06-20)
Built a real-3D R3F version at `/room3d` to fix the floor's grazing problem (camera truly inside).
It worked technically (snap-turn, approach, bloom, audio all ported) and there's **no hardware blocker**
(WebGL renders client-side, server stays GPU-less). BUT the real blocker is **assets**: 3D done well
needs models/materials/lighting we don't have a pipeline for. The pipeline we DO have is 2D gen (FLUX) +
CSS masking — which is what `/room` is built for. **Decision (Alex): trash room3d, continue on CSS `/room`.**
Deleted the route + uninstalled @react-three/{fiber,drei,postprocessing} (kept `three`, used by shimmer).
Lesson banked: "no hardware blocker" ≠ "feasible" — match the build to the asset pipeline you actually have.

## MASKING PHASE — plan (art over the CSS stand-ins, on `/room`)
> START WITH THE WALLS, not the floor. Walls are seen HEAD-ON when faced → 2D art behaves perfectly.
> Floor/ceiling are grazed (the 3D detour confirmed this is intrinsic to the CSS technique) → keep them
> HUMBLE (dark + faint depth), and repurpose the compass as an emblem seen flat-on, not as hero floor art.
> The room geometry is DONE and already layered. Every surface is its own DOM element
> with its own background, and the special walls are pre-split into frame + beyond
> layers (the slots the animations target). So art DROPS IN — no restructuring.

**Surfaces (each its own layer):**
1. Floor — `Plane axis="floor"` (rotateX 90). Gen a top-down stone/glow floor texture; keep the radial mask.
2. Ceiling/roof — `Plane axis="ceiling"` (rotateX -90). Gen beams/ambient glow.
3. Mug wall — door LEAF (frame) over warm-room-BEYOND (bg). 2 images.
4. Shimmer wall — TV/cabinet BEZEL (frame) over SCREEN content/attract (bg). 2 images.
5. Arcade wall — arch FRAME (frame, open center) over cabinet-HALL-BEYOND (bg). 2 images.
6. Desk wall — attendant CHARACTER + podium art. Profile/Settings/News stay as UI overlays (not art).

**Generation:** extend `scripts/gen_cards.py` (FLUX-schnell via Replicate, token in guardia-core/.env)
with a ROOM_BRIEFS set → `public/room/<surface>.webp`. Reuse the existing `STYLE` string + palette
(void #0a0a0f, gold #d4a843, violet #8b5cf6, cyan #00ffff) so all surfaces read as ONE room.

**Layering / transparency (FLUX has no alpha):**
- Geometric frames (arch / door / bezel): gen the frame + the beyond as TWO full images; the opening
  shapes are already defined in CSS (arch border-radius, door rounded-rect) → CSS-mask/clip the frame
  to the ring so the beyond shows through. No bg-removal needed.
- Irregular cutout (the attendant character): run a bg-removal pass (Replicate rembg) for clean alpha.

**Perspective caveat (important):** floor/ceiling art is viewed UNDER `rotateX(90/-90)` — gen a FLAT
top-down texture; the CSS rotation supplies the perspective. Do NOT bake perspective into the floor image
(it would double up). Walls are seen head-on when faced → gen at ~3:2, no baked perspective.

**Order (incremental, verify each):** floor + ceiling (sets room-shell mood) → Mug → Arcade → Shimmer
→ Desk character. Keep the CSS stand-ins as fallback until each surface's art lands.

## MASKING PHASE — PROGRESS (2026-06-20 eve)
- ✅ **Shell:** `wall.webp` (dressed stone, NO pillars — Alex cut them), `floor.webp` (humble stone + inlaid
  compass), `ceiling.webp` (dark beams). All 4 walls share `wall.webp` → reads as one room.
- ✅ **Mug door — 3-layer pattern (REUSE THIS):**
  1. `mug-beyond.webp` tavern interior (back, fixed).
  2. `mug-leaf.webp` oak door panel (mid, SWINGS on left hinge).
  3. `mug-frame.webp` stone arch **IN FRONT**, `clip-path: path(evenodd,...)` cuts the arch hole so the leaf
     shows through and the stone lip overlaps the door edges = **recessed, not a cutout.**
  - **KEY LESSON (Alex caught it):** frame BEHIND the leaf → door looks like a sticker pasted on the frame.
    Frame must be IN FRONT with a clipped transparent hole. FLUX has no alpha, but the frame's hole shape is
    defined in CSS (the clip-path), so no bg-removal needed.
  - Outer frame edge feathered with a radial `mask-image` (hides the rect panel seam); orange glow calmed
    with `filter: saturate(0.82)`. Hanging `mug-sign.webp` + CSS text carries the name above the door.
- **Tooling:** `?wall=N` deep-link + server headless chromium screenshot (see SHIMMER_SESSION). Self-verify composites.
- **FLUX-schnell gotcha:** ignores negative prompts, skews glow RED. Lean into orange as firelight for the Mug;
  push the wanted palette in the POSITIVE prompt for the others.
- **DEFERRED (own session):** the `/room`→`/magii` route transition — current /magii page doesn't fit the entryway.
- ⏳ NEXT: Arcade arch, Shimmer screen, Desk — same 3-layer frame+beyond(+leaf) pattern.
