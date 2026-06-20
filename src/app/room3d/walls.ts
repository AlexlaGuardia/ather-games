// Shared room metadata — imported by both the 3D scene and the DOM HUD.

export type WallId = "shimmer" | "arcade" | "desk" | "magii";
export type Phase = "room" | "approach" | "open" | "through";

export interface RoomWall {
  id: WallId;
  label: string;
  accent: string;
  href: string | null; // null = in-place wall (Front Desk), no route-out
  pos: [number, number, number];
  rot: [number, number, number];
}

export const R = 4;     // half footprint (walls at ±R)
export const H = 5;     // room height
export const EYE = 1.7; // camera height

// order = turn order (right = next index). Mug is index 3 (the audio target).
export const WALLS: RoomWall[] = [
  { id: "shimmer", label: "Shimmer",     accent: "#8b5cf6", href: "/shimmer",    pos: [0, H / 2, -R], rot: [0, 0, 0] },
  { id: "arcade",  label: "The Arcade",  accent: "#d4a843", href: "/arcade/all", pos: [R, H / 2, 0],  rot: [0, -Math.PI / 2, 0] },
  { id: "desk",    label: "Front Desk",  accent: "#00cccc", href: null,          pos: [0, H / 2, R],  rot: [0, Math.PI, 0] },
  { id: "magii",   label: "Kindled Mug", accent: "#e0792f", href: "/magii",      pos: [-R, H / 2, 0], rot: [0, Math.PI / 2, 0] },
];

export const N = WALLS.length;
export const MUG_INDEX = 3;
