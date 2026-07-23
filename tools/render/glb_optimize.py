# ── GLB OPTIMIZER — make a Meshy mesh shippable to a WEB game ──
# Runs INSIDE headless Blender. Meshy hands back film-grade geometry (~440k tris, 2-4K
# textures, ~15MB per prop). A browser can't download that forty times over — so every
# asset that goes into play3d passes through here first.
#
#   /opt/blender/blender -b -P tools/render/glb_optimize.py -- \
#       --in raw.glb --out public/models/x.glb --tris 4000 --tex 512
#
# What it does, in order:
#   1. import the GLB
#   2. DECIMATE to a triangle budget (collapse; the silhouette is what survives)
#   3. downscale + recompress the baked texture (a 0.8-tile prop never needs 2K)
#   4. re-export GLB with Draco geometry compression
#
# The budget is the point: a Shimmer prop should land in the LOW HUNDREDS of KB. If it
# doesn't, it isn't ready to ship — lower --tris/--tex rather than waving it through.
import bpy, sys, os, argparse


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", required=True)
    ap.add_argument("--out", dest="dst", required=True)
    ap.add_argument("--tris", type=int, default=4000, help="triangle budget after decimate")
    ap.add_argument("--tex", type=int, default=512, help="max texture edge in px")
    ap.add_argument("--no-draco", action="store_true")
    return ap.parse_args(argv)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def tri_count():
    n = 0
    for o in bpy.data.objects:
        if o.type == "MESH":
            n += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return n


def decimate(budget):
    before = tri_count()
    if before <= budget:
        print(f"[opt] {before} tris already under budget {budget} — no decimate")
        return before, before
    ratio = budget / before
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        m = o.modifiers.new("decimate", "DECIMATE")
        m.decimate_type = "COLLAPSE"
        m.ratio = ratio
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=m.name)
    after = tri_count()
    print(f"[opt] decimate {before} -> {after} tris (ratio {ratio:.4f})")
    return before, after


def shrink_textures(max_edge):
    for img in bpy.data.images:
        if img.size[0] == 0:
            continue
        w, h = img.size
        if max(w, h) <= max_edge:
            print(f"[opt] texture {img.name} {w}x{h} already <= {max_edge}")
            continue
        s = max_edge / max(w, h)
        nw, nh = max(1, int(w * s)), max(1, int(h * s))
        img.scale(nw, nh)
        img.pack()
        print(f"[opt] texture {img.name} {w}x{h} -> {nw}x{nh}")


def main():
    a = parse_args()
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=a.src)
    before, after = decimate(a.tris)
    shrink_textures(a.tex)

    os.makedirs(os.path.dirname(os.path.abspath(a.dst)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=a.dst,
        export_format="GLB",
        export_draco_mesh_compression_enable=not a.no_draco,
        export_draco_mesh_compression_level=6,
        export_image_format="JPEG",
    )
    src_mb = os.path.getsize(a.src) / 1048576
    dst_mb = os.path.getsize(a.dst) / 1048576
    print(f"[opt] {a.src} {src_mb:.2f}MB  ->  {a.dst} {dst_mb:.2f}MB  ({src_mb / max(dst_mb, 1e-6):.1f}x smaller, {after} tris)")


main()
