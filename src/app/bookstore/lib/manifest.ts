// Eyuun's Bookstore — the "listen" half of the Atelier, brought to the public
// Room hub. The narration lives in akatskii-web's /public/listen (~500MB of mp3s,
// grown by the audiobook autopilot). Rather than copy all of it into ather-games,
// we read the SAME manifest server-side and point <audio> straight at akatskii.com
// (cross-origin media playback needs no CORS; the manifest fetch is server→server
// so CORS never enters it). New narrations show up here within the revalidate
// window — no redeploy, always in sync with the shelf Alex is filling.

// Browser-facing asset base: SAME-ORIGIN /listen/, proxied to the local akatskii-web
// process by the rewrite in next.config.ts. Cross-origin akatskii.com media stalls in
// the browser (Cloudflare hotlink hang); same-origin plays cleanly with range support.
export const ASSET_BASE = "/listen/";

// The manifest is fetched SERVER-SIDE (server→server, no browser Origin) straight from
// the local akatskii-web process — fast, and never touches Cloudflare.
const MANIFEST_URL = "http://localhost:3100/listen/manifest.json";

export interface Chapter {
  n: number;
  title: string;
  file: string; // absolute URL after normalize()
  duration_seconds: number;
}

export interface Book {
  id: number;
  work: string; // "spirit-tales" | "secrets-of-athernyx"
  title: string;
  cover: string | null; // absolute URL after normalize()
  voice: string;
  chapters: Chapter[];
}

export interface Manifest {
  books: Book[];
}

// ── PUBLISHED SHELF — the public allowlist ────────────────────────────────────
// The narration manifest carries EVERY book that's been narrated, including ones
// still being revised or not yet published. This store is public-facing, so it
// only shows books whose id is listed here. Publish a book → add its manifest id.
// (Find an id: the manifest at akatskii.com/listen/manifest.json — `id` per book.)
const PUBLISHED_IDS = new Set<number>([
  101, // Secrets of Athernyx — Vol. One: The Heretic  (the hero; remove to pull it)
  1,   // Bonn #1 — Bonn and the Great Discovery
  2,   // Bonn #2 — Bonn and the Borrowed Courage
  3,   // Bonn #3 — Bonn and the Hollow Crown  (published 2026-07-04, KDP eBook + paperback)
  // Bonn #4+ not locked in — add as they ship.
]);

const WORK_LABELS: Record<string, string> = {
  "secrets-of-athernyx": "Secrets of Athernyx",
  "spirit-tales": "Spirit Tales",
};

export function workLabel(key: string): string {
  return WORK_LABELS[key] ?? key;
}

/** A book's work, defaulting legacy (work-less) manifest entries to spirit-tales. */
function bookWork(raw: { work?: string }): string {
  return raw.work ?? "spirit-tales";
}

/** Prefix a manifest-relative path with the akatskii.com asset base. Passes through
 *  anything that's already absolute (http/https) so this stays idempotent. */
function abs(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return ASSET_BASE + path.replace(/^\/+/, "");
}

export interface WorkGroup {
  key: string;
  label: string;
  books: Book[];
}

/** Group books by work. Secrets of Athernyx (Eyuun's own book) leads the store,
 *  then Spirit Tales. Order within a group follows the manifest. */
export function groupByWork(books: Book[]): WorkGroup[] {
  const order: string[] = [];
  const map = new Map<string, Book[]>();
  for (const b of books) {
    if (!map.has(b.work)) {
      map.set(b.work, []);
      order.push(b.work);
    }
    map.get(b.work)!.push(b);
  }
  const rank = (k: string) => (k === "secrets-of-athernyx" ? 0 : k === "spirit-tales" ? 1 : 2);
  order.sort((a, b) => rank(a) - rank(b));
  return order.map((k) => ({ key: k, label: workLabel(k), books: map.get(k)! }));
}

/** Fetch the shared narration manifest server-side and normalize every asset path
 *  to an absolute akatskii.com URL. Revalidates every 5 min so freshly-narrated
 *  books appear without a redeploy. Returns an empty book list if the manifest is
 *  unreachable (the store renders a graceful "coming soon" rather than crashing). */
export async function fetchManifest(): Promise<Manifest> {
  try {
    const res = await fetch(MANIFEST_URL, { next: { revalidate: 300 } });
    if (!res.ok) return { books: [] };
    const raw = (await res.json()) as { books?: Array<Record<string, unknown>> };
    const books: Book[] = (raw.books ?? [])
      .filter((b) => PUBLISHED_IDS.has((b as { id: number }).id))
      .map((b) => {
      const rec = b as {
        id: number;
        work?: string;
        title: string;
        cover: string | null;
        voice: string;
        chapters: Array<{ n: number; title: string; file: string; duration_seconds: number }>;
      };
      return {
        id: rec.id,
        work: bookWork(rec),
        title: rec.title,
        cover: abs(rec.cover),
        voice: rec.voice,
        chapters: (rec.chapters ?? []).map((c) => ({
          n: c.n,
          title: c.title,
          file: abs(c.file)!,
          duration_seconds: c.duration_seconds,
        })),
      };
    });
    return { books };
  } catch {
    return { books: [] };
  }
}

/** Total narrated runtime of a book, in seconds. */
export function bookRuntime(b: Book): number {
  return b.chapters.reduce((a, c) => a + (c.duration_seconds || 0), 0);
}

/** Human runtime label, e.g. "1h 12m" / "48m". */
export function fmtRuntime(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** mm:ss for the scrubber / chapter durations. */
export function fmtClock(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
