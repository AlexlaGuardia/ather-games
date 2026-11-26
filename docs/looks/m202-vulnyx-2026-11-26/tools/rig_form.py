"""blender -b -P rig_form.py -- <in.glb> <out-rigged.glb> <metrics.json>: the live Vulnyx rig (vulnyx-2026-11-24/tools/rig_v2.py: the
M132 quadruped plan, same bones, same clips) run on a second form's glb. The body is the Vulnyx's own sculpt, so the plan fits as is."""
import os, sys
a = sys.argv[sys.argv.index('--') + 1:]; IN, OUT, MET = [os.path.abspath(x) for x in a[:3]]
src_p = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../vulnyx-2026-11-24/tools/rig_v2.py'); src = open(src_p).read()
for old, new in (("os.path.join(HERE, '../b-v2.glb')", repr(IN)), ("os.path.join(HERE, '../b-v2-rigged.glb')", repr(OUT)), ("os.path.join(HERE, '../b-v2-metrics.json')", repr(MET))):
    assert src.count(old) == 1, old; src = src.replace(old, new)
__file__ = src_p; exec(compile(src, src_p, 'exec'))
