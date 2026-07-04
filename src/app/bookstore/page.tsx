import { Suspense } from "react";
import { fetchManifest, groupByWork } from "./lib/manifest";
import Bookstore from "./Bookstore";

// Eyuun's Bookstore — the public "listen" room. Server-fetches the shared narration
// manifest (revalidated every 5 min at the fetch layer in manifest.ts) and hands the
// grouped shelves to the client player. Reached from the Room by clicking Momo at the
// Front Desk.
export default async function BookstorePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const { books } = await fetchManifest();
  const groups = groupByWork(books);
  return (
    <Suspense fallback={null}>
      <Bookstore groups={groups} fromRoom={from === "room"} />
    </Suspense>
  );
}
