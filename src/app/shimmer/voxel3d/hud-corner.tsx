// hud-corner.tsx — the bottom-right cluster: the mana vessel, and the tool arch over it.
//
// ★ EXTRACTED 2026-08-26 SO A DEV HARNESS CAN MOUNT THE REAL THING. Alex asked whether the UI can
// be iterated without the 3D world, and it can — but only if the harness renders THIS component
// rather than a copy of it. `dev/icons`'s own header states the rule this file exists to obey:
// *"a preview that re-derives can be perfectly correct while the game is wrong, which is the exact
// failure a preview exists to catch."* So there is exactly one cluster, and both `VoxelWorld` and
// `dev/hud` import it. A second dialect cannot drift from the first if there is no second dialect.
//
// ⚠ THE POSITIONING LIVES HERE TOO, NOT AT THE CALL SITE. If the container stayed in `VoxelWorld`
// and only the children moved, the harness would have to restate the anchoring — which is the one
// part that has actually been wrong (four fixes) and therefore the one part most worth previewing.
//
// Preview: tools/devwin.sh <lane> → /shimmer/dev/hud

'use client'

import React from 'react'
import { ManaGauge } from './mana-gauge'
import { getEquippedTool, getToolDef, type EquippedTools } from '../engine/tools'
import { xpForSkillLevel, type SkillSet } from '../engine/skills'

export const TOOL_FAMILIES = ['forestry', 'prospecting', 'rinning', 'farming'] as const

/**
 * The whole bottom-right cluster, positioned. `VoxelWorld` mounts this and so does `dev/hud`.
 */
export function HudCorner({ mana, activeTool, tools, skills }: {
  mana: React.RefObject<{ cur: number; max: number; regen: number } | null>
  activeTool: string | null
  tools: React.RefObject<EquippedTools>
  skills: React.RefObject<SkillSet>
}) {
  return (
    <div
      className="absolute bottom-4 right-4 pointer-events-none"
      style={{ '--tool-arc-r': 'clamp(44px, 11vw, 74px)' } as React.CSSProperties}
    >
      <div className="relative" style={{ marginRight: '4px' }}>
        <ManaGauge mana={mana} />
        <ToolArc activeTool={activeTool} tools={tools} skills={skills} />
      </div>
    </div>
  )
}


/**
 * The tool arc — four round sockets curving up-right off the hotbar's right end (Alex's whiteboard,
 * 2026-08-07; replaces the rectangular `ToolGauge` cards shipped hours earlier and rejected as
 * "three steps backwards"). Zero-size and `absolute` so it never affects the hotbar's own layout;
 * `left-full` anchors it to the `relative` hotbar wrapper's right edge regardless of bar width.
 *
 * The radius is a CSS custom property (`--tool-arc-r`, `clamp()`) rather than a JS media-query
 * state, so it shrinks continuously on narrow screens with no resize listener — `ToolSocket` reads
 * it back through `calc(var(--tool-arc-r) * <cos|sin>)`, where cos/sin are real `Math` output baked
 * in at render, not hand-eyeballed numbers.
 */
function ToolArc({ activeTool, tools, skills }: {
  activeTool: string | null
  tools: React.RefObject<EquippedTools>
  skills: React.RefObject<SkillSet>
}) {
  // ── ★ THE ARC BECAME AN ARCH (2026-08-26, Alex: "tools in a half arch floating above it like
  // satellites") ─────────────────────────────────────────────────────────────────────────────
  // It used to hang off the hotbar's right edge as a quarter fan — [6, 34, 62, 90], the 08-07 taste
  // pass. It now vaults OVER the mana gauge, so the angles span the full half-circle instead of a
  // quadrant. ⚠ NO TRANSFORM CHANGED: `ToolSocket` already places by `left: r·(1−cos θ)` and
  // `bottom: r·sin θ`, which for θ ∈ 0..180 is exactly a semicircle with its feet at 0 and 2r and
  // its apex at (r, r). The arch was already expressible; only the numbers were a quadrant.
  //
  // Symmetric on purpose — two low on the shoulders, two high at the crown — so the cluster reads
  // as an arch over the vessel rather than a fan leaning off it.
  // ⚠ COUNTER-CLOCKWISE IS *LOWER* ANGLES HERE, WHICH IS WORTH SAYING BEFORE SOMEONE "FIXES" IT.
  // `ToolSocket` places by `left = r(1−cos θ)`, so rising θ walks LEFT → TOP → RIGHT, i.e. clockwise
  // on screen. Rotating the cluster counter-clockwise therefore means subtracting from every angle,
  // not adding. (The `1−cos` mirror is the 08-07 taste pass and is why this is back-to-front.)
  //
  // Alex 2026-08-26: spread wider, rotate CCW so the cluster sits left of the vessel's crown.
  // Was [30, 70, 110, 150] — 120° wide, symmetric about the top. Now 144° wide and swung ~23° CCW,
  // so the leftmost socket comes down to the gauge's shoulder and the whole set leans off-centre
  // to the left instead of sitting squarely on top.
  const ANGLES = [0, 48, 96, 144]
  return (
    <div
      // The container's origin is the arch's LEFT FOOT, and the arch is 2r wide, so it is shifted
      // left by r to centre the crown over the gauge below it.
      // ⚠ `--tool-arc-r` is INHERITED from the cluster container, not declared here. It has to be
      // the same number the container reserves its right margin from, and two declarations is the
      // mirror problem: they would agree until someone retuned one of them.
      className="absolute left-1/2 bottom-full h-0 w-0 pointer-events-none"
      // ⚠ −1.9r, NOT −1r. −1r centres the arch's crown on the gauge; the extra ~0.9r is the LEAN Alex
      // asked for. Angles alone could not get there — the swing is bounded below by θ=0, past which a
      // socket drops under the gauge's top edge and overlaps the vessel. So the tilt comes from the
      // angles and the OFFSET comes from here, which also keeps the two adjustable independently.
      style={{ transform: 'translateX(calc(var(--tool-arc-r) * -1.9))' } as React.CSSProperties}
    >
      {TOOL_FAMILIES.map((family, i) => (
        <ToolSocket key={family} family={family} angleDeg={ANGLES[i]}
          active={activeTool === family} tools={tools} skills={skills} />
      ))}
    </div>
  )
}

/**
 * A single round socket: family glyph, XP progress ring around the rim, level badge, 1-3 tier dots.
 * Read-only — nothing here is clickable, which is the point (see the TOOL ARC comment). Sized
 * 44px, shrinking to 38px under 640px (`max-[639px]:`) alongside the arc's own radius shrink, so
 * the whole cluster stays on-screen on a phone instead of clipping off the right edge.
 */
function ToolSocket({ family, angleDeg, active, tools, skills }: {
  family: 'forestry' | 'prospecting' | 'rinning' | 'farming'
  angleDeg: number
  active: boolean
  tools: React.RefObject<EquippedTools>
  skills: React.RefObject<SkillSet>
}) {
  const held = getEquippedTool(tools.current!, family)
  const def = held ? getToolDef(held) : undefined
  const tier = def?.tier ?? 0
  const basic = def?.basic ?? false
  const sk = skills.current![family]
  const xpPct = Math.min(1, sk.xp / Math.max(1, xpForSkillLevel(sk.level)))
  const rad = (angleDeg * Math.PI) / 180
  // Mirrored sweep: x = r·(1 − cos θ), so the fan steps RIGHT as it rises instead of curling
  // back over the bar (Alex taste pass 2026-08-07).
  const cosm = (1 - Math.cos(rad)).toFixed(4)
  const sin = Math.sin(rad).toFixed(4)
  const RING_R = 21
  const RING_C = 2 * Math.PI * RING_R
  return (
    <div
      className="absolute w-14 h-14 max-[639px]:w-[48px] max-[639px]:h-[48px] transition-opacity"
      style={{
        left: `calc(var(--tool-arc-r) * ${cosm})`,
        bottom: `calc(var(--tool-arc-r) * ${sin})`,
      }}
    >
      {/* ★ THE DIM GOES ON THE CONTENT, NEVER ON THE PLATE (2026-08-11). This was one
          `opacity: active ? 1 : 0.4` on the wrapper, which dimmed the socket's own backing along
          with everything in it: `bg-black/45` × 0.4 is an 18% film, so over a lit grass field the
          plate disappeared and four faint rings were left floating on the world. In the first
          headless world shot Alex could not tell what they were — "an odd cluster of translucent
          green shapes with number labels." The inactive state still has to read as inactive, but
          "text never sits raw on a scene" outranks it: the plate stays opaque and the CONTENT
          carries the state contrast. */}
      <div className={`relative w-full h-full rounded-full border
        ${active ? 'border-amber-300/80 bg-black/70 shadow-[0_0_8px_2px_rgba(252,211,77,0.4)]' : 'border-white/25 bg-black/60'}`}>
        <div className={`absolute inset-0 transition-opacity ${active ? '' : 'opacity-65'}`}>
        {/* XP ring, rotated so 0% starts at 12 o'clock */}
        <svg viewBox="0 0 48 48" className="absolute inset-0 w-full h-full -rotate-90">
          <circle cx="24" cy="24" r={RING_R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
          <circle cx="24" cy="24" r={RING_R} fill="none" stroke={active ? '#6ee7b7' : 'rgba(110,231,183,0.55)'}
            strokeWidth="2" strokeLinecap="round" strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - xpPct)} />
        </svg>
        {/* Family glyph — placeholder line art, Alex repaints later. */}
        <svg viewBox="0 0 24 24" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[60%] w-4 h-4 text-white/85"
          fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <ToolGlyph family={family} />
        </svg>
        {/* Equipped tier as 1-3 filled dots; the never-breaking basic tool reads as ONE HOLLOW dot —
            it works, but it is not an upgrade. No tool at all (farming has no basic) is all hollow. */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
          {[0, 1, 2].map((i) => {
            const filled = !basic && i < tier
            const hollowBasic = basic && i === 0
            return (
              <span key={i} className={`w-1 h-1 rounded-full border ${
                filled ? 'bg-amber-200 border-amber-200' : hollowBasic ? 'border-white/60' : 'border-white/15'}`} />
            )
          })}
        </div>
        {/* Level badge, tabular-nums so it doesn't jitter as it climbs. */}
        <div className="absolute -bottom-1 -right-1 min-w-[15px] h-[15px] px-[3px] rounded-full bg-black/80 border border-white/25
          text-[9px] leading-[14px] text-center text-white/90 font-mono tabular-nums">
          {sk.level}
        </div>
        </div>
      </div>
    </div>
  )
}

/** Placeholder line-glyph per family — canon mapping (blades→forestry, spikes→prospecting,
 *  rinsticks→rinning, spades→farming) from `engine/tools.ts`, drawn as a simple angled stroke. */
function ToolGlyph({ family }: { family: 'forestry' | 'prospecting' | 'rinning' | 'farming' }) {
  switch (family) {
    case 'forestry': // blade — angled machete stroke
      return <>
        <path d="M5 19 L16 8" />
        <path d="M16 8 L20 4" />
        <path d="M5 19 L8.5 19" />
      </>
    case 'prospecting': // spike — pick shape
      return <>
        <path d="M12 3c-3.3 0-5.5 2.2-5.5 5 0 2 1.6 3.3 3 3.3" />
        <path d="M9.5 11.3 15 20" />
      </>
    case 'rinning': // rinstick — rod + line
      return <>
        <path d="M6 21 14 4" />
        <path d="M14 4c3.5 2 3.8 7.5 1.6 12" />
        <circle cx="15.6" cy="16" r="1" fill="currentColor" stroke="none" />
      </>
    case 'farming': // spade — handle + shovel
      return <>
        <path d="M12 3v11" />
        <path d="M8 14h8l-2 7h-4l-2-7Z" />
      </>
  }
}
