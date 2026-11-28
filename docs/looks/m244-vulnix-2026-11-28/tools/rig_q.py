"""BETA M244 sheet 4: VULNIX's four awakened forms, rigged with the 11-28 QUALITY STANDARD (m244-quality-2026-11-28/README.md):
  (a) the locked art's palette (baked in the sculpt: sculpt_awaken.py WATER palette). None of the four arts has a blaze, so nothing is projected.
  (c) baked ear / tail spring jiggle on every clip (the quality tool's jiggle(), run from its own source). Marelle's long hanging jester
      ears are the showcase: their spring target is raised (EAR_T .16 -> .30 rad on her walk) so they swing.
Runs the LIVE rig script (m244-vulnara-2026-11-27/tools/rig_awaken.py, all four are quadrupeds) and steps in at rigcore.write.
    uv run --no-project --with numpy,scipy,trimesh,networkx,fast_simplification,pillow python rig_q.py <nitar|marelle|nisk|nixeth> <in.glb> <out-rigged.glb> <metrics.json>"""
import sys, os, runpy, json
HERE = os.path.dirname(os.path.abspath(__file__)); LIVE = os.path.join(HERE, '../../m244-vulnara-2026-11-27/tools'); QT = os.path.join(HERE, '../../m244-quality-2026-11-28/tools/rig_quality.py')
sys.path.insert(0, os.path.join(HERE, '../../rig-2026-11-24/tools')); sys.path.insert(0, LIVE); sys.dont_write_bytecode = True
import rigcore as K
FORM, IN, OUT, MET = sys.argv[1:5]
Q = {'__file__': QT, '__name__': 'rig_quality_lib'}; exec(compile(open(QT).read().split('_write = K.write')[0], QT, 'exec'), Q)
if FORM == 'marelle': Q['EAR_T'] = .30
STATS = Q['STATS']
_write = K.write
def write(path, parts, sk, clips, fps):
    Q['jiggle'](sk, clips, fps)
    print('QUALITY', STATS); return _write(path, parts, sk, clips, fps)
K.write = write
sys.argv = [os.path.join(LIVE, 'rig_awaken.py'), FORM, IN, OUT, MET]; runpy.run_path(sys.argv[0], run_name='__main__')
m = json.load(open(MET)); m['quality'] = dict(standard='m244-quality-2026-11-28 (a) palette (no blaze in the art), (c) springs', ear_target=Q['EAR_T'], spring=STATS.get('jiggle')); json.dump(m, open(MET, 'w'), indent=1)
