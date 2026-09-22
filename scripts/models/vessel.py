# The alchemy VESSELS — cauldron, mortar, bowl, still — as thrown/turned solids of revolution.
#
# One script for the family, the way `sunfruit-bush.py` is one script for the bushes; what separates
# one vessel from another is the PROFILE below plus the env in `bake-props.sh`. Run that, never
# blender by hand: a dial left in a shell history is the only copy of what the object IS.
#
# ── ★ THE PROFILE IS NOT A FREE HAND — THE TILE'S HORIZONTAL BANDS DRAW IT ────────────────────
# `createPieceMaterial` samples a side face by LOCAL POSITION: tile row = (1 - local y) * size. So
# every one of these blocks has a picture with vertical structure, and where a vessel's foot, waist
# and lip sit decides which band each one wears. Read the painter before moving a number:
#
#   CAULDRON  `paintCauldron` — rim band top 12.5% (`size >> 3`) · clay · dark stone HEARTH course
#             bottom 25% (`size / 4`), its own comment: *"the fire bed it stands on"*.
#   GRINDER   `paintGrinder`  — bright stone rim top 12.5% · stone · dark stone bottom 12.5%.
#   MIXER     `paintMixer`    — dark "wall behind a low bowl" above `lip` (0.55) · a bright rim band
#             just under it · plain clay below. ⚠ The shipped BOX bowl is 0.30 tall and never
#             reaches its own rim band at all; this one is 0.42 so the lip lands in it.
#   STILL     `paintStill`    — clay base below `baseY` (0.62 of the tile, i.e. local y < 0.38) and
#             a pale GLASS BULB painted above it, centred local y ~0.64, radius ~0.30. The bulb has
#             to LIVE up there or it comes out clay.
#
# ── ★★ THE 30-DEGREE WALL ─────────────────────────────────────────────────────────────────────
# The piece program picks its tile with a HARD branch, not a triplanar blend:
#     an = abs(vPNorm); tileUv = an.y > 0.5 ? vPPos.xz : ...; layer = an.y > 0.5 ? TOP : SIDE
# `an.y > 0.5` is a 60-degree CONE about vertical. A facet wears the SIDE tile only while its wall
# is within ~30 degrees of plumb (|dr/dz| < 0.577 in CELL units). Past that it flips to the TOP
# tile AND a plan projection. ⚠ `dz` is in CELL units, so a SHORT vessel's walls are far steeper
# than its profile numbers look — the bowl at height 0.42 multiplies every rise by 1/0.42 = 2.4.
# `MAX_RISE` is checked per vessel against the WOBBLED rings, and a vessel that legitimately cannot
# obey it (a wide shallow dish) declares a safe clay `top` in `station-models/alchemy.ts` instead.
#
# ── ★ HAND-MADE, NOT MANUFACTURED (canon) ─────────────────────────────────────────────────────
# `design-briefs/shimmer-alchemy-vessels.md`: NO METAL — "hand-blown glass, fired clay, cork, wax,
# cord and cloth". Mortar = stone (grinds) · Still = glass bulb on a fired-clay foot · Bowl = fired
# clay, wide and shallow, cold · Cauldron = fired clay, brews. And *"slight asymmetry, an uneven
# base... two vessels of the same kind are siblings, not clones"* — that is `WOBBLE`, deliberately
# LOW-FREQUENCY (a circular blur over per-segment offsets) so the thing reads as thrown rather than
# noisy. High-frequency jitter would also fight the cone: a wobble that moves a ring faster than the
# profile does can tip a facet over it by itself, which is what failed the cauldron's first bake.
#
# ── ★ REPRODUCIBLE, AND THAT IS NOT FREE ──────────────────────────────────────────────────────
# Python's `hash()` is randomised per PROCESS for anything holding a string, so a script that
# jitters by it makes a different mesh every run and the object a human approved cannot be
# regenerated. `shash()` is crc32. NEVER use `hash()` here. (jin/hub, 2026-09-22.)
#
#   env: NAME (cauldron|mortar|bowl|still) · SEED · SEGMENTS · WOBBLE · LEAN · OUT · PREVIEW_OUT
#        PREVIEW_ONLY=1 skips the glb · STATS_ONLY=1 stops before the renders
import bpy, math, os, zlib

NAME     = os.environ.get('NAME', 'cauldron')
SEGMENTS = int(os.environ.get('SEGMENTS', '24'))
RES      = int(os.environ.get('RES', '560'))
# ⚠⚠ THE DEFAULT IS SCRATCH, AND `public/` IS OPT-IN. A bake writes a glb every run, and an
# untracked file under `public/` fails `coord build` FOR EVERY LANE on this shared tree — it blocked
# hub's deploy three times in one session before this default moved. The previews were fixed the
# same way and the glbs kept the habit, precisely because a glb is also the artifact you eventually
# WANT to keep, which makes the intermediate ones easy to leave lying in the served tree. Iterate
# here; `bake-props.sh` passes the real path on a keeper bake. (hub's suggestion, and it is right.)
OUT      = os.environ.get('OUT', 'scripts/.scratch/props')
# ⚠ PREVIEWS DO NOT GO NEXT TO THE GLB. A bake writes them every run and an untracked file under
# `public/` fails `coord build` for EVERY lane — it blocked hub's deploy the first time this ran.
PREVIEW_OUT  = os.environ.get('PREVIEW_OUT', 'scripts/.scratch/props')
PREVIEW_ONLY = os.environ.get('PREVIEW_ONLY') == '1'
STATS_ONLY   = os.environ.get('STATS_ONLY') == '1'

os.makedirs(OUT, exist_ok=True)
os.makedirs(PREVIEW_OUT, exist_ok=True)


def shash(*parts):
    """crc32 over a joined string: stable across processes, machines and Python versions."""
    return zlib.crc32('|'.join(str(p) for p in parts).encode())


# ── THE FAMILY ────────────────────────────────────────────────────────────────────────────────
# `profile`: (radius, z in VESSEL space 0..1, how much of WOBBLE this ring takes), traversed as one
# continuous outline — out along the base, up the outside, in across the rim, down the inside, in
# along the inner floor. That single traversal is what makes the winding come out right everywhere
# (outward normals outside, inward inside, up on the rim and inner floor, down on the base) with no
# per-face special case. `height` maps vessel space into the cell.
VESSELS = {
    # The pot that brews. Full cell height; foot wide because the bottom 25% of its tile is the
    # dark stone course the pot STANDS IN, not part of the pot. See the 09-22 GBOARD block.
    'cauldron': dict(
        height=1.0, seed=3, wobble=0.016, lean=0.008, max_rise=0.50, feet=0, foot_h=0.125,
        disc=('Brew', 0.275, 0.875),
        profile=[
            (0.000, 0.000, 0.00), (0.375, 0.000, 0.10), (0.392, 0.055, 0.20), (0.368, 0.150, 0.35),
            (0.352, 0.235, 0.55), (0.378, 0.330, 0.75), (0.408, 0.435, 0.92), (0.420, 0.530, 1.00),
            (0.412, 0.620, 1.00), (0.385, 0.710, 0.95), (0.350, 0.795, 0.80), (0.326, 0.868, 0.55),
            (0.330, 0.918, 0.35), (0.348, 0.968, 0.18), (0.347, 1.000, 0.15), (0.295, 1.000, 0.15),
            (0.287, 0.930, 0.20), (0.283, 0.870, 0.25), (0.285, 0.820, 0.25), (0.000, 0.805, 0.00),
        ]),
    # STONE, and it GRINDS: a deep hollow on a narrow turned foot, because the hollow is the tool.
    # `paintGrinder`'s TOP is the bowl's picture — a dusted hollow with a darker turning stone at
    # r 0.18 — so the inner floor wearing the default top tile is the point, not an accident.
    'mortar': dict(
        # ⚠ max_rise 0.80, not 0.50, and deliberately: the INNER hollow legitimately tips past the
        # cone, and that is the point of this block — `paintGrinder`'s TOP tile IS the bowl's
        # picture (a dusted hollow with a darker turning stone at r 0.18). The body names GRINDER
        # as its own `top` in alchemy.ts, so a flipped facet wears the hollow rather than a wrong
        # tile. The OUTER wall still obeys the cone; only the dish does not.
        height=0.60, seed=11, wobble=0.011, lean=0.005, max_rise=0.80, feet=0, foot_h=0.0,
        disc=None,
        profile=[
            (0.000, 0.000, 0.00), (0.165, 0.000, 0.10), (0.180, 0.075, 0.20), (0.168, 0.190, 0.30),
            (0.205, 0.330, 0.50), (0.258, 0.480, 0.72), (0.305, 0.640, 0.90), (0.338, 0.800, 1.00),
            (0.352, 0.920, 0.90), (0.354, 1.000, 0.80), (0.300, 1.000, 0.80), (0.292, 0.920, 0.70),
            (0.268, 0.780, 0.55), (0.222, 0.600, 0.35), (0.150, 0.440, 0.20), (0.000, 0.390, 0.00),
        ]),
    # Fired clay, WIDE AND SHALLOW, cold (canon). 0.42 tall rather than the box model's 0.30 so the
    # lip lands in `paintMixer`'s rim band instead of sitting entirely in the plain-clay rows.
    # ⚠ Its outer wall cannot obey the cone at this proportion and is not meant to — the body
    # declares a plain clay `top` in alchemy.ts, and the `Paste` disc carries the mixer's own.
    'bowl': dict(
        height=0.42, seed=5, wobble=0.013, lean=0.006, max_rise=0.62, feet=0, foot_h=0.0,
        disc=('Paste', 0.300, 0.255),
        profile=[
            (0.000, 0.000, 0.00), (0.300, 0.000, 0.10), (0.340, 0.220, 0.30), (0.390, 0.550, 0.60),
            (0.420, 0.820, 0.85), (0.425, 1.000, 1.00), (0.370, 1.000, 1.00), (0.356, 0.850, 0.90),
            (0.322, 0.560, 0.70), (0.258, 0.260, 0.40), (0.000, 0.150, 0.00),
        ]),
    # A hand-blown GLASS BULB on a fired-clay foot. Two nodes, because the bulb and the foot want
    # different tiles: `paintStill`'s side paints the glass ABOVE `baseY` (local y > 0.38), so the
    # bulb has to live high in the cell or it comes out clay — the same measurement the box model's
    # "y 0.55-1.0" note records, taken on the shelf.
    'still': dict(
        height=1.0, seed=17, wobble=0.010, lean=0.006, max_rise=0.50, feet=0, foot_h=0.0,
        disc=None,
        profile=[  # the Base: foot, stepped cap, neck — everything below the bulb
            (0.000, 0.000, 0.00), (0.250, 0.000, 0.10), (0.268, 0.045, 0.20), (0.235, 0.140, 0.35),
            (0.185, 0.245, 0.45), (0.135, 0.350, 0.50), (0.108, 0.430, 0.50), (0.096, 0.500, 0.45),
            (0.092, 0.560, 0.40), (0.000, 0.560, 0.00),
        ],
        bulb=dict(cz=0.715, ry=0.225, rx=0.298, rings=9)),
}

V = VESSELS[NAME]
SEED   = int(os.environ.get('SEED', str(V['seed'])))
WOBBLE = float(os.environ.get('WOBBLE', str(V['wobble'])))
LEAN   = float(os.environ.get('LEAN', str(V['lean'])))
HEIGHT = float(os.environ.get('HEIGHT', str(V['height'])))
FEET   = int(os.environ.get('FEET', str(V['feet'])))
FOOT_H = float(os.environ.get('FOOT_H', str(V['foot_h'])))
MAX_RISE = float(os.environ.get('MAX_RISE', str(V['max_rise'])))
PROFILE = V['profile']

# Vessel space (0 at the vessel's own floor, 1 at its lip) mapped into the cell. With feet the body
# starts above them and the whole profile COMPRESSES, which steepens every wall — so the cone check
# runs on the MAPPED rings, never on PROFILE's nominal numbers.
BASE_Z = FOOT_H if FEET > 0 else 0.0


def cell_z(z_v):
    return BASE_Z + z_v * (HEIGHT - BASE_Z)


def unit(*parts):
    return (shash(SEED, *parts) % 2000 - 1000) / 1000.0


def smoothed_wobble():
    """Per-segment out-of-roundness, circularly blurred so it stays low-frequency."""
    raw = [unit('wob', j) for j in range(SEGMENTS)]
    return [(raw[j - 1] + 2.0 * raw[j] + raw[(j + 1) % SEGMENTS]) / 4.0 for j in range(SEGMENTS)]


WOB = smoothed_wobble()


def ring(r, z_v, w, rx=1.0):
    out = []
    z = cell_z(z_v)
    t = z_v ** 2
    for j in range(SEGMENTS):
        th = 2.0 * math.pi * j / SEGMENTS
        rr = (r + WOBBLE * w * WOB[j]) * rx
        out.append((rr * math.cos(th) + LEAN * t, rr * math.sin(th) + LEAN * 0.6 * t, z))
    return out


def lathe(profile):
    verts, faces, rings = [], [], []
    for (r, z_v, w) in profile:
        if r <= 1e-6:
            verts.append((LEAN * (z_v ** 2), 0.0, cell_z(z_v)))
            rings.append(('pole', len(verts) - 1))
        else:
            base = len(verts)
            verts.extend(ring(r, z_v, w))
            rings.append(('ring', base))
    for i in range(len(rings) - 1):
        (ka, a), (kb, b) = rings[i], rings[i + 1]
        for j in range(SEGMENTS):
            j2 = (j + 1) % SEGMENTS
            if ka == 'pole' and kb == 'ring':
                faces.append((a, b + j2, b + j))
            elif ka == 'ring' and kb == 'pole':
                faces.append((a + j, a + j2, b))
            elif ka == 'ring' and kb == 'ring':
                faces.append((a + j, a + j2, b + j2))
                faces.append((a + j, b + j2, b + j))
    return verts, faces


def bulb_profile(cfg):
    """A closed blown bulb as its own profile — an ellipsoid walked pole to pole."""
    out = []
    n = cfg['rings']
    for k in range(n + 1):
        a = math.pi * k / n                       # 0 = bottom pole, pi = top pole
        z_v = (cfg['cz'] - cfg['ry'] * math.cos(a)) / HEIGHT
        r = cfg['rx'] * math.sin(a)
        out.append((r, z_v, 0.0 if r <= 1e-6 else 0.9))
    return out


def foot(cx, cy, k):
    verts, faces = [], []
    r_lo = 0.082 + 0.010 * unit('foot-lo', k)
    r_hi = 0.066 + 0.008 * unit('foot-hi', k)
    spin = 0.22 * unit('foot-spin', k)
    top = FOOT_H * 1.04
    for (r, z) in ((r_lo, 0.0), (r_hi, top)):
        for j in range(6):
            th = 2.0 * math.pi * j / 6 + spin
            verts.append((cx + r * math.cos(th), cy + r * math.sin(th), z))
    for j in range(6):
        j2 = (j + 1) % 6
        faces.append((j, j2, 6 + j2)); faces.append((j, 6 + j2, 6 + j))
    faces.append((0, 2, 1)); faces.append((0, 3, 2)); faces.append((0, 4, 3)); faces.append((0, 5, 4))
    return verts, faces


def pestle():
    """The mortar's pestle: a leaning shaft with a rounded striking head. Not a solid of
    revolution, so it is built and TILTED — canon's hand tool, resting against the rim."""
    verts, faces = [], []
    # ⚠ `hi` IS WHY THE FIRST CUT READ AS A POURING SPOUT. At 0.62 against a 0.60-tall mortar the
    # whole shaft sat INSIDE the hollow and only the head cleared the rim, so the render showed a
    # nub on the lip and nothing else. A pestle is read by the length standing OUT of the bowl —
    # the box model ran its head to 0.97 for the same reason. Tilt came down with it, because the
    # same lean over a taller shaft walks the head toward the cell wall.
    seg, shaft_r, head_r = 8, 0.046, 0.070
    lo, hi = 0.26, 0.955
    tilt, ax = 0.21, 0.80                              # radians off plumb, and which way it leans
    ox, oy = 0.10, 0.07                                # where its foot sits inside the hollow
    def at(z, r):
        dx = math.sin(tilt) * z * math.cos(ax)
        dy = math.sin(tilt) * z * math.sin(ax)
        return [(ox + dx + r * math.cos(2 * math.pi * j / seg),
                 oy + dy + r * math.sin(2 * math.pi * j / seg), z) for j in range(seg)]
    rows = [(lo, shaft_r * 0.85), (lo + 0.16, shaft_r), (hi - 0.13, shaft_r),
            (hi - 0.060, head_r), (hi, head_r * 0.70)]
    for (z, r) in rows: verts.extend(at(z, r))
    for i in range(len(rows) - 1):
        a, b = i * seg, (i + 1) * seg
        for j in range(seg):
            j2 = (j + 1) % seg
            faces.append((a + j, a + j2, b + j2)); faces.append((a + j, b + j2, b + j))
    top = (len(rows) - 1) * seg
    for j in range(1, seg - 1): faces.append((top, top + j, top + j + 1))
    for j in range(1, seg - 1): faces.append((0, j + 1, j))
    return verts, faces


def tube(pts, radii, seg=7):
    """A tapered tube through a list of points — the still's spout, and its catch-cup."""
    verts, faces = [], []
    for (px, py, pz), r in zip(pts, radii):
        for j in range(seg):
            th = 2.0 * math.pi * j / seg
            verts.append((px + r * math.cos(th), py + r * math.sin(th) * 0.85, pz + r * math.sin(th) * 0.55))
    for i in range(len(pts) - 1):
        a, b = i * seg, (i + 1) * seg
        for j in range(seg):
            j2 = (j + 1) % seg
            faces.append((a + j, a + j2, b + j2)); faces.append((a + j, b + j2, b + j))
    top = (len(pts) - 1) * seg
    for j in range(1, seg - 1): faces.append((top, top + j, top + j + 1))
    for j in range(1, seg - 1): faces.append((0, j + 1, j))
    return verts, faces


def upright(cx, cy, rows, seg=9):
    """An upright prism through (z, radius) rows — the still's catch-cup.
    ⚠ NOT `tube`: that helper lays its cross-section in y/z for a HORIZONTAL run, so reusing it for
    a vertical part swung the rim to z = -0.039, under the floor. The cell check caught it."""
    verts, faces = [], []
    for (z, r) in rows:
        for j in range(seg):
            th = 2.0 * math.pi * j / seg
            verts.append((cx + r * math.cos(th), cy + r * math.sin(th), z))
    for i in range(len(rows) - 1):
        a, b = i * seg, (i + 1) * seg
        for j in range(seg):
            j2 = (j + 1) % seg
            faces.append((a + j, a + j2, b + j2)); faces.append((a + j, b + j2, b + j))
    top = (len(rows) - 1) * seg
    for j in range(1, seg - 1): faces.append((top, top + j, top + j + 1))
    for j in range(1, seg - 1): faces.append((0, j + 1, j))
    return verts, faces


def disc(r, z, n):
    verts = [(0.0, 0.0, z)]
    for j in range(n):
        th = 2.0 * math.pi * j / n
        verts.append((r * math.cos(th), r * math.sin(th), z))
    return verts, [(0, 1 + j, 1 + (j + 1) % n) for j in range(n)]


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

body_name = 'Base' if NAME == 'still' else 'Body'
pieces = [lathe(PROFILE)]
pieces += [foot(0.24 * math.cos(math.pi / 4 + k * math.pi / 2),
                0.24 * math.sin(math.pi / 4 + k * math.pi / 2), k) for k in range(FEET)]
if NAME == 'mortar':
    pieces.append(pestle())
if NAME == 'still':
    # the fired-clay cup that catches the drip, stood under the spout's fall
    pieces.append(upright(0.335, 0.0, [(0.0, 0.070), (0.055, 0.079), (0.112, 0.073)]))
objs = [mesh_object(body_name, *merge(*pieces))]
if V.get('bulb'):
    # ★ THE SPOUT IS NOT DECORATION — IT IS THE WORD "STILL". Without it the silhouette is a bulb
    # on a foot, which reads as a lamp or a mushroom; the drawn-out spout falling to a catch-cup is
    # what makes it an alembic, and the box model carried both for the same reason. It rides the
    # BULB node so it wears the glass rows of `paintStill`'s side tile, as blown glass should.
    bulb_parts = [lathe(bulb_profile(V['bulb']))]
    bulb_parts.append(tube([(0.19, 0.0, 0.640), (0.27, 0.0, 0.600), (0.325, 0.0, 0.520),
                            (0.335, 0.0, 0.430)],
                           [0.052, 0.040, 0.031, 0.026]))
    objs.append(mesh_object('Bulb', *merge(*bulb_parts)))
if V.get('disc'):
    dn, dr, dz = V['disc']
    objs.append(mesh_object(dn, *disc(dr, dz, SEGMENTS)))

# ── THE CONTRACT, CHECKED HERE SO A BAD EDIT CANNOT SHIP ───────────────────────────────────────
for ob in objs:
    xs = [v.co[0] for v in ob.data.vertices]
    ys = [v.co[1] for v in ob.data.vertices]
    zs = [v.co[2] for v in ob.data.vertices]
    assert max(map(abs, xs)) <= 0.5 and max(map(abs, ys)) <= 0.5, \
        '%s leaves the cell in plan: x %.3f y %.3f' % (ob.name, max(map(abs, xs)), max(map(abs, ys)))
    assert min(zs) >= -1e-6 and max(zs) <= 1.0 + 1e-6, \
        '%s leaves the cell in height: %.3f..%.3f' % (ob.name, min(zs), max(zs))
    print('%-5s bounds  x %+.3f..%+.3f  y %+.3f..%+.3f  z %+.3f..%+.3f  tris %d'
          % (ob.name, min(xs), max(xs), min(ys), max(ys), min(zs), max(zs), len(ob.data.polygons)))

worst = (0.0, None)
for i in range(len(PROFILE) - 1):
    (r0, zv0, w0), (r1, zv1, w1) = PROFILE[i], PROFILE[i + 1]
    z0, z1 = cell_z(zv0), cell_z(zv1)
    if r0 <= 1e-6 or r1 <= 1e-6 or abs(z1 - z0) < 1e-6:
        continue                                  # a pole fan, or a face that MEANS to point up
    for j in range(SEGMENTS):
        a = r0 + WOBBLE * w0 * WOB[j]
        b = r1 + WOBBLE * w1 * WOB[j]
        rise = abs((b - a) / (z1 - z0))
        if rise > worst[0]:
            worst = (rise, 'profile %d->%d seg %d' % (i, i + 1, j))
print('worst wall rise |dr/dz| = %.3f at %s  (cliff 0.577, budget %.3f)' % (worst[0], worst[1], MAX_RISE))
assert worst[0] <= MAX_RISE, \
    'a wall rises %.3f at %s — past the budget it nears the 60-degree cone and flips to the TOP tile' % worst

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
# ⚠ A render answers "is this a POT" and cannot answer "does it READ" — the tile's bands are most
# of what makes these objects what they are, and none of them are here. Shape in Blender, look call
# in the game. (The 09-22 bush lesson, in its other form.)
def mat(name, rgb, rough=0.85):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    return m


TINT = {'cauldron': (0.54, 0.32, 0.21), 'mortar': (0.46, 0.45, 0.42),
        'bowl': (0.58, 0.40, 0.27), 'still': (0.52, 0.34, 0.24)}
for o in objs:
    o.data.materials.append(mat(o.name, (0.72, 0.84, 0.88) if o.name == 'Bulb' else TINT[NAME],
                                rough=0.25 if o.name in ('Bulb', 'Brew') else 0.85))

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
target.location = (0, 0, HEIGHT * 0.55)


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

scn.camera = add_cam('CamQuarter', (1.35, -1.7, 0.9 + HEIGHT * 0.55))
scn.render.filepath = os.path.join(PREVIEW_OUT, NAME + '_preview.png')
bpy.ops.render.render(write_still=True)
print('WROTE preview (3/4)')

scn.camera = add_cam('CamSide', (0.02, -1.9, HEIGHT * 0.52))
scn.render.filepath = os.path.join(PREVIEW_OUT, NAME + '_preview_side.png')
bpy.ops.render.render(write_still=True)
print('WROTE preview (side)')
