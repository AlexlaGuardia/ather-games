// Shows a "back to the room" affordance on every cabinet. The Room is the front
// door now (/arcade redirects into it), so the pill is ALWAYS visible — no game
// is a dead-end however you arrived (direct URL, shared link, or walking in).
// (Was gated on ?from=room until 2026-06-30; that left direct visits pill-less.)

// `wall` = the room wall index this page sits behind (shimmer 0 / arcade 1 / desk 2
// / magii 3). Passed so "back" lands you facing the threshold you walked through,
// not the room's default wall. Omit to return to the default facing.
export default function RoomReturn({ wall }: { wall?: number } = {}) {
  return (
    <a
      href={wall === undefined ? "/room" : `/room?wall=${wall}`}
      className="fixed top-4 left-4 z-50 flex items-center gap-2 rounded-md border border-[#d4a843]/30 bg-[#12121e]/80 backdrop-blur px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-[#d4a843]/80 transition hover:text-[#d4a843] hover:border-[#d4a843]/60"
    >
      &#8249; back to the room
    </a>
  );
}
