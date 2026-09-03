# ── BAKE COMPARE — does the normal map actually put the detail back? ──
# Renders the same prop three ways under identical camera and light and writes three PNGs:
#   _high.png    the raw Meshy mesh, full tri count — the target to match
#   _flat.png    the optimized low-poly with its normal map DISCONNECTED — what this pipeline
#                shipped before 2026-09-03
#   _normal.png  the optimized low-poly with the normal map wired — what it ships now
#
# ★ WHY THIS EXISTS. The bake prints a "% of pixels off flat" number, and that number is a
# BLINDNESS detector, not a quality meter: it says a bake happened, not that it captured
# anything worth having. An identity bake (source geometrically identical to target) scores
# ~47% purely from coincident-surface ray noise, so the statistic cannot separate a good bake
# from a useless one. A picture can. Compare _flat against _normal: if they look the same, the
# bake bought nothing regardless of what the percentage said.
#
#   /opt/blender/blender -b -P tools/render/bake_compare.py -- \
#       --high raw.glb --low public/models/props/x.glb --out /tmp/cmp/x
import bpy, sys, os, argparse, math
from mathutils import Vector


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--high", required=True)
    ap.add_argument("--low", required=True)
    ap.add_argument("--out", required=True, help="path PREFIX; _high/_flat/_normal.png are appended")
    ap.add_argument("--res", type=int, default=640)
    ap.add_argument("--samples", type=int, default=64)
    return ap.parse_args(argv)


def fresh():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def meshes():
    return [o for o in bpy.data.objects if o.type == "MESH"]


def bounds():
    """World-space centre and radius of everything loaded."""
    pts = [o.matrix_world @ Vector(c) for o in meshes() for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return (lo + hi) / 2, max((hi - lo).length / 2, 1e-4)


def stage(res, samples):
    """Camera and light are derived from the loaded bounds, so all three shots frame alike."""
    centre, r = bounds()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.render.resolution_x = scene.render.resolution_y = res
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new("w")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.05, 0.06, 1)

    cam_d = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_d)
    bpy.context.scene.collection.objects.link(cam)
    # raking three-quarter view: the angle that shows surface relief instead of hiding it
    dirv = Vector((0.78, -0.78, 0.42)).normalized()
    cam.location = centre + dirv * (r * 3.1)
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (-dirv).to_track_quat("-Z", "Y")
    cam_d.lens = 60
    scene.camera = cam

    key_d = bpy.data.lights.new("key", "AREA")
    key_d.energy = 900 * r * r
    key_d.size = r * 1.6
    key = bpy.data.objects.new("key", key_d)
    bpy.context.scene.collection.objects.link(key)
    kdir = Vector((0.2, -0.9, 0.75)).normalized()   # low and to the side — grazing light reads relief
    key.location = centre + kdir * (r * 4.0)
    key.rotation_mode = "QUATERNION"
    key.rotation_quaternion = (-kdir).to_track_quat("-Z", "Y")

    rim_d = bpy.data.lights.new("rim", "AREA")
    rim_d.energy = 300 * r * r
    rim_d.size = r * 2.0
    rim = bpy.data.objects.new("rim", rim_d)
    bpy.context.scene.collection.objects.link(rim)
    rdir = Vector((-0.8, 0.5, 0.35)).normalized()
    rim.location = centre + rdir * (r * 4.0)
    rim.rotation_mode = "QUATERNION"
    rim.rotation_quaternion = (-rdir).to_track_quat("-Z", "Y")


def shoot(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f"[cmp] wrote {path}")


def unwire_normals():
    """Cut every Normal input. This is the pre-2026-09-03 pipeline, exactly."""
    cut = 0
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for n in mat.node_tree.nodes:
            if n.type != "BSDF_PRINCIPLED":
                continue
            inp = n.inputs.get("Normal")
            for link in list(inp.links):
                mat.node_tree.links.remove(link)
                cut += 1
    print(f"[cmp] disconnected {cut} normal link(s)")
    return cut


def main():
    a = parse_args()
    os.makedirs(os.path.dirname(os.path.abspath(a.out)) or ".", exist_ok=True)

    fresh()
    bpy.ops.import_scene.gltf(filepath=a.high)
    stage(a.res, a.samples)
    shoot(a.out + "_high.png")

    fresh()
    bpy.ops.import_scene.gltf(filepath=a.low)
    stage(a.res, a.samples)
    shoot(a.out + "_normal.png")

    cut = unwire_normals()
    shoot(a.out + "_flat.png")

    if cut == 0:
        sys.exit("[cmp] BLIND — the low-poly had no normal map wired, so _flat and _normal are "
                 "the SAME RENDER and the comparison proves nothing. Re-run glb_optimize.py "
                 "without --no-bake.")


try:
    main()
except SystemExit:
    raise
except Exception as e:                # Blender exits 0 on an uncaught exception in a -P script
    import traceback; traceback.print_exc()
    sys.exit(f"[cmp] FAILED — {e}")
