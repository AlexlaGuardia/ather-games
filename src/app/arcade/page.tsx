import { redirect } from "next/navigation";

// The old flat hub ("the landing of ather.games") is retired — the Room is the
// front door now. Anything that still points at /arcade (bookmarks, stale links)
// lands in the Room instead of the dead old hub. The catalog lives at /arcade/all,
// reached through the Room's Arcade arch.
export default function ArcadeHubRedirect() {
  redirect("/room");
}
