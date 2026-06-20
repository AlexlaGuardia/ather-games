import { redirect } from "next/navigation";

// The Room is the front door of ather.games. The Arcade is now one of its walls
// (the Arcade wall → /arcade/all); /arcade still exists as the flat directory.
export default function Home() {
  redirect("/room");
}
