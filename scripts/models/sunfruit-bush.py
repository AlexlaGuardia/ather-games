# sunfruit-bush.py — picaso (bush-model branch, 2026-09-22)
# Procedural low-poly bush producer for Shimmer play3d flora (react-three-fiber / GLTFLoader).
# Reused for the whole bush FAMILY: change SEED / FRUIT_RGB / LEAF_RGB env vars for a variant
# (e.g. Moonberry = blue fruit, different seed) without touching the shape logic.
#
# Objects exported: 'Leaves' (low-poly faceted lump cluster, ~600-1400 tris) + 'Fruit'
# (8-12 small balls resting on the leaf surface near the crown). Materials are PLACEHOLDERS
# only (plain green / plain gold) — the game applies its own painted+toon material per the
# card system; this file just needs sane defaults so the neutral GLB previews sanely.
#
# Units = blocks = metres. Built in Blender's Z-up, exported Y-up (export_yup=True) so the
# glTF that ships to the game is already Y-up with the bush base sitting at y=0.
#
#   /opt/blender/blender -b -P scripts/models/sunfruit-bush.py
# Env: OUT (glb+png dir), RES (preview px), SEED (shape variant), N_FRUIT,
#      LEAF_RGB "r,g,b", FRUIT_RGB "r,g,b", FRUIT_R_MIN/MAX (ball radius range),
#      TARGET_W (x/z width), TARGET_H (height).
# The lump layout (tiers list below) is the shape itself -- a variant that needs a
# different silhouette edits that list; SEED alone reshuffles jitter/fruit placement.

import bpy, bmesh, os, math, random
from mathutils import Vector
from mathutils.bvhtree import BVHTree

OUT = os.environ.get('OUT', '/root/ather-games/public/models/flora')
RES = int(os.environ.get('RES', '640'))
SEED = int(os.environ.get('SEED', '1'))
N_FRUIT = int(os.environ.get('N_FRUIT', '10'))
LEAF_RGB = tuple(float(x) for x in os.environ.get('LEAF_RGB', '0.22,0.50,0.16').split(','))
FRUIT_RGB = tuple(float(x) for x in os.environ.get('FRUIT_RGB', '1.0,0.74,0.10').split(','))
FRUIT_R_MIN = float(os.environ.get('FRUIT_R_MIN', '0.05'))
FRUIT_R_MAX = float(os.environ.get('FRUIT_R_MAX', '0.07'))
TARGET_W = float(os.environ.get('TARGET_W', '1.0'))   # x/z footprint (blender x/y)
TARGET_H = float(os.environ.get('TARGET_H', '0.9'))   # height (blender z)
PREVIEW_ONLY = os.environ.get('PREVIEW_ONLY', '') == '1'  # skip glb export, just re-render
STATS_ONLY = os.environ.get('STATS_ONLY', '') == '1'      # export + print stats, skip renders (fast tri-budget tuning)

os.makedirs(OUT, exist_ok=True)
random.seed(SEED)

bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, base_rgb, rough=0.85, emit_rgb=(0, 0, 0), emit_str=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*base_rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Emission Color'].default_value = (*emit_rgb, 1)
    b.inputs['Emission Strength'].default_value = emit_str
    return m


leaf_mat = mat('LeafMat', LEAF_RGB, rough=0.92)
# Sunfruit "glows faintly" per canon (cuisine.md) — a touch of emission sells that in the
# preview render; the exported material is still a flat placeholder the game will replace.
fruit_mat = mat('FruitMat', FRUIT_RGB, rough=0.3, emit_rgb=FRUIT_RGB, emit_str=0.25)

# ---------------------------------------------------------------------------
# LEAVES: 8 overlapping icosphere lumps in three tiers (base ring / mid ring / crown),
# jittered per-seed, then fused (voxel remesh), decimated to a faceted low-poly blob,
# and finally normalized to the exact target footprint/height.
# ---------------------------------------------------------------------------
# Tiers: (count, ring_radius, z, lump_radius). Heavy overlap (ring_radius << lump_radius)
# is deliberate -- it's what keeps this reading as ONE lumpy leafy mass instead of a
# "ball of balls" of clearly-separate spheres glued together (the first code stand-in's
# failure). Direct join, no remesh/boolean/decimate -- same technique as tree.py's canopy,
# scaled up to more lumps for a rounder, fuller bush silhouette.
tiers = [
    (3, 0.15, 0.22, 0.37),
    (3, 0.11, 0.40, 0.30),
    (2, 0.07, 0.52, 0.26),
    (1, 0.0, 0.60, 0.22),
]

lump_objs = []
crown_candidates = []  # raw (pre-normalize) (center, radius) of tiers 1+ -- fruit placement
for tier_idx, (count, ring_r, z, r) in enumerate(tiers):
    for i in range(count):
        ang = (i / max(count, 1)) * 2 * math.pi + random.uniform(-0.4, 0.4)
        jr = ring_r + random.uniform(-0.025, 0.025)
        x = math.cos(ang) * jr
        y = math.sin(ang) * jr
        zz = z + random.uniform(-0.035, 0.035)
        rr = r + random.uniform(-0.04, 0.05)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=rr, location=(x, y, zz))
        o = bpy.context.object
        o.name = f'lump_{len(lump_objs)}'
        o.scale = (
            1.0 + random.uniform(-0.1, 0.18),
            1.0 + random.uniform(-0.1, 0.18),
            0.8 + random.uniform(-0.08, 0.14),
        )
        bpy.ops.object.transform_apply(scale=True)
        # per-vertex jitter so lumps aren't clean spheres
        bm = bmesh.new()
        bm.from_mesh(o.data)
        for v in bm.verts:
            v.co += Vector((
                (hash((SEED, o.name, v.index, 'x')) % 100 - 50) / 900.0,
                (hash((SEED, o.name, v.index, 'y')) % 100 - 50) / 900.0,
                (hash((SEED, o.name, v.index, 'z')) % 100 - 50) / 900.0,
            ))
        bm.to_mesh(o.data)
        bm.free()
        lump_objs.append(o)
        if tier_idx >= 1:
            crown_candidates.append((x, y, zz, rr))

bpy.ops.object.select_all(action='DESELECT')
for o in lump_objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = lump_objs[0]
bpy.ops.object.join()
leaves = bpy.context.object
leaves.name = 'Leaves'

# merge coincident verts left by the join (there shouldn't be many -- lumps only share
# exact coordinates by chance) and make sure everything is triangulated.
bm = bmesh.new()
bm.from_mesh(leaves.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0003)
bmesh.ops.triangulate(bm, faces=bm.faces)
bm.to_mesh(leaves.data)
bm.free()
leaves.data.update()
tri_pre = len(leaves.data.polygons)

bpy.ops.object.shade_flat()

# --- normalize to exact target footprint/height, base sitting at z=0 ---
bpy.context.view_layer.update()
coords = [leaves.matrix_world @ v.co for v in leaves.data.vertices]
xs = [c.x for c in coords]; ys = [c.y for c in coords]; zs = [c.z for c in coords]
w = max(max(xs) - min(xs), max(ys) - min(ys))
h = max(zs) - min(zs)
sx = TARGET_W / w
sz = TARGET_H / h
cx = (max(xs) + min(xs)) / 2.0
cy = (max(ys) + min(ys)) / 2.0
minz = min(zs)

bm = bmesh.new()
bm.from_mesh(leaves.data)
for v in bm.verts:
    v.co.x = (v.co.x - cx) * sx
    v.co.y = (v.co.y - cy) * sx
    v.co.z = (v.co.z - minz) * sz
bm.to_mesh(leaves.data)
bm.free()
leaves.data.update()

leaves.data.materials.append(leaf_mat)

# transform the crown-lump centers/radii through the same normalization, for fruit placement
crown_lumps = [
    (Vector(((x - cx) * sx, (y - cy) * sx, (z - minz) * sz)), r * sx)
    for (x, y, z, r) in crown_candidates
]

tri_final = len(leaves.data.polygons)
print(f'LEAVES tris: pre-decimate={tri_pre} final={tri_final}')

# UV: cube-project so a 32px leaf tile repeats ~2x around the bush (footprint ~1.0 -> cube_size 0.5)
bpy.context.view_layer.objects.active = leaves
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.cube_project(cube_size=0.5)
bpy.ops.object.mode_set(mode='OBJECT')

# ---------------------------------------------------------------------------
# FRUIT: small gold balls resting on the leaf surface near the crown. Round-robin across
# the upper-tier lumps (not one shared ray origin) so fruit scatters across the several
# crown bumps instead of clumping onto whichever single bump the rays happen to favor.
# For each pick: walk from just OUTSIDE that lump's own surface back toward its center,
# so the first BVH hit is that lump's own outer skin, not a neighbour's.
# ---------------------------------------------------------------------------
bpy.context.view_layer.update()
bvh = BVHTree.FromObject(leaves, bpy.context.evaluated_depsgraph_get())

order = list(range(len(crown_lumps)))
random.shuffle(order)

fruit_objs = []
fruit_positions = []
tries = 0
li = 0
while len(fruit_objs) < N_FRUIT and tries < N_FRUIT * 80:
    tries += 1
    center, rad = crown_lumps[order[li % len(order)]]
    li += 1
    # outward-and-up direction from this lump's own center, with jitter
    outward = center.normalized() if center.length > 1e-4 else Vector((0, 0, 1))
    d = outward * 0.7 + Vector((0, 0, 1)) * 0.35
    d += Vector((random.uniform(-0.65, 0.65), random.uniform(-0.65, 0.65), random.uniform(-0.3, 0.45)))
    d.normalize()
    outside_pt = center + d * (rad * 2.2)
    inward = (center - outside_pt).normalized()
    loc, normal, idx, dist = bvh.ray_cast(outside_pt, inward)
    if loc is None:
        continue
    # reject spots too close to fruit already placed, so they don't stack on one bump
    if any((loc - p).length < (FRUIT_R_MAX * 1.15) for p in fruit_positions):
        continue
    fr = random.uniform(FRUIT_R_MIN, FRUIT_R_MAX)
    pos = loc + normal.normalized() * (fr * 0.55)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=fr, location=pos)
    fo = bpy.context.object
    fo.name = f'fruit_{len(fruit_objs)}'
    fruit_objs.append(fo)
    fruit_positions.append(loc.copy())

bpy.ops.object.select_all(action='DESELECT')
for o in fruit_objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = fruit_objs[0]
bpy.ops.object.join()
fruit = bpy.context.object
fruit.name = 'Fruit'
bpy.ops.object.shade_flat()
fruit.data.materials.append(fruit_mat)

print(f'FRUIT count placed: {len(fruit_objs)} (requested {N_FRUIT})')

bpy.context.view_layer.update()
lc = [leaves.matrix_world @ v.co for v in leaves.data.vertices]
fc = [fruit.matrix_world @ v.co for v in fruit.data.vertices]
print('LEAVES bounds min/max:', tuple(min(c[i] for c in lc) for i in range(3)),
      tuple(max(c[i] for c in lc) for i in range(3)))
print('FRUIT  bounds min/max:', tuple(min(c[i] for c in fc) for i in range(3)),
      tuple(max(c[i] for c in fc) for i in range(3)))
print('LEAVES tri count:', len(leaves.data.polygons), ' FRUIT tri count:', len(fruit.data.polygons))

# ---------------------------------------------------------------------------
# EXPORT
# ---------------------------------------------------------------------------
if not PREVIEW_ONLY:
    glb = os.path.join(OUT, 'sunfruit-bush.glb')
    bpy.ops.object.select_all(action='DESELECT')
    leaves.select_set(True)
    fruit.select_set(True)
    bpy.ops.export_scene.gltf(filepath=glb, use_selection=True, export_apply=True,
                               export_yup=True, export_format='GLB')
    print('WROTE', glb, os.path.getsize(glb), 'bytes')

if STATS_ONLY:
    import sys
    sys.exit(0)

# ---------------------------------------------------------------------------
# PREVIEW RENDERS
# ---------------------------------------------------------------------------
scn = bpy.context.scene
scn.render.engine = 'CYCLES'
scn.cycles.samples = 48
scn.cycles.device = 'CPU'
scn.render.resolution_x = RES
scn.render.resolution_y = RES
scn.render.film_transparent = False
scn.world = bpy.data.worlds.new('W')
scn.world.use_nodes = True
scn.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.09, 0.10, 0.13, 1)

bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
gp = bpy.context.object
gp.data.materials.append(mat('Ground', (0.14, 0.15, 0.13), rough=1.0))

target = bpy.data.objects.new('Target', None)
bpy.context.collection.objects.link(target)
target.location = (0, 0, 0.42)


def add_cam(name, loc):
    bpy.ops.object.camera_add(location=loc)
    cam = bpy.context.object
    cam.name = name
    c = cam.constraints.new('TRACK_TO')
    c.target = target
    c.track_axis = 'TRACK_NEGATIVE_Z'
    c.up_axis = 'UP_Y'
    return cam


bpy.ops.object.light_add(type='SUN', location=(3, -2, 6))
bpy.context.object.data.energy = 3.2
bpy.ops.object.light_add(type='AREA', location=(-3, -1, 3))
bpy.context.object.data.energy = 180

# 3/4 view from standing height
cam1 = add_cam('CamQuarter', (2.4, -3.0, 1.6))
scn.camera = cam1
scn.render.filepath = os.path.join(OUT, 'sunfruit-bush_preview.png')
bpy.ops.render.render(write_still=True)
print('WROTE preview (3/4)')

# straight side view at ground level
cam2 = add_cam('CamSide', (0.02, -1.7, 0.22))
scn.camera = cam2
scn.render.filepath = os.path.join(OUT, 'sunfruit-bush_preview_side.png')
bpy.ops.render.render(write_still=True)
print('WROTE preview (side)')
