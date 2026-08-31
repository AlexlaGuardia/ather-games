#!/usr/bin/env python3
"""
THE MOUTH SET, BY EDITING ONE MOUTH — the only technique that keeps the shapes REGISTERED.

★★★ WHY EDITING AND NOT GENERATION. A rig needs one mouth in five positions, not five mouths.
Independent text-to-image generations do not register: measured 2026-08-31 with flux-schnell,
the five came back at different sizes, positions and proportions, in a warmer palette, and one
of them invented a pair of eyes. Swapping between those would jitter. Editing a single base
keeps position, scale and style by construction, so registration is free.

★★★ AND WHY A MOUTH SET AT ALL. `serberus`'s grin is one solid slab of teeth — luma down its
middle runs 230-240 unbroken from y=907 to y=991, no upper/lower separation anywhere. A closed
grin contains no interior, no lower lip, no throat, so NO rig can reveal one; splitting and
translating it punches a rectangular hole in a bar. Alex called it "a puppet" from the feel
before any of this was measured. Distinct SHAPES are the fix.

⚠ THE BASE IS ALEX'S OWN GRIN (`serberus-mouth-base.png`), cropped from the source art. Editing
from it means the set matches the character that already exists rather than inventing a new one.

⚠ LICENCE IS PART OF THE MODEL CHOICE. flux-dev does image-to-image and is NON-COMMERCIAL, so it
is deliberately not an option here — this may end up on a monetised stream. Gemini and OpenAI
outputs are usable commercially.

Run: python3 scripts/avatar-visemes.py <outdir> [--backend gemini|openai] [--base <img>]
     python3 scripts/avatar-visemes.py --check          # backend preflight only
     backends: replicate (nano-banana, default) | kontext | qwen | gemini | openai
"""
import sys, base64, json, pathlib, urllib.request, urllib.error

ENV = pathlib.Path("/root/guardia-core/.env")
GEMINI_MODEL = "gemini-3-pro-image"

SHAPES = {
    "closed": "exactly as it is now, a closed grin with the teeth together",
    "ajar":   "the same grin but slightly parted, with a thin dark gap opening between the upper and lower teeth",
    "mid":    "the same mouth opened moderately, upper and lower teeth apart with a dark interior between them",
    "wide":   "the same mouth opened wide, upper and lower teeth far apart with a large dark interior between them",
    "round":  "the same mouth pursed into a narrow rounded O shape, much narrower than the grin, with a small dark opening",
}

EDIT_PROMPT = (
    "Edit the supplied image of a glowing mouth. Change ONLY the shape of the mouth to: {shape}. "
    "Keep everything else pixel-for-pixel identical - the exact same position on the canvas, the "
    "same overall width and centre, the same glowing white colour, the same soft light bloom, the "
    "same drawing style, and the same pure dark background. Do not move the mouth. Do not resize "
    "it. Do not add a face, eyes, lips, skin or any background detail."
)


def env(name: str) -> str:
    for line in ENV.read_text().splitlines():
        if line.startswith(name):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"no {name} in {ENV}")


def _post(url: str, body: bytes, headers: dict) -> tuple[int, dict]:
    req = urllib.request.Request(url, data=body, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}


def gemini_edit(base: pathlib.Path, shape: str, out: pathlib.Path) -> str | None:
    body = json.dumps({"contents": [{"parts": [
        {"inline_data": {"mime_type": "image/png",
                         "data": base64.b64encode(base.read_bytes()).decode()}},
        {"text": EDIT_PROMPT.format(shape=shape)},
    ]}]}).encode()
    code, d = _post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={env('GEMINI_API_KEY')}",
        body, {"Content-Type": "application/json"})
    if code != 200:
        return f"HTTP {code}: {d.get('error', {}).get('message', '')[:160]}"
    for p in (d.get("candidates") or [{}])[0].get("content", {}).get("parts", []):
        blob = p.get("inline_data") or p.get("inlineData")
        if blob:
            out.write_bytes(base64.b64decode(blob["data"]))
            return None
    return "model returned text, not an image (refusal or safety block)"


def openai_edit(base: pathlib.Path, shape: str, out: pathlib.Path) -> str | None:
    # multipart, because /images/edits takes a file rather than JSON
    boundary = "----avatarviseme"
    parts: list[bytes] = []
    def field(n, v):
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{n}\"\r\n\r\n{v}\r\n".encode())
    field("model", "gpt-image-1")
    field("prompt", EDIT_PROMPT.format(shape=shape))
    field("size", "1024x1024")
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"base.png\"\r\n"
        f"Content-Type: image/png\r\n\r\n".encode() + base.read_bytes() + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    code, d = _post("https://api.openai.com/v1/images/edits", b"".join(parts), {
        "Authorization": f"Bearer {env('OPENAI_API_KEY')}",
        "Content-Type": f"multipart/form-data; boundary={boundary}"})
    if code != 200:
        return f"HTTP {code}: {str(d.get('error', {}).get('message', ''))[:160]}"
    b64 = (d.get("data") or [{}])[0].get("b64_json")
    if not b64:
        return "no image in reply"
    out.write_bytes(base64.b64decode(b64))
    return None


# ── REPLICATE-HOSTED EDITORS ──────────────────────────────────────────────────────────────────
# ★★ THE UNBLOCK (Alex, 2026-08-31): the editing model was never the problem, the WALLET was.
# Replicate hosts the same class of editor and bills the account that has credit. `nano-banana`
# IS Gemini 2.5 Flash Image — the model whose direct API is quota-exhausted on our Google key.
#
# ⚠ LICENCE IS PART OF THE MODEL LIST, NOT AN AFTERTHOUGHT. Commercial-safe and therefore
# allowed: nano-banana (Google, outputs usable commercially, SynthID-watermarked),
# flux-kontext-pro (BFL's COMMERCIAL API tier, distinct from the non-commercial FLUX.1-dev
# weights), qwen-image-edit (Apache-2.0). ⛔ `flux-fill-dev` is deliberately absent: it does
# exactly this job and carries the FLUX.1-dev NON-COMMERCIAL licence, which is wrong for a
# stream that may be monetised. Adding it here is how that gets forgotten.
REPLICATE_EDITORS = {
    "nano-banana":  ("google/nano-banana", "image_input", True),
    "kontext":      ("black-forest-labs/flux-kontext-pro", "input_image", False),
    "qwen":         ("qwen/qwen-image-edit", "image", False),
}


def replicate_edit(base: pathlib.Path, shape: str, out: pathlib.Path, which="nano-banana") -> str | None:
    import time
    model, field, is_list = REPLICATE_EDITORS[which]
    uri = "data:image/png;base64," + base64.b64encode(base.read_bytes()).decode()
    body = json.dumps({"input": {
        "prompt": EDIT_PROMPT.format(shape=shape),
        field: [uri] if is_list else uri,
        "output_format": "png",
    }}).encode()
    tok = env("REPLICATE_API_TOKEN")
    hdr = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    code, d = _post(f"https://api.replicate.com/v1/models/{model}/predictions", body, hdr)
    if code >= 400:
        return f"HTTP {code}: {str(d.get('detail') or d)[:160]}"
    pid = d.get("id")
    for _ in range(90):
        if d.get("status") in ("succeeded", "failed", "canceled"):
            break
        time.sleep(2)
        req = urllib.request.Request(
            f"https://api.replicate.com/v1/predictions/{pid}", headers=hdr)
        with urllib.request.urlopen(req, timeout=120) as r:
            d = json.load(r)
    if d.get("status") != "succeeded":
        return f"{d.get('status')}: {str(d.get('error'))[:160]}"
    o = d.get("output")
    url = o[0] if isinstance(o, list) else o
    if not url:
        return "succeeded but returned no image"
    urllib.request.urlretrieve(url, out)
    return None


BACKENDS = {
    "gemini": gemini_edit,
    "openai": openai_edit,
    "replicate": lambda b, s, o: replicate_edit(b, s, o, "nano-banana"),
    "kontext": lambda b, s, o: replicate_edit(b, s, o, "kontext"),
    "qwen": lambda b, s, o: replicate_edit(b, s, o, "qwen"),
}


def check() -> None:
    """⚠ PREFLIGHT LOUDLY. A backend that is out of credit fails per-image, and five failures in
    a row read as a broken script rather than an empty wallet. Ask first, say which."""
    tiny = pathlib.Path("/tmp/_viseme_probe.png")
    from PIL import Image
    Image.new("RGB", (64, 64), (0, 0, 0)).save(tiny)
    for name, fn in BACKENDS.items():
        err = fn(tiny, "unchanged", pathlib.Path("/tmp/_viseme_probe_out.png"))
        print(f"  {name:8s} {'READY' if err is None else 'unavailable — ' + err}")


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--check" in args:
        print("backend preflight:")
        check()
        raise SystemExit
    if not args:
        sys.exit(__doc__)
    out = pathlib.Path(args[0]); out.mkdir(parents=True, exist_ok=True)
    def flag(n, d): return args[args.index(n) + 1] if n in args else d
    backend = flag("--backend", "replicate")
    base = pathlib.Path(flag("--base", "public/vtuber/serberus-mouth-base.png"))
    if backend not in BACKENDS: sys.exit(f"unknown backend {backend}")
    if not base.exists(): sys.exit(f"no base image at {base}")
    fn = BACKENDS[backend]
    print(f"editing {base.name} into {len(SHAPES)} shapes via {backend}")
    failed = 0
    for name, shape in SHAPES.items():
        err = fn(base, shape, out / f"viseme-{name}.png")
        print(f"  {'✅' if err is None else '✗ '} {name:7s} {err or ''}")
        failed += err is not None
    if failed:
        sys.exit(f"\n{failed}/{len(SHAPES)} failed — if this is quota, top up and re-run. "
                 f"Nothing partial was wired in.")
    print("done — next: python3 scripts/vtuber-layers.py to cut and register them")
