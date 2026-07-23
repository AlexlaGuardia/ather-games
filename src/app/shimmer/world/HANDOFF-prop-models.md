# HANDOFF — wire GLB station props into StructureMarkers (art → hub)

Art lane built `world/prop-models.tsx` + shipped 4 optimized GLBs. The mount is a
**two-line swap inside `play3d/Shimmer3D.tsx`**, which is hub's file — hence this spec
instead of a cross-lane edit.

## The edit

`play3d/Shimmer3D.tsx`, `StructureMarkers` (~line 453). Replace the two blockout meshes —
the body box and the accent cap — with one component. **Keep the third mesh** (the little
white interaction sphere at `[0.35, def.h * 0.6, 0]`); that's a gameplay affordance, not art.

```tsx
import { StationProp } from '../world/prop-models'
// ...
<group key={...} position={[s.tileX, y, s.tileY]} rotation={[0, -s.facing * Math.PI / 180, 0]}>
  <StationProp id={s.itemId} def={def} />
  <mesh position={[0.35, def.h * 0.6, 0]}><sphereGeometry args={[0.08, 8, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>
</group>
```

`PLACEABLES` entries already match `PropDef` ({ name, color, accent, h }) — no type work.

Optional, on the play3d boot preload alongside `preloadFlora()`:
```tsx
import { preloadProps } from '../world/prop-models'
preloadProps()
```

## Why this is safe to wire blind

- `StationProp` falls back to the **exact original blockout** (same geometry, same colours) on
  three paths: id has no model, Suspense, and an error boundary. A 404 or corrupt GLB renders
  the old look; it cannot crash the scene.
- `farm_planter` has **no** model on purpose (rejected on the eyeball gate — see the note in
  `PROP_MODELS`). It will render the blockout box. That is expected, not a bug.
- The **placement ghost** (the translucent preview box ~line 500) is deliberately untouched —
  a see-through box reads better as a ghost than a solid mesh does.

## What it does NOT change

Collision, interaction radius, station menus, save format. Props are auto-fitted to the 0.82
tile footprint and sit their base at y=0, so they occupy the same space the box did.

## Assets

`public/models/props/{alchemy_station,chest,crafting_table,exchange_booth}.glb` — 332KB total,
4k tris and a 512px texture each, Draco-compressed. Decoder is vendored at `public/draco/`
(NOT the gstatic CDN drei defaults to — no third-party runtime dependency).
