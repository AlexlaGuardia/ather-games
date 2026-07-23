#!/usr/bin/env python3
# ── MESHY.AI CLIENT — mesh-gen front end of the /picaso render-to-sprite pipeline ──
# Runs OUTSIDE Blender (plain python3, stdlib only). Creates a text- or image-to-3D
# task on Meshy, polls it to completion, downloads the GLB. Hand that GLB to a Blender
# render script via meshy_import.import_glb() to light + render + bake to a flat sprite.
#
# ART-MEDIUM LAW: use this for DEAD grey props / arcade code-built assets ONLY. Living
# Shimmer things (spirits) stay Alex's hand-drawn pixel art — never route them through here.
# CANON: lock the design-brief FIRST (athernyx/CANON/design-briefs/). Meshy generates
# INSIDE the brief; picaso critiques the render against it. Meshy never invents a canon look.
#
# Key: reads MESHY_API_KEY from the env, else walks up to ather-games/.env. Never printed.
#
# CLI:
#   python3 tools/render/meshy.py --balance
#   python3 tools/render/meshy.py --text "a weathered dead-grey stone lantern" --out /tmp/meshy/lantern.glb
#   python3 tools/render/meshy.py --image ref.png --out /tmp/meshy/prop.glb --polycount 20000 --topology quad
import os, sys, json, time, base64, argparse, urllib.request, urllib.error

BASE = "https://api.meshy.ai"


def _load_key():
    k = os.environ.get("MESHY_API_KEY")
    if k:
        return k.strip()
    here = os.path.dirname(os.path.abspath(__file__))
    for d in (here, os.path.dirname(here), os.path.dirname(os.path.dirname(here))):
        p = os.path.join(d, ".env")
        if os.path.exists(p):
            for line in open(p):
                line = line.strip()
                if line.startswith("MESHY_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("MESHY_API_KEY not found (set env or add it to ather-games/.env)")


class MeshyError(RuntimeError):
    pass


class MeshyClient:
    def __init__(self, key=None, timeout=30):
        self.key = key or _load_key()
        self.timeout = timeout

    def _req(self, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(
            BASE + path, data=data, method=method,
            headers={"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            # never surfaces the key; only the server's error body
            raise MeshyError(f"{method} {path} -> HTTP {e.code}: {e.read().decode(errors='replace')}") from None

    # ── balance ──
    def balance(self):
        return self._req("GET", "/openapi/v1/balance").get("balance")

    # ── text-to-3d (v2): preview builds geometry, refine adds texture ──
    def create_text_to_3d(self, prompt, mode="preview", **opts):
        return self._req("POST", "/openapi/v2/text-to-3d", {"mode": mode, "prompt": prompt[:600], **opts})["result"]

    def create_text_refine(self, preview_task_id, **opts):
        return self._req("POST", "/openapi/v2/text-to-3d", {"mode": "refine", "preview_task_id": preview_task_id, **opts})["result"]

    def get_text_to_3d(self, task_id):
        return self._req("GET", f"/openapi/v2/text-to-3d/{task_id}")

    # ── image-to-3d (v1) ──
    def create_image_to_3d(self, image_url, **opts):
        return self._req("POST", "/openapi/v1/image-to-3d", {"image_url": image_url, **opts})["result"]

    def get_image_to_3d(self, task_id):
        return self._req("GET", f"/openapi/v1/image-to-3d/{task_id}")

    # ── rigging (v1): auto-rig a TEXTURED humanoid + basic walk/run animation clips ──
    # Constraints per docs: textured bipedal humanoids with clear limbs only, front on +Z
    # (Meshy's own convention, so a Meshy-generated character is already compliant),
    # ≤300k faces via input_task_id. 5 credits; failed tasks refund.
    def create_rigging(self, input_task_id=None, model_url=None, height_meters=1.7, **opts):
        body = {"height_meters": height_meters, **opts}
        if input_task_id:
            body["input_task_id"] = input_task_id
        elif model_url:
            body["model_url"] = model_url
        else:
            raise MeshyError("rigging needs input_task_id or model_url")
        return self._req("POST", "/openapi/v1/rigging", body)["result"]

    def get_rigging(self, task_id):
        return self._req("GET", f"/openapi/v1/rigging/{task_id}")

    # ── poll a task to a terminal state ──
    def poll(self, getter, task_id, every=5, max_wait=900, log=True):
        t0 = time.time()
        while True:
            task = getter(task_id)
            st, pr = task.get("status"), task.get("progress", 0)
            if log:
                print(f"  [{int(time.time() - t0):4d}s] {st} {pr}%", flush=True)
            if st == "SUCCEEDED":
                return task
            if st in ("FAILED", "CANCELED"):
                raise MeshyError(f"task {task_id} {st}: {task.get('task_error')}")
            if time.time() - t0 > max_wait:
                raise MeshyError(f"task {task_id} timed out after {max_wait}s (last {st} {pr}%)")
            time.sleep(every)


def download(url, dest):
    os.makedirs(os.path.dirname(os.path.abspath(dest)), exist_ok=True)
    urllib.request.urlretrieve(url, dest)
    return dest


def image_to_data_uri(path):
    ext = os.path.splitext(path)[1].lower().lstrip(".")
    mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png"}.get(ext)
    if not mime:
        raise SystemExit(f"unsupported image type '{ext}' (Meshy takes jpg/jpeg/png)")
    return f"data:image/{mime};base64,{base64.b64encode(open(path, 'rb').read()).decode()}"


def generate_text(client, prompt, out, refine=False, **opts):
    # target_polycount/topology belong on the PREVIEW call — that's the stage that builds
    # geometry, so asking Meshy for a low-poly mesh gets real retopology instead of the
    # blind collapse-decimate a post-pass can do. Texture size is NOT controllable here,
    # so glb_optimize.py still runs after (downscale + Draco).
    print(f"[meshy] text-to-3d preview: {prompt!r}" + (f"  {opts}" if opts else ""))
    pid = client.create_text_to_3d(prompt, mode="preview", **opts)
    client.poll(client.get_text_to_3d, pid)
    if refine:
        print("[meshy] refine pass (texture)…")
        task = client.poll(client.get_text_to_3d, client.create_text_refine(pid))
    else:
        task = client.get_text_to_3d(pid)
    download(task["model_urls"]["glb"], out)
    print(f"[meshy] saved {out}  ·  credits left: {client.balance()}")
    return out


def generate_image(client, image, out, **opts):
    src = image if image.startswith(("http://", "https://")) else image_to_data_uri(image)
    print(f"[meshy] image-to-3d: {image}")
    task = client.poll(client.get_image_to_3d, client.create_image_to_3d(src, **opts))
    download(task["model_urls"]["glb"], out)
    print(f"[meshy] saved {out}  ·  credits left: {client.balance()}")
    return out


def rig_task(client, task_id, out_dir, height=1.7):
    """Rig a finished text/image-to-3d task; saves rigged model + every animation GLB Meshy
    returns (walking/running). Prints the full result key map — the docs undersell what
    comes back, so SEE it rather than assume."""
    print(f"[meshy] rigging task {task_id} (height {height}m)…")
    rid = client.create_rigging(input_task_id=task_id, height_meters=height)
    task = client.poll(client.get_rigging, rid, every=5)
    result = task.get("result", task)
    os.makedirs(out_dir, exist_ok=True)
    saved = []
    def grab(node, prefix=""):
        if isinstance(node, dict):
            for k, v in node.items():
                grab(v, f"{prefix}{k}.")
        elif isinstance(node, str) and node.startswith("http") and ".glb" in node.split("?")[0]:
            name = prefix.rstrip(".").replace(".", "_") + ".glb"
            dest = os.path.join(out_dir, name)
            download(node, dest)
            saved.append(dest)
            print(f"  saved {dest}")
    grab(result)
    if not saved:
        print(f"  no GLB urls found — raw result keys: {json.dumps(result)[:800]}")
    print(f"[meshy] rigging done  ·  credits left: {client.balance()}")
    return saved


def main():
    ap = argparse.ArgumentParser(description="Meshy.ai -> GLB (mesh-gen front end of the picaso render pipeline)")
    ap.add_argument("--balance", action="store_true", help="print credit balance and exit")
    ap.add_argument("--text", help="text prompt (text-to-3d)")
    ap.add_argument("--image", help="image path or URL (image-to-3d)")
    ap.add_argument("--out", default="/tmp/meshy/out.glb", help="GLB output path")
    ap.add_argument("--refine", action="store_true", help="text: run a refine (texture) pass after preview")
    ap.add_argument("--polycount", type=int, help="target polycount (100-300000) — text + image")
    ap.add_argument("--topology", choices=["quad", "triangle"], help="mesh topology — text + image")
    ap.add_argument("--no-texture", action="store_true", help="image: skip texturing (should_texture=false)")
    ap.add_argument("--rig", metavar="TASK_ID", help="rig a finished text/image-to-3d task; saves rigged + animation GLBs")
    ap.add_argument("--rig-height", type=float, default=1.7, help="character height in meters for rigging (default 1.7)")
    ap.add_argument("--out-dir", default="/tmp/meshy/rig", help="rig: output directory for rigged/animation GLBs")
    a = ap.parse_args()

    c = MeshyClient()
    if a.balance and not (a.text or a.image):
        print(f"balance: {c.balance()} credits")
        return
    opts = {}
    if a.polycount:
        opts["target_polycount"] = a.polycount
    if a.topology:
        opts["topology"] = a.topology
    if a.rig:
        rig_task(c, a.rig, a.out_dir, height=a.rig_height)
    elif a.text:
        generate_text(c, a.text, a.out, refine=a.refine, **opts)
    elif a.image:
        if a.no_texture:
            opts["should_texture"] = False
        generate_image(c, a.image, a.out, **opts)
    else:
        ap.error("give --text, --image, --rig, or --balance")


if __name__ == "__main__":
    main()
