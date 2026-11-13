"use client";

import { useEffect, useState } from "react";

// "N playing now" on the front page. Renders nothing at 0 (an empty world announced is worse than none)
// and nothing until the first answer lands, so the hero never flashes a wrong number.
export default function OnlineCount({ color }: { color: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    const tick = () =>
      fetch("/api/online")
        .then((r) => r.json())
        .then((b: { online?: number }) => live && setN(b.online ?? 0))
        .catch(() => {});
    tick();
    const id = setInterval(tick, 30_000);
    return () => { live = false; clearInterval(id); };
  }, []);
  if (n < 1) return null;
  return (
    <span className="inline-flex items-center gap-2 text-sm text-text/70">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: color }} />
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
      </span>
      <span><span className="tabular-nums">{n.toLocaleString()}</span> {n === 1 ? "keeper" : "keepers"} in the world now</span>
    </span>
  );
}
