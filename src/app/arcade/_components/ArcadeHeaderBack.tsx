"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// The hall's header back-link. When you arrived via the spatial Room (?from=room, or
// the sticky session flag RoomReturn sets), it points BACK to the room so the loop
// never dead-ends at the old hub. Direct catalog visitors still get "← hub".
export default function ArcadeHeaderBack({ className }: { className?: string }) {
  const [room, setRoom] = useState(false);
  useEffect(() => {
    try {
      const fromParam = new URLSearchParams(window.location.search).get("from") === "room";
      setRoom(fromParam || sessionStorage.getItem("ag_from_room") === "1");
    } catch {
      /* no storage */
    }
  }, []);
  return room ? (
    <Link href="/room?wall=1" className={className}>
      &#8592; room
    </Link>
  ) : (
    <Link href="/arcade" className={className}>
      &#8592; hub
    </Link>
  );
}
