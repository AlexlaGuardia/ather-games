# The BOX-FRAME props — bench, sawmill, stonecutter, oven, hearth, kiln, lantern — as made things
# rather than stacked cubes.
#
# Sibling of `vessel.py`, and deliberately NOT an entry in it: a vessel is a solid of revolution and
# its whole recipe is one profile, while these are FRAMES — slabs, posts, rails, tiers. One script
# per idiom, the way `sunfruit-bush.py` is one script for the bushes.
#
# ── ★ THE PRIMITIVE IS A STICK, AND ITS SPEC IS THE TS BOX, UNCHANGED ─────────────────────────
# A stick is authored as `box=[w, h, d, cx, cy, cz]` — the exact tuple `station-models.ts` › `Box`
# already uses, same cell (x,z ∈ [-0.5,0.5], y ∈ [0,1], +y up), same centre-not-corner convention.
# That is on purpose and it is the review path: a frame's recipe here can be diffed line-for-line
# against the box model it replaces, so "is this the same bench, better made" is a question the eye
# can answer. What a stick adds over `BoxGeometry` is the four things a box cannot say:
#   chamfer — the upright corners cut back, so an edge catches light instead of reading as a seam
#   taper   — a shaved leg, thinner at the foot.  ⚠ IT IS A PLAN SCALE OVER THE STICK'S HEIGHT,
#             so on a FLAT part it is not a shave, it is a bevel all the way round: the chisel's
#             first cut asked for `taper=0.55` over a 0.022-tall blade and got walls rising 2.2 in
#             plan per unit of height, 16 facets past the cone. `vessel.py`'s "dz is in CELL units"
#             warning is the same arithmetic seen from the other side. The cone guard caught it on
#             the first bake, which is the one thing here that has now paid for itself.
#   roll    — the top edge rolled over at 45 degrees (a worn slab, not a cut one)   ⚠ see the cone
#   yaw     — a few thousandths of a radian off square, per stick, so two benches are siblings
#
# ── ★★ THE 30-DEGREE WALL, TRANSPOSED — AND IT SPLITS THE CHAMFERS IN TWO ─────────────────────
# `piece-mesh.ts` picks a facet's tile with a hard branch, `an.y > 0.5 ? TOP : SIDE`, which is a
# 60-degree CONE about vertical. `vessel.py` spends its header on what that does to a lathe. On a
# frame it lands differently, and the difference is the whole reason this script can chamfer freely:
#   · A VERTICAL-edge chamfer (the upright corners of a post) has a HORIZONTAL normal — `an.y` = 0.
#     It cannot flip. Chamfer every upright corner you like; it is free.
#   · A HORIZONTAL-edge chamfer — `roll`, the top edge turning over — is a ~45-degree facet, so
#     `an.y` ~ 0.707 and it wears the TOP tile AND a plan projection. That is not a bug to avoid,
#     it is a choice to declare: on the bench's slab the top tile IS the worked plank surface, so a
#     rolled edge reads as the top rolling over. On a part whose top tile is a dark disc or a mouth
#     it would read as a hole. `roll` therefore costs a FLIPS budget, stated per frame below.
# `FLIPS` counts the facets that flip and are not axis-aligned caps — i.e. exactly the ones a
# chamfer, a roll or a tilt created — and the build asserts against the frame's declared budget.
# A budget that has to move should move WITH A REASON WRITTEN NEXT TO IT, the way `mortar`'s
# `max_rise` 0.80 does in `vessel.py`. Silently raising it is how a guard goes blind.
#
# ── ★ THE TILE'S BANDS DRAW THE FRAME, AND ON THE BENCH THEY WERE OFF BY 0.08 ─────────────────
# A side face samples tile u from LOCAL position and local = cell + 0.5 (`station-mesh.ts` shifts
# the geometry so the cell's min corner is local 0). So a tile's vertical stripe at u < 1/8 lands
# at cell x < -0.375, and nowhere else. `paintCraftTable`'s SIDE tile is: a rail band across the
# top quarter, CORNER LEGS at the outer eighth (`x < b || x >= size - b`, b = size/8), a recessed
# panel between them. The shipped box bench stands on legs at cx ±0.30, spanning cell 0.25..0.35 —
# local 0.75..0.85, which is PANEL. Its legs have been wearing the recessed-panel shading, and the
# dark leg stripes the tile paints have been landing on the slab and the apron instead. Legs here
# sit at ±0.4325 so a leg wears the leg. Same family as the cauldron's hearth course: the picture
# was already right and the geometry was not standing in it.
#
# ── ★ REPRODUCIBLE, AND THAT IS NOT FREE ──────────────────────────────────────────────────────
# Python's `hash()` is randomised per PROCESS for anything holding a string, so a script that
# jitters by it makes a different mesh every run and the object a human approved cannot be
# regenerated. `shash()` is crc32. NEVER use `hash()` here. (jin/hub, 2026-09-22.)
#
# ── ★ WHERE THE OUTPUT GOES ───────────────────────────────────────────────────────────────────
# `OUT` defaults to SCRATCH and `public/` is opt-in, from `bake-props.sh`. A bake writes a glb every
# run and an untracked file under `public/` fails `coord build` FOR EVERY LANE on this shared tree.
#
#   env: NAME (bench) · SEED · WOBBLE · YAW · OUT · PREVIEW_OUT
#        PREVIEW_ONLY=1 skips the glb · STATS_ONLY=1 stops before the renders
import bpy, math, os, zlib

NAME = os.environ.get('NAME', 'bench')
RES  = int(os.environ.get('RES', '560'))
OUT         = os.environ.get('OUT', 'scripts/.scratch/props')
PREVIEW_OUT = os.environ.get('PREVIEW_OUT', 'scripts/.scratch/props')
PREVIEW_ONLY = os.environ.get('PREVIEW_ONLY') == '1'
STATS_ONLY   = os.environ.get('STATS_ONLY') == '1'

os.makedirs(OUT, exist_ok=True)
os.makedirs(PREVIEW_OUT, exist_ok=True)


def shash(*parts):
    """crc32 over a joined string: stable across processes, machines and Python versions."""
    return zlib.crc32('|'.join(str(p) for p in parts).encode())


# ── THE FAMILY ────────────────────────────────────────────────────────────────────────────────
# `sticks`: one dict per part, `box` in the TS convention. `node` is the glb mesh node it merges
# into, and a node is the unit `station-models.ts` › `SculptPart` assigns tiles to — so two parts
# that need DIFFERENT tiles must be different nodes, and parts that share tiles should share one.
FRAMES = {
    # ── THE BENCH (MAT.CRAFT_TABLE) — a thick-topped workbench, pegged, with the tools left on it.
    # Heights are the shipped box model's, unchanged and on purpose: this is the same bench, made
    # rather than stacked. What moved is the LEGS (out to the tile's leg stripe, see the header),
    # and what is new is the chamfer on every upright, the shaved legs, the rolled slab edge, the
    # through-tenons, and the yaw that stops the four legs being one leg drawn four times.
    'bench': dict(
        seed=23, wobble=0.005, yaw=0.016,
        # ★ 16 FLIPS, AND THEY ARE ALL ONE THING: the slab's rolled top edge, an octagon's eight
        # edges at two triangles each. Those facets wear the bench's own TOP tile — the worked
        # plank surface with the etched square — so a rolled edge there reads as the top turning
        # over, which is what a used bench top does. Nothing else in this frame may flip. If this
        # number has to move, the reason goes on the line beneath it or the guard is blind.
        flips=16,
        sticks=[
            # The top slab. Its side spans cell y 0.80..0.94 -> tile v 0.06..0.20, inside
            # `paintCraftTable`'s rail band (v < 0.25), so the slab wears the rail. Roll the top.
            dict(node='Top',   box=[0.86, 0.14, 0.86, 0, 0.87, 0], chamfer=0.022, roll=0.030),
            # ⚠⚠ THE APRON IS 0.80 AND NOT THE SHIPPED 0.70, AND A RENDER IS THE ONLY THING THAT
            # SAID SO. Moving the legs out to the tile's stripe (below) put them at cell 0.385..0.48
            # while a 0.70 apron stops at 0.35 — so the first cut was four posts standing NEAR a
            # table, touching nothing, with daylight between every leg and the frame it was meant
            # to carry. Every guard was green: each stick was inside the cell, nothing flipped, the
            # tri count was fine. A model is not checked for being CONNECTED, because nothing in
            # the cell knows the parts are one object. At 0.80 the apron reaches 0.40 and overlaps
            # the legs, and the legs run to 0.80 so they carry the slab directly.
            # local 0.10..0.90 — still the recessed panel for all but its last fortieth.
            dict(node='Frame', box=[0.80, 0.10, 0.80, 0, 0.75, 0], chamfer=0.016),
            # ★ FOUR CORNER LEGS AT ±0.4325, NOT ±0.30. A 0.095 leg there spans cell 0.385..0.480 ->
            # local 0.885..0.980, inside the tile's leg stripe (u > 7/8). At ±0.30 it sat in the
            # panel, which is the misalignment this frame exists to fix. Shaved to 0.82 at the foot;
            # a leg that reads as turned stock, not as a post. They run the full 0.80 to the slab's
            # underside — a leg that stops at the apron is carrying the apron, not the bench.
            dict(node='Frame', box=[0.095, 0.80, 0.095, -0.4325, 0.40, -0.4325], chamfer=0.014, taper=0.82),
            dict(node='Frame', box=[0.095, 0.80, 0.095,  0.4325, 0.40, -0.4325], chamfer=0.014, taper=0.82),
            dict(node='Frame', box=[0.095, 0.80, 0.095, -0.4325, 0.40,  0.4325], chamfer=0.014, taper=0.82),
            dict(node='Frame', box=[0.095, 0.80, 0.095,  0.4325, 0.40,  0.4325], chamfer=0.014, taper=0.82),
            # Two stretchers between the legs, low down where a bench is braced. Canon is pegged and
            # lashed (`world/ather.md`), so these are the joinery the eye is allowed to see.
            dict(node='Frame', box=[0.80, 0.055, 0.045, 0, 0.145, -0.4325], chamfer=0.010),
            dict(node='Frame', box=[0.80, 0.055, 0.045, 0, 0.145,  0.4325], chamfer=0.010),
            # The tools, left where they were put down. The mallet is a head on a handle rather than
            # the single block the box model could afford; the chisel is a tapered blade in a grip.
            # ⚠⚠ THE HEADROOM IS 0.06 AND THAT IS THE WHOLE TOOL BUDGET. The slab's top is 0.94 and
            # the cell ends at 1.0, so anything standing ON the bench is at most 0.06 tall — every
            # `cy` here is 0.94 + h/2, not a free number. The first cut gave the mallet a 0.075
            # head at cy 0.985 and it left the cell at 1.023; the containment assert caught it,
            # twice, which is the assert's whole job. The shipped box model's tools were flat for
            # exactly this reason and it is not a compromise to fix by growing them — it is what a
            # full-height bench in a one-metre cell leaves. Lower the slab or keep the tools flat.
            # ⚠ NO `roll` AND NO `taper` ON ANYTHING UP HERE, AND THE CONE GUARD IS WHY. Both cost
            # flips, and a flipped facet on a 0.15-wide mallet head buys a bevel nobody can see at
            # the price of making the budget cover two things instead of one. The chamfer still
            # softens the uprights, for free.
            dict(node='Tools', box=[0.150, 0.055, 0.105, 0.185, 0.9675, -0.150], chamfer=0.014, yaw_mul=3.5),
            dict(node='Tools', box=[0.048, 0.030, 0.230, 0.185, 0.9550,  0.015], chamfer=0.009, yaw_mul=3.5),
            dict(node='Tools', box=[0.215, 0.022, 0.040, -0.175, 0.9510,  0.185], chamfer=0.007, yaw_mul=4.0),
            dict(node='Tools', box=[0.090, 0.032, 0.052, -0.020, 0.9560,  0.185], chamfer=0.011, yaw_mul=4.0),
        ]),
}

F = FRAMES[NAME]
SEED   = int(os.environ.get('SEED', str(F['seed'])))
WOBBLE = float(os.environ.get('WOBBLE', str(F['wobble'])))
YAW    = float(os.environ.get('YAW', str(F['yaw'])))
FLIPS  = int(os.environ.get('FLIPS', str(F['flips'])))


def unit(*parts):
    """A stable -1..1 from the seed and a label."""
    return (shash(SEED, *parts) % 2000 - 1000) / 1000.0


# ── THE STICK ─────────────────────────────────────────────────────────────────────────────────
# Built in blender space: x = cell x, y = cell z, z = cell y (UP). `vessel.py` uses the same
# convention and `export_yup=True` converts on the way out.
def xsec(hx, hz, c):
    """Plan cross-section, counter-clockwise seen from above (which is what makes the extruded
    walls face OUTWARD with no per-face special case) — a rectangle, or an octagon when chamfered.
    ⚠ c=0 must not fall through to the octagon: it would emit four zero-length corner edges and
    the degenerate faces that come with them."""
    if c <= 1e-6:
        return [(+hx, +hz), (-hx, +hz), (-hx, -hz), (+hx, -hz)]
    c = min(c, hx * 0.98, hz * 0.98)
    return [(+hx - c, +hz), (-hx + c, +hz), (-hx, +hz - c), (-hx, -hz + c),
            (-hx + c, -hz), (+hx - c, -hz), (+hx, -hz + c), (+hx, +hz - c)]


def stick(spec, k):
    """One made part: a chamfered, optionally tapered and rolled box, set a hair off square."""
    w, h, d, cx, cu, cz = spec['box']            # cu is the UP coordinate (TS `cy`)
    ch   = spec.get('chamfer', 0.0)
    tap  = spec.get('taper', 1.0)
    roll = spec.get('roll', 0.0)
    ymul = spec.get('yaw_mul', 1.0)

    # Hand-made, not manufactured: a few thousandths of plan offset and a fraction of a degree of
    # yaw, per stick. ⚠ Kept LOW on purpose — a workbench that visibly leans reads BROKEN, not
    # hand-cut, and the wobble that makes a thrown pot look thrown makes a frame look damaged.
    ox = WOBBLE * unit('ox', k)
    oz = WOBBLE * unit('oz', k)
    ang = YAW * ymul * unit('yaw', k)
    ca, sa = math.cos(ang), math.sin(ang)

    u0, u1 = cu - h / 2.0, cu + h / 2.0
    roll = min(roll, h * 0.45)
    # (up, plan scale, extra inset) bottom to top. The roll row is inset by `roll` while rising by
    # `roll`, which is what makes that facet 45 degrees.
    rows = [(u0, 1.0, 0.0)]
    if roll > 1e-6:
        rows.append((u1 - roll, None, 0.0))
        rows.append((u1, None, roll))
    else:
        rows.append((u1, None, 0.0))

    verts, faces = [], []
    n = len(xsec(w / 2.0, d / 2.0, ch))
    for (up, _s, inset) in rows:
        f = (up - u0) / h if h > 1e-9 else 0.0
        s = 1.0 + (tap - 1.0) * f
        hx = max(1e-4, w / 2.0 * s - inset)
        hz = max(1e-4, d / 2.0 * s - inset)
        # The chamfer scales with the stick so a tapered leg's cut corner stays proportional.
        for (px, pz) in xsec(hx, hz, ch * s):
            verts.append((cx + ox + px * ca - pz * sa, cz + oz + px * sa + pz * ca, up))
    for i in range(len(rows) - 1):
        a, b = i * n, (i + 1) * n
        for j in range(n):
            j2 = (j + 1) % n
            faces.append((a + j, a + j2, b + j2))
            faces.append((a + j, b + j2, b + j))
    top = (len(rows) - 1) * n
    for j in range(1, n - 1):
        faces.append((top, top + j, top + j + 1))      # top cap, facing up
        faces.append((0, j + 1, j))                    # bottom cap, facing down
    return verts, faces


def mesh_object(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate(); me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    for p in me.polygons: p.use_smooth = False       # the world shades these flat; so does the icon
    return ob


def merge(*pieces):
    verts, faces = [], []
    for (v, f) in pieces:
        base = len(verts)
        verts.extend(v)
        faces.extend([tuple(i + base for i in tri) for tri in f])
    return verts, faces


# ── BUILD ──────────────────────────────────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)

by_node = {}
order = []
for k, spec in enumerate(F['sticks']):
    node = spec['node']
    if node not in by_node:
        by_node[node] = []
        order.append(node)
    by_node[node].append(stick(spec, k))

objs = [mesh_object(node, *merge(*by_node[node])) for node in order]

# ── THE CONTRACT, CHECKED HERE SO A BAD EDIT CANNOT SHIP ───────────────────────────────────────
for ob in objs:
    xs = [v.co[0] for v in ob.data.vertices]
    ys = [v.co[1] for v in ob.data.vertices]
    zs = [v.co[2] for v in ob.data.vertices]
    assert max(map(abs, xs)) <= 0.5 and max(map(abs, ys)) <= 0.5, \
        '%s leaves the cell in plan: x %.3f y %.3f' % (ob.name, max(map(abs, xs)), max(map(abs, ys)))
    assert min(zs) >= -1e-6 and max(zs) <= 1.0 + 1e-6, \
        '%s leaves the cell in height: %.3f..%.3f' % (ob.name, min(zs), max(zs))
    print('%-6s bounds  x %+.3f..%+.3f  y %+.3f..%+.3f  z %+.3f..%+.3f  tris %d'
          % (ob.name, min(xs), max(xs), min(ys), max(ys), min(zs), max(zs), len(ob.data.polygons)))

# ── THE CONE GUARD ────────────────────────────────────────────────────────────────────────────
# Count the facets that wear the TOP tile and are not an axis-aligned cap — i.e. the ones a
# chamfer, a roll or a yaw created. A vertical chamfer contributes NONE (its normal is horizontal),
# which is the claim the header makes and this is what checks it.
flipped, worst = 0, (0.0, None)
for ob in objs:
    for p in ob.data.polygons:
        nz = abs(p.normal[2])
        if nz > 0.5:
            if nz < 0.999:
                flipped += 1
                if nz > worst[0]:
                    worst = (nz, ob.name)
print('cone: %d facet(s) flip to the TOP tile off-axis (budget %d)%s'
      % (flipped, FLIPS, '' if worst[1] is None else '  worst |n.up| %.3f on %s' % worst))
assert flipped <= FLIPS, \
    ('%d facets flip to the TOP tile, budget %d — a roll or a tilt went past the 60-degree cone. '
     'Raise the budget only with a reason written beside it: these facets wear the TOP tile and a '
     'plan projection, so they are right only where that tile is right.' % (flipped, FLIPS))

print('TRIS ' + '  '.join('%s %d' % (o.name, len(o.data.polygons)) for o in objs)
      + '  total %d' % sum(len(o.data.polygons) for o in objs))

# ── EXPORT ─────────────────────────────────────────────────────────────────────────────────────
if not PREVIEW_ONLY:
    glb = os.path.join(OUT, NAME + '.glb')
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=glb, use_selection=True, export_apply=True,
                              export_yup=True, export_format='GLB')
    print('WROTE', glb, os.path.getsize(glb), 'bytes')

if STATS_ONLY:
    import sys
    sys.exit(0)

# ── PREVIEW RENDERS ────────────────────────────────────────────────────────────────────────────
# ⚠ A render answers "is this a BENCH" and cannot answer "does it READ" — the tile's rail band,
# leg stripes and etched work-square are most of what makes this object a bench, and none of them
# are here. Shape in Blender, look call in the game.
def mat(name, rgb, rough=0.85):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    return m


TINT = {'Top': (0.60, 0.44, 0.27), 'Frame': (0.47, 0.34, 0.21), 'Tools': (0.40, 0.36, 0.33)}
for o in objs:
    o.data.materials.append(mat(o.name, TINT.get(o.name, (0.55, 0.40, 0.25))))

scn = bpy.context.scene
scn.render.engine = 'CYCLES'
scn.cycles.samples = 48
scn.cycles.device = 'CPU'
scn.render.resolution_x = RES
scn.render.resolution_y = RES
scn.world = bpy.data.worlds.new('W')
scn.world.use_nodes = True
scn.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.09, 0.10, 0.13, 1)

bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
bpy.context.object.data.materials.append(mat('Ground', (0.14, 0.15, 0.13), rough=1.0))

target = bpy.data.objects.new('Target', None)
bpy.context.collection.objects.link(target)
target.location = (0, 0, 0.55)


def add_cam(name, loc):
    bpy.ops.object.camera_add(location=loc)
    cam = bpy.context.object
    cam.name = name
    c = cam.constraints.new('TRACK_TO')
    c.target = target; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    return cam


bpy.ops.object.light_add(type='SUN', location=(3, -2, 6))
bpy.context.object.data.energy = 3.2
bpy.ops.object.light_add(type='AREA', location=(-3, -1, 3))
bpy.context.object.data.energy = 180

scn.camera = add_cam('CamQuarter', (1.35, -1.7, 1.45))
scn.render.filepath = os.path.join(PREVIEW_OUT, NAME + '_preview.png')
bpy.ops.render.render(write_still=True)
print('WROTE preview (3/4)')

scn.camera = add_cam('CamSide', (0.02, -1.9, 0.62))
scn.render.filepath = os.path.join(PREVIEW_OUT, NAME + '_preview_side.png')
bpy.ops.render.render(write_still=True)
print('WROTE preview (side)')
