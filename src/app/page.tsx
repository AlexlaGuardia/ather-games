import { redirect } from "next/navigation";

// Arcade is the public landing / directory of ather.games.
export default function Home() {
  redirect("/arcade");
}
