import type { MetadataRoute } from "next";

// PWA / "add to home screen" identity for ather.games. Next serves this at
// /manifest.webmanifest and auto-links it.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ather.games — the Athernyx arcade",
    short_name: "ather.games",
    description: "Playable corners of the Athernyx world — an arcade of original games.",
    start_url: "/",
    display: "standalone",
    background_color: "#05060e",
    theme_color: "#05060e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
