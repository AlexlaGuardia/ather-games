import Link from "next/link";

// The hall's header back-link. The Room is the front door of ather.games and the
// only "back" from the hall now (the old flat /arcade hub is retired → redirects to
// /room). wall=1 lands you facing the Arcade arch you walked through.
export default function ArcadeHeaderBack({ className }: { className?: string }) {
  return (
    <Link href="/room?wall=1" className={className}>
      &#8592; room
    </Link>
  );
}
