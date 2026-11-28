"""BETA M244 sheet 3: VULNORE's four awakened forms, rigged with the 11-28 QUALITY STANDARD (m244-quality-2026-11-28/README.md):
  (a) the locked art's palette (baked in the sculpt: sculpt_awaken.py EARTH palette) + the art PROJECTED where it has a blaze:
      Orethar's chest armour (gold heart + green crystal + dark stone) from the art's torso onto her chest front (Q_PROJECT)
  (c) baked ear / tail spring jiggle on every clip (the quality tool's jiggle(), run unchanged)
Runs the LIVE rig scripts (m244-vulnara-2026-11-27/tools/rig_biped.py for oreth, rig_awaken.py for the rest) and steps in at
rigcore.write, as rig_quality.py does.
    uv run --no-project --with numpy,scipy,trimesh,networkx,fast_simplification,pillow python rig_q.py <oreth|raya|noris|norun> <in.glb> <out-rigged.glb> <metrics.json>
ART: read-only from /root/athernyx/assets/stage3/009-orethar.png (private; only sampled colours land in the glb)."""
import sys, os, runpy, json
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); LIVE = os.path.join(HERE, '../../m244-vulnara-2026-11-27/tools'); QT = os.path.join(HERE, '../../m244-quality-2026-11-28/tools/rig_quality.py')
sys.path.insert(0, os.path.join(HERE, '../../rig-2026-11-24/tools')); sys.path.insert(0, LIVE); sys.dont_write_bytecode = True
import rigcore as K
FORM, IN, OUT, MET = sys.argv[1:5]
# the quality tool's springs, its own source (everything above its write hook), not a copy
Q = {'__file__': QT, '__name__': 'rig_quality_lib'}; exec(compile(open(QT).read().split('_write = K.write')[0], QT, 'exec'), Q)
STATS = Q['STATS']
ART = dict(oreth='/root/athernyx/assets/stage3/009-orethar.png')
# Orethar's torso in the art (px x0, y0, x1, y1: collarbone -> belt) and the chest front it lands on (glb units, the rok landmarks)
BOX, ROI = (330, 330, 690, 640), dict(x=.21, y0=.60, y1=1.06)
SW = np.array([(242, 196, 64), (134, 192, 80), (94, 90, 58), (200, 110, 40)])   # gold, green crystal, dark stone, coat (= leave as is)

def project(part):
    from PIL import Image
    part = Q['densify'](part, 1)
    V = part['POSITION'].astype(float); C = part['COLOR_0'].astype(float); art = np.asarray(Image.open(ART[FORM]).convert('RGB')).astype(float)
    roi = (V[:, 2] > .04) & (np.abs(V[:, 0]) < ROI['x']) & (V[:, 1] > ROI['y0']) & (V[:, 1] < ROI['y1']) & (part['NORMAL'][:, 2] > .30)
    u = (V[roi, 0] + ROI['x']) / (2 * ROI['x']); v = (ROI['y1'] - V[roi, 1]) / (ROI['y1'] - ROI['y0'])
    px = np.clip(BOX[0] + u * (BOX[2] - BOX[0]), 0, 1023).astype(int); py = np.clip(BOX[1] + v * (BOX[3] - BOX[1]), 0, 1023).astype(int)
    s = np.zeros((roi.sum(), 3))
    for dx in (-3, 0, 3):
        for dy in (-3, 0, 3): s += art[np.clip(py + dy, 0, 1023), np.clip(px + dx, 0, 1023)]
    s /= 9; k = np.argmin(((s[:, None] - SW[None]) ** 2).sum(-1), 1); idx = np.flatnonzero(roi)
    C[idx[k == 0], :3] = SW[0]   # only the GOLD lands (the heart blaze); the armour itself is the sculpt's broad stone plates (a full colour map read as camouflage)
    STATS['project'] = dict(roi=int(roi.sum()), gold=int((k == 0).sum()), crystal=int((k == 1).sum()), stone=int((k == 2).sum()))
    part = dict(part); part['COLOR_0'] = C.astype(np.uint8); return part

_write = K.write
def write(path, parts, sk, clips, fps):
    if FORM in ART: parts = dict(parts, body=project(parts['body']))
    Q['jiggle'](sk, clips, fps)
    if FORM == 'norun':   # prod desk 11-28: her walk read -1.7 mm between keys (-1.2 at them); lift walk + run by the deficit + 0.8 mm of headroom
        V, W = parts['body']['POSITION'].astype(float), parts['body']['W']
        for c in ('walk', 'run'):
            lo = min(K.skin(V, W, sk, p)[:, 1].min() for p in clips.get(c, []))
            if lo < .0008:
                for p in clips[c]: p.T['root'] = np.asarray(p.T['root'], float) + (0, .0008 - lo, 0)
                STATS.setdefault('ground', {})[c + '_lift'] = round(float(.0008 - lo), 4)
    print('QUALITY', STATS); return _write(path, parts, sk, clips, fps)
K.write = write
if FORM == 'oreth':
    os.environ['AWAKEN'] = 'oreth'; sys.argv = [os.path.join(LIVE, 'rig_biped.py'), IN, OUT, MET]; runpy.run_path(sys.argv[0], run_name='__main__')
else:
    sys.argv = [os.path.join(LIVE, 'rig_awaken.py'), FORM, IN, OUT, MET]; runpy.run_path(sys.argv[0], run_name='__main__')
# v2 silhouette receipt: the PROP / MOTIF spec she was built with + a measured shape ratio (shoulder half-width over the eyes' half-spread,
# off the rest mesh in the file): the 'hulk vs fox' number the v2 test reads
SVm = sys.modules.get('sculpt_awaken'); Pq = K.Player(OUT); bv, ev = Pq.m['body']['POSITION'], Pq.m['eyes']['POSITION']
band = (bv[:, 1] > ev[:, 1].min() - .45) & (bv[:, 1] < ev[:, 1].min() - .05)
SIL = dict(prop=SVm.PROP.get(FORM, {}), motif=SVm.MOTIF.get(FORM, {}), shoulder_over_eyes=round(float(np.abs(bv[band, 0]).max() / np.abs(ev[:, 0]).max()), 3), top_over_eyes=round(float(bv[:, 1].max() / ev[:, 1].mean()), 3))
m = json.load(open(MET)); m['silhouette'] = SIL; m['quality'] = dict(standard='m244-quality-2026-11-28 (a) palette + projection, (c) springs', project=STATS.get('project'), spring=STATS.get('jiggle'), dense=STATS.get('dense')); json.dump(m, open(MET, 'w'), indent=1)
