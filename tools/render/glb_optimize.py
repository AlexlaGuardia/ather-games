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
#   2. keep a HIGH-POLY COPY of every mesh before touching it
#   3. DECIMATE to a triangle budget (collapse; the silhouette is what survives)
#   4. UV-unwrap the low copy, then BAKE the high copy's surface onto it —
#      a tangent-space NORMAL map (the detail decimation just deleted) and a
#      COLOR map (so the new UV layout has matching albedo)
#   5. downscale + recompress any surviving source texture
#   6. re-export GLB with Draco geometry compression
#
# ★ WHY STEP 4 EXISTS, AND WHY IT IS ON BY DEFAULT (added 2026-09-03).
# Without it this tool threw away most of what Meshy was paid for. Measured on the Vault
# door: the raw mesh carried 336k tris of iron strap, stud and plank definition, decimate
# collapsed that to 4k, and NOTHING carried the detail into the low-poly — so a paid
# generation shipped looking like an untextured blockout. A normal map is the whole point
# of a high-to-low pipeline: the silhouette gets cheap, the SURFACE survives. Every prop
# baked before today (chest, crafting_table, alchemy_station, exchange_booth, farm_planter,
# gun_bench, vault_door) predates this and is worth re-running from its raw GLB.
# `--no-bake` restores the old behaviour; it is an escape hatch, not a normal choice.
#
# ★ THE BAKE REPORTS WHETHER IT RAN. IT DOES NOT REPORT WHETHER IT WAS ANY GOOD.
# A bake that silently fails does not error — it writes a uniform (128,128,255) flat map, and
# a flat normal map is indistinguishable from no normal map at all except by measuring it. So
# every bake counts the pixels that deviate from flat and prints that number; below
# --bake-min-detail the run EXITS NON-ZERO and says BLIND, because "I baked nothing" and
# "there was nothing to bake" must not share an exit code.
#
# ⚠ THAT NUMBER IS A BLINDNESS DETECTOR AND NOTHING MORE — DO NOT READ IT AS QUALITY.
# Measured on mb-charred-rifle-1 while building this: a real 31k->4k bake scores 50.7%, and an
# IDENTITY bake — source geometrically identical to target, nothing whatsoever to capture —
# scores 47.0%, unchanged across cage ratios from 0.02 down to 0.001. Almost all of it is
# coincident-surface ray noise. The statistic therefore cannot separate a good bake from a
# useless one; it can only separate a bake from no bake. Two things follow, and both matter:
#   - Do not raise --bake-min-detail hoping to gate quality. It would gate nothing and would
#     fail honest assets. It is a floor against silence, and 0.5% is already generous.
#   - To judge a bake, LOOK AT IT: `tools/render/bake_compare.py` renders the high-poly, the
#     low-poly with the map and the low-poly without it under one camera and one light. If the
#     last two look alike, the bake bought nothing no matter what this percentage said.
#
# The budget is the point: a Shimmer prop should land in the LOW HUNDREDS of KB. If it
# doesn't, it isn't ready to ship — lower --tris/--tex rather than waving it through.
import bpy, sys, os, argparse, math
import numpy as np

FLAT = np.array([0.5, 0.5, 1.0], dtype=np.float32)  # what an unbaked tangent-space normal is


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", required=True)
    ap.add_argument("--out", dest="dst", required=True)
    ap.add_argument("--tris", type=int, default=4000, help="triangle budget after decimate")
    ap.add_argument("--tex", type=int, default=512, help="max texture edge in px")
    ap.add_argument("--no-draco", action="store_true")
    # ── bake ──
    ap.add_argument("--no-bake", action="store_true",
                    help="skip the high-to-low bake (ships the raw decimate, detail lost)")
    ap.add_argument("--bake-size", type=int, default=0,
                    help="baked map edge in px (default: --tex)")
    ap.add_argument("--cage-ratio", type=float, default=0.02,
                    help="cage extrusion as a fraction of the object's largest dimension")
    ap.add_argument("--bake-margin", type=int, default=4, help="island bleed in px")
    ap.add_argument("--bake-min-detail", type=float, default=0.5,
                    help="percent of normal-map pixels that must deviate from flat, or the run fails BLIND")
    ap.add_argument("--uv-angle", type=float, default=66.0, help="smart-project angle limit, degrees")
    return ap.parse_args(argv)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def meshes():
    return [o for o in bpy.data.objects if o.type == "MESH"]


def tri_count(objs=None):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in (objs or meshes()))


def only(*objs):
    """Deselect everything, select these, make the LAST one active."""
    for o in bpy.data.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[-1]


# ── 2. keep the high-poly ────────────────────────────────────────────────────────────
def duplicate_high(lows):
    """Return {low: high}. The high copies are the bake SOURCE and never reach the export."""
    pairs = {}
    for low in lows:
        high = low.copy()
        high.data = low.data.copy()
        high.name = low.name + "__high"
        bpy.context.scene.collection.objects.link(high)
        high.hide_render = False
        pairs[low] = high
    return pairs


# ── 3. decimate ──────────────────────────────────────────────────────────────────────
def decimate(budget):
    before = tri_count([o for o in meshes() if not o.name.endswith("__high")])
    if before <= budget:
        print(f"[opt] {before} tris already under budget {budget} — no decimate")
        return before, before
    ratio = budget / before
    for o in meshes():
        if o.name.endswith("__high"):
            continue
        m = o.modifiers.new("decimate", "DECIMATE")
        m.decimate_type = "COLLAPSE"
        m.ratio = ratio
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=m.name)
    after = tri_count([o for o in meshes() if not o.name.endswith("__high")])
    print(f"[opt] decimate {before} -> {after} tris (ratio {ratio:.4f})")
    return before, after


# ── 4. bake ──────────────────────────────────────────────────────────────────────────
def uv_coverage(obj):
    """Fraction of the texture the UV islands actually occupy, as a percent.

    ★ THIS IS THE INSTRUMENT THAT MATTERS, and it is the one that was missing. A bake writes
    detail only where there are islands; everything else is wasted texels. The first version of
    this pipeline shipped smart_project's default island_margin of 0.02 — 2% of the sheet PER
    ISLAND — which on a 4k-tri mesh with hundreds of islands ate the texture alive: coverage
    came out at ~11%, so a 2048px Meshy albedo was being resampled into the effective area of a
    ~170px map. The renders looked melted and blotchy, and NOT because of the normal map: the
    no-normal-map control was equally smeared, which is what pinned it on the colour bake.
    Unlike the deviation percentage below, this number discriminates — low coverage always
    means a worse bake, and it is fixable by packing rather than by spending more credits."""
    total = 0.0
    for layer in [obj.data.uv_layers.active]:
        if layer is None:
            return 0.0
        uvs = layer.data
        for poly in obj.data.polygons:
            pts = [uvs[i].uv for i in poly.loop_indices]
            for k in range(1, len(pts) - 1):          # fan-triangulate the face in UV space
                a0, b0, c0 = pts[0], pts[k], pts[k + 1]
                total += abs((b0.x - a0.x) * (c0.y - a0.y) - (c0.x - a0.x) * (b0.y - a0.y)) / 2
    return total * 100.0


def unwrap(obj, angle_deg, size):
    only(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    # island_margin=0 here on purpose — spacing is applied ONCE by the pack below, in pixels.
    # Asking smart_project for the margin as well charges it per island and is what destroyed
    # coverage; the bake's own --bake-margin then bleeds across the seams that remain.
    bpy.ops.uv.smart_project(angle_limit=math.radians(angle_deg), island_margin=0.0)
    packed = False
    try:
        bpy.ops.uv.select_all(action="SELECT")
        bpy.ops.uv.average_islands_scale()            # equal texel density before packing
        # ★ margin_method="ADD" IS LOAD-BEARING, MEASURED — the default charges the margin PER
        # ISLAND and a 4k-tri smart projection has hundreds of them, so the spacing eats the
        # sheet. Same mesh, same 1px gap, coverage by method: ADD 55%, FRACTION 45%, SCALED 39%.
        # And the shipped default before today (smart_project island_margin=0.02) measured 1.7%.
        bpy.ops.uv.pack_islands(rotate=True, margin=1.0 / max(size, 1), margin_method="ADD")
        packed = True
    except RuntimeError as e:
        # background Blender has no UV editor, so these can refuse context. Say so out loud
        # rather than shipping a badly packed sheet that only shows up as a soft render.
        print(f"[bake] WARNING repack unavailable ({e}) — coverage will be poor")
    bpy.ops.object.mode_set(mode="OBJECT")
    cov = uv_coverage(obj)
    print(f"[bake] {obj.name}: UV coverage {cov:.1f}% of the sheet"
          f"{' (packed)' if packed else ' (UNPACKED)'}")
    return cov


def source_surface(high):
    """Read roughness/metallic off the high-poly so the rebuilt material isn't a guess."""
    rough, metal = 0.75, 0.0
    for slot in high.material_slots:
        m = slot.material
        if not (m and m.use_nodes):
            continue
        for n in m.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                return n.inputs["Roughness"].default_value, n.inputs["Metallic"].default_value
    return rough, metal


def bake_target_material(obj, img_color, img_normal, rough, metal):
    """One flat material on the low poly: the two baked maps, wired. Also the bake target."""
    mat = bpy.data.materials.new(obj.name + "_baked")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal

    tc = nt.nodes.new("ShaderNodeTexImage"); tc.image = img_color;  tc.location = (-600, 200)
    tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = img_normal; tn.location = (-600, -200)
    nm = nt.nodes.new("ShaderNodeNormalMap");                        nm.location = (-300, -200)
    nt.links.new(bsdf.inputs["Base Color"], tc.outputs["Color"])
    nt.links.new(nm.inputs["Color"], tn.outputs["Color"])
    nt.links.new(bsdf.inputs["Normal"], nm.outputs["Normal"])

    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return mat, tc, tn


def deviation_pct(img):
    """How much of this map is NOT flat. A silently-failed bake reads ~0."""
    buf = np.empty(len(img.pixels), dtype=np.float32)
    img.pixels.foreach_get(buf)
    rgb = buf.reshape(-1, 4)[:, :3]
    return float((np.abs(rgb - FLAT).max(axis=1) > 0.02).mean() * 100.0)


def bake_pair(low, high, size, cage_ratio, margin, uv_angle):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    scene.cycles.use_denoising = False

    cov = unwrap(low, uv_angle, size)

    # ★ SEED THE NORMAL MAP FLAT, NOT BLACK. A new Blender image is BLACK, and Blender's own
    # bake-clear fills black too — so every pixel outside a UV island reads as "deviating from
    # flat" and the detail measurement below ends up counting EMPTY UV SPACE. Measured: with a
    # black background an identity bake (source geometrically identical to target, nothing to
    # capture) still scored 47% and sailed past the guard. Seeded flat with use_clear off, the
    # same identity bake collapses to near zero and the guard fires. The background is also
    # genuinely correct this way: unbaked texels mean "no deviation", which is what flat encodes.
    img_n = bpy.data.images.new(low.name + "_normal", size, size, alpha=False)
    img_n.generated_color = (0.5, 0.5, 1.0, 1.0)
    img_n.colorspace_settings.name = "Non-Color"
    img_n.file_format = "PNG"                     # never JPEG a normal map — chroma subsampling eats it
    img_c = bpy.data.images.new(low.name + "_color", size, size, alpha=False)
    img_c.file_format = "JPEG"

    rough, metal = source_surface(high)
    mat, node_c, node_n = bake_target_material(low, img_c, img_n, rough, metal)

    ext = cage_ratio * max(max(high.dimensions), 1e-4)
    bake = scene.render.bake
    bake.use_selected_to_active = True
    bake.cage_extrusion = ext
    bake.max_ray_distance = 0.0                   # 0 = unlimited; a short leash gives dropout, not safety
    bake.margin = margin
    # bleed ALONG THE MESH, not in a flat ring. With islands packed a pixel apart a flat bleed
    # would spill onto the neighbouring island; ADJACENT_FACES follows topology and does not.
    bake.margin_type = "ADJACENT_FACES"
    bake.use_clear = False                        # keep the flat seed above; see the note there

    only(high, low)                               # source(s) selected, target ACTIVE

    mat.node_tree.nodes.active = node_n
    bpy.ops.object.bake(type="NORMAL")

    mat.node_tree.nodes.active = node_c
    bake.use_pass_direct = False
    bake.use_pass_indirect = False
    bake.use_pass_color = True
    bpy.ops.object.bake(type="DIFFUSE")

    img_n.pack()
    img_c.pack()

    dev = deviation_pct(img_n)
    print(f"[bake] {low.name}: {size}px, cage {ext:.4f} — normal map {dev:.2f}% of pixels off flat")
    if cov < 25.0:
        print(f"[bake] ⚠ UV coverage {cov:.1f}% is LOW — most of the {size}px sheet is unused, so "
              f"the baked detail is being resampled into a fraction of it. Expect a soft, smeared "
              f"prop. Check the repack warning above before blaming the mesh or the credits.")
    return dev


def bake_all(pairs, a, decimated):
    if a.no_bake:
        print("[bake] SKIPPED (--no-bake) — decimated detail is gone and nothing carries it")
        return None
    if not decimated:
        print("[bake] skipped — mesh was already under budget, no detail was lost")
        return None
    size = a.bake_size or a.tex
    devs = [bake_pair(low, high, size, a.cage_ratio, a.bake_margin, a.uv_angle)
            for low, high in pairs.items()]
    return max(devs) if devs else None


# ── 5. textures ──────────────────────────────────────────────────────────────────────
def shrink_textures(max_edge):
    for img in bpy.data.images:
        if img.size[0] == 0 or img.name.endswith(("_normal", "_color")):
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

    lows = meshes()
    if not lows:
        sys.exit("[opt] FAIL — no mesh in the imported GLB")
    pairs = duplicate_high(lows)

    before, after = decimate(a.tris)
    dev = bake_all(pairs, a, decimated=after < before)

    for high in pairs.values():                   # the source never ships
        bpy.data.objects.remove(high, do_unlink=True)

    shrink_textures(a.tex)

    os.makedirs(os.path.dirname(os.path.abspath(a.dst)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=a.dst,
        export_format="GLB",
        export_draco_mesh_compression_enable=not a.no_draco,
        export_draco_mesh_compression_level=6,
        export_image_format="AUTO",               # honours PNG-for-normal / JPEG-for-color above
    )
    src_mb = os.path.getsize(a.src) / 1048576
    dst_mb = os.path.getsize(a.dst) / 1048576
    print(f"[opt] {a.src} {src_mb:.2f}MB  ->  {a.dst} {dst_mb:.2f}MB  "
          f"({src_mb / max(dst_mb, 1e-6):.1f}x smaller, {after} tris)")

    if dev is not None and dev < a.bake_min_detail:
        sys.exit(f"[bake] BLIND — normal map is {dev:.2f}% off flat, under --bake-min-detail "
                 f"{a.bake_min_detail}%. The bake produced a flat map, which is the same as no "
                 f"bake at all. Do not ship this; check the cage (--cage-ratio) and the UVs.")


try:
    main()
except SystemExit:
    raise
except Exception as e:
    # ★ MEASURED 2026-09-03: `blender -b -P script.py` EXITS 0 WHEN THE SCRIPT RAISES.
    # A traceback goes to the log, no GLB is written, and the caller's `&&` chain proceeds as
    # if the optimize succeeded. (`sys.exit(msg)` DOES propagate as 1, which is why the BLIND
    # guard above is honest; a bare raise is not.) `--python-exit-code 1` on the blender command
    # line fixes it too, but that lives in whoever's shell history — this lives in the tool.
    import traceback; traceback.print_exc()
    sys.exit(f"[opt] FAILED — {e}")
