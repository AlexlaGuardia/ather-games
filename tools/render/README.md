# tools/render — pre-rendered 3D → sprite sheet (render-to-sprite)

The arcade's "Clash Royale" art lane: model in 3D, bake to a flat sprite sheet the
game plays as 2D. No 3D engine at runtime. See GBOARD `## 🎨 Cross-cutting — PRE-RENDERED 3D ART`.

## Run
Headless Blender (installed at `/opt/blender`, 4.2.9 LTS — not in git):

    /opt/blender/blender -b -P tools/render/voidspawn.py

Writes frames to a scratch dir; pack into a strip with Pillow, e.g.:

    from PIL import Image
    N,S=8,128; sheet=Image.new("RGBA",(N*S,S),(0,0,0,0))
    for i in range(N): sheet.paste(Image.open(f"frames/f{i}.png").convert("RGBA"),(i*S,0))
    sheet.save("public/<game>/<entity>.png")

## Per-target checklist
- Set the ORTHO camera to match the CABINET's view (side / top-down / 3/4).
- Keep the frame square + creature base at a consistent foot line (blit code assumes ~0.82).
- Light cold/moody to match the game palette; a strong rim reads the silhouette.
- Wire the game's draw fn to blit the frame, and KEEP the procedural draw as a fallback.

First target shipped: `voidspawn.py` → `public/vault/foe-void.png` (Vault foe).

## Meshy.ai — AI mesh generation (front end of the modeling step)

`meshy.py` generates the *mesh* from a text prompt or a reference image, so a render
script imports a ready GLB instead of hand-authoring geometry in bpy. The rest of the
lane (light → ortho camera → render → sprite strip) is unchanged.

    # outside Blender — create + poll + download a GLB (stdlib only, key in ../../.env):
    python3 tools/render/meshy.py --balance
    python3 tools/render/meshy.py --text "a weathered dead-grey stone lantern" --out /tmp/meshy/lantern.glb
    python3 tools/render/meshy.py --image ref.png --out /tmp/meshy/prop.glb --polycount 20000 --topology quad

    # inside a render script — drop the GLB into the scene, then light + render as usual:
    from meshy_import import import_glb
    obj = import_glb("/tmp/meshy/lantern.glb", fit_size=2.0)

**Guardrails (baked into the file headers):**
- **Art-medium law:** dead-grey props / arcade code-built assets ONLY. Living Shimmer
  things (spirits) stay Alex's hand-drawn pixel art — never route them through Meshy.
- **Canon:** lock the design-brief first (`athernyx/CANON/design-briefs/`). Meshy
  generates *inside* the brief; you critique the render against it. It never invents a look.
- Key `MESHY_API_KEY` lives in `ather-games/.env` (gitignored). Text-to-3D = preview
  (geometry) then optional `--refine` (texture). Image-to-3D is one shot.
