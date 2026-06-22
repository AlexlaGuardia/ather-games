# ather.games

The game site for the **Athernyx** world. A small arcade, a spatial hub you walk through, the Shimmer sandbox, and the Spirit Grimoire. Built in public.

Live at **[ather.games](https://ather.games)**.

## What's in here

- **The Room** (`/room`) — a first-person hub: four walls (the Kindled Mug tavern, the Shimmer screen, the Arcade arch, the Front Desk) you turn between and step through.
- **The Arcade** (`/arcade`) — a catalog of small original games, each its own cabinet in one shared hall:
  - **Atherdash** (lane runner), **Ward** (vector defense), **Updraft** (one-tap flight), **Voranyx** (glowing slither), **Seedfall** (a long drifting descent), **Mana'nana** (match-three), **Rekindle** (a conduit puzzle).
- **The Daily Challenge** — one seeded run per day across the score-chase games, with a shared server leaderboard.
- **The Spirit Grimoire** (`/grimoire`) — the in-world bestiary: page through every spirit, its element, quirk, and evolution tree.
- **Shimmer** (`/shimmer`) — the pixel sandbox + its dev editors.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind · Canvas + PixiJS for the games. Game logic lives in pure, testable sim modules (`src/app/<game>/lib/`) with the canvas/React layer on top.

## Layout

```
src/app/<game>/        a game (page.tsx + lib/ sim + sfx)
src/app/room/          the spatial hub
src/app/grimoire/      the bestiary (reads public/grimoire/spirits.json at runtime)
src/lib/arcade/        shared toolkit (daily challenge, leaderboard, rng)
src/app/_components/    ArcadeCabinet, RoomReturn, DailyLeaderboard
```
