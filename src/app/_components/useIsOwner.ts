import { useEffect, useState } from "react";

// Client-side owner check. The `ather_owner` unlock cookie is httpOnly, so JS
// can't read it — `/api/owner` reports the status instead (public route, returns
// { owner: false } for everyone else). Use this to hide owner-only affordances
// that would otherwise dump a non-owner onto the proxy's bare "Forbidden" page.
export function useIsOwner(): boolean {
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/owner", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { owner: false }))
      .then((d) => { if (alive && d.owner) setIsOwner(true); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return isOwner;
}
