"use client";

// Shows a "back to the room" affordance only when the page was reached via the
// spatial Room hub (?from=room). Invisible for normal /arcade visitors, so the
// throwaway /room prototype never leaks into the live nav.
import { useEffect, useState } from "react";

export default function RoomReturn() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(new URLSearchParams(window.location.search).get("from") === "room");
  }, []);
  if (!show) return null;
  return (
    <a
      href="/room"
      className="fixed top-4 left-4 z-50 flex items-center gap-2 rounded-md border border-[#d4a843]/30 bg-[#12121e]/80 backdrop-blur px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-[#d4a843]/80 transition hover:text-[#d4a843] hover:border-[#d4a843]/60"
    >
      &#8249; back to the room
    </a>
  );
}
