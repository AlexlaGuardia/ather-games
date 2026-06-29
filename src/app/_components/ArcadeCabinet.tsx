import RoomReturn from './RoomReturn'

// "#rrggbb" (or "#rgb") → "r, g, b" for use inside rgba() gradients.
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

// The shared arcade-cabinet shell every game page sits in. Stepping under the room's
// Arcade arch lands you in ONE hall of cabinets (reused /arcade/cabinet-hall.webp,
// composed so glowing neighbours fill the margins). The housing is GOLD — the arcade
// "furniture", fixed across every game; only the game's own SCREEN glows its `accent`
// colour (the spill that ties the cabinet to its game). Identity = the cabinet skin,
// not a bespoke world per game. Policy: memory project_arcade_cabinet_not_world.
//
// Games keep their own header/HUD/footer INSIDE — this only provides the environment
// + the bordered housing, so it drops onto pages of any width.
export default function ArcadeCabinet({
  children,
  accent = '#37e6ff',
  wall = 1,
  maxWidth = 400,
}: {
  children: React.ReactNode
  accent?: string
  wall?: number
  maxWidth?: number | string
}) {
  const rgb = hexToRgb(accent)
  return (
    <div className="relative min-h-screen bg-[#050309] text-[#7fd8e6] flex flex-col items-center justify-center px-4 py-6 select-none">
      {/* the hall the room's Arcade arch shows — pushed back + soft-blurred (depth of
          field behind the sharp cabinet; also mutes the gen's fake marquee text). */}
      <div
        aria-hidden
        className="fixed inset-0 -z-20 bg-cover bg-center"
        style={{ backgroundImage: 'url(/arcade/cabinet-hall.webp)', filter: 'brightness(1.1) saturate(0.92) blur(2px)' }}
      />
      {/* arcade light around the cabinet: warm marquee glow from the top, colourful
          floor-glow from the bottom, the game's screen-spill in the middle, gentle dim. */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          background:
            'linear-gradient(to bottom, rgba(212,168,67,0.17), transparent 24%),' +
            `linear-gradient(to top, rgba(${rgb},0.12), rgba(155,90,210,0.07) 9%, transparent 26%),` +
            `radial-gradient(ellipse 58% 40% at 50% 50%, rgba(${rgb},0.08), transparent 62%),` +
            'linear-gradient(rgba(5,3,9,0.2), rgba(5,3,9,0.4))',
        }}
      />
      <RoomReturn wall={wall} />

      {/* the cabinet housing — dark panel, gold trim (shared arcade furniture). */}
      <div
        className="relative w-full flex flex-col items-center rounded-2xl border border-[#d4a843]/25 bg-[#08080f]/70 backdrop-blur-sm px-3.5 pt-3 pb-3.5"
        style={{ maxWidth, boxShadow: `0 14px 70px rgba(0,0,0,0.7), inset 0 0 30px rgba(${rgb},0.05)` }}
      >
        {children}
      </div>
    </div>
  )
}
