# ── GLB PREVIEW — eyeball a mesh before it ships ──
# Runs INSIDE headless Blender. Imports a GLB, frames it in a 3/4 view lit like the
# Shimmer garden (honey-gold key + cool fill), renders a PNG. Use it to CHECK an
# optimizer pass actually kept the silhouette — a triangle budget you never looked at
# is a guess.
#
#   /opt/blender/blender -b -P tools/render/glb_preview.py -- --in x.glb --out x.png
import bpy, sys, os, math, argparse
from mathutils import Vector


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", required=True)
    ap.add_argument("--out", dest="dst", required=True)
    ap.add_argument("--res", type=int, default=512)
    return ap.parse_args(argv)


def bounds():
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector((min(lo[i], w[i]) for i in range(3)))
            hi = Vector((max(hi[i], w[i]) for i in range(3)))
    return lo, hi


def main():
    a = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=a.src)

    lo, hi = bounds()
    ctr = (lo + hi) / 2
    span = max((hi - lo)[i] for i in range(3)) or 1.0

    # 3/4 view, slightly above — how a player sees a garden prop
    d = span * 2.4
    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = ctr + Vector((d * 0.72, -d * 0.72, d * 0.52))
    dirv = (ctr - cam.location).normalized()
    cam.rotation_euler = dirv.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam

    # honey key + cool bounce (the garden's two-light read)
    key = bpy.data.objects.new("key", bpy.data.lights.new("key", "AREA"))
    key.data.energy = span * span * 900
    key.data.size = span * 2
    key.data.color = (1.0, 0.86, 0.62)
    key.location = ctr + Vector((d, -d * 0.6, d))
    key.rotation_euler = (ctr - key.location).normalized().to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(key)

    fill = bpy.data.objects.new("fill", bpy.data.lights.new("fill", "AREA"))
    fill.data.energy = span * span * 260
    fill.data.size = span * 3
    fill.data.color = (0.72, 0.82, 1.0)
    fill.location = ctr + Vector((-d, d * 0.5, d * 0.4))
    fill.rotation_euler = (ctr - fill.location).normalized().to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(fill)

    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.10, 0.09, 0.07, 1)
    bpy.context.scene.world = w

    s = bpy.context.scene
    s.render.engine = "BLENDER_EEVEE_NEXT"
    s.render.resolution_x = s.render.resolution_y = a.res
    s.render.film_transparent = False
    s.render.image_settings.file_format = "PNG"
    os.makedirs(os.path.dirname(os.path.abspath(a.dst)), exist_ok=True)
    s.render.filepath = a.dst
    bpy.ops.render.render(write_still=True)
    print(f"[preview] {a.src} -> {a.dst}")


main()
