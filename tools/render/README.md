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
