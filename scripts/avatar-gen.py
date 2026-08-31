#!/usr/bin/env python3
"""
GENERATE AVATAR ART AGAINST A REFERENCE, HOLDING THE CHARACTER STILL.

★★ WHY REFERENCE-GUIDED EDITING AND NOT N SEPARATE GENERATIONS. The rig needs one head and
several MOUTHS. Generating the whole character once per mouth shape lets the head, hood and
lighting drift between images, and a head that jitters between frames is far worse than a
puppet-stiff mouth — it reads as the whole avatar flickering. So the base is generated ONCE
and every mouth is an edit of that same base, which is the one thing this model class is
actually good at.

Run: python3 scripts/avatar-gen.py base   <out.png> [--ref ref.png]
     python3 scripts/avatar-gen.py mouth  <out.png> --ref base.png --shape "<viseme>"
"""
import sys, os, base64, json, pathlib, urllib.request, urllib.error

MODEL = os.environ.get("AVATAR_GEN_MODEL", "gemini-3-pro-image")
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"


def key() -> str:
    for line in pathlib.Path("/root/guardia-core/.env").read_text().splitlines():
        if line.startswith("GEMINI_API_KEY"):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("no GEMINI_API_KEY in /root/guardia-core/.env")


def gen(prompt: str, refs: list[pathlib.Path], out: pathlib.Path) -> None:
    parts: list[dict] = []
    for r in refs:
        parts.append({"inline_data": {
            "mime_type": "image/png",
            "data": base64.b64encode(r.read_bytes()).decode(),
        }})
    parts.append({"text": prompt})
    body = json.dumps({"contents": [{"parts": parts}]}).encode()

    req = urllib.request.Request(
        f"{URL}?key={key()}", data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=240) as r:
        data = json.load(r)

    cands = data.get("candidates") or []
    if not cands:
        sys.exit(f"REFUSED: no candidates back. {json.dumps(data)[:400]}")
    for p in cands[0].get("content", {}).get("parts", []):
        blob = p.get("inline_data") or p.get("inlineData")
        if blob:
            out.write_bytes(base64.b64decode(blob["data"]))
            print(f"✅ {out}  ({out.stat().st_size/1000:.0f}KB)")
            return
    # ⚠ A text-only reply is a REFUSAL or a safety block, not a transient error. Saying so
    # beats writing a zero-byte png that the next step reads as a broken pipeline.
    txt = " ".join(p.get("text", "") for p in cands[0].get("content", {}).get("parts", []))
    sys.exit(f"REFUSED: model returned text, not an image: {txt[:300]}")


# ── OPENAI BACKEND ────────────────────────────────────────────────────────────────────────────
# ⚠ ADDED BECAUSE GEMINI'S IMAGE MODELS ARE QUOTA-EXHAUSTED ON THIS KEY (all three return
# 429 RESOURCE_EXHAUSTED, 2026-08-31). Kept as a separate backend rather than a silent
# fallback: a generator that quietly changes model changes the ART STYLE, and that is not
# something to discover later in a contact sheet.

def okey() -> str:
    for line in pathlib.Path("/root/guardia-core/.env").read_text().splitlines():
        if line.startswith("OPENAI_API_KEY"):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("no OPENAI_API_KEY")


def gen_openai(prompt: str, out: pathlib.Path, size="1024x1024", quality="medium") -> None:
    body = json.dumps({
        "model": "gpt-image-1", "prompt": prompt, "size": size,
        "quality": quality, "n": 1,
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations", data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {okey()}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            d = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"REFUSED: HTTP {e.code} {e.read().decode()[:300]}")
    b64 = d["data"][0].get("b64_json")
    if not b64:
        sys.exit(f"REFUSED: no image in reply {json.dumps(d)[:300]}")
    out.write_bytes(base64.b64decode(b64))
    print(f"✅ {out}  ({out.stat().st_size/1000:.0f}KB)")


STYLE = (
    "anime illustration, cel-shaded with soft painterly glow, deep violet and near-black "
    "palette, luminous magenta-violet rim light, dark arcane-technical background with a "
    "faint circular rune array and floating translucent UI panels, drifting light motes, "
    "high contrast, moody, centred head-and-shoulders portrait facing the viewer directly"
)

BASE_PROMPT = (
    "Using the supplied image ONLY as a style and mood reference, create an ORIGINAL character "
    "portrait in the same visual language. A hooded figure seen from the front, head and "
    "shoulders, wearing a dark hood that casts the entire face into deep shadow so no eyes, "
    "nose or skin detail are visible. The ONLY lit feature is a wide luminous grin of glowing "
    "white teeth floating in that shadow, softly blooming light onto the hood's inner edge. "
    "The mouth is CLOSED, teeth together, a calm closed grin. Symmetrical, facing straight "
    "forward, centred. " + STYLE + ". Do not copy the reference character; invent the design."
)

MOUTH_PROMPT = (
    "Edit ONLY the mouth of the supplied character portrait. Keep the hood, head, shoulders, "
    "background, lighting, palette, framing and pose EXACTLY identical, pixel for pixel, and "
    "change nothing except the shape of the glowing mouth. The new mouth shape is: {shape}. "
    "Keep the mouth in exactly the same position on the face and keep it the same glowing "
    "white with the same soft bloom. Do not move the head. Do not change the background."
)

MOUTHSET_PROMPT = (
    "A reference sheet of five separate glowing mouth shapes, arranged in one horizontal row, "
    "evenly spaced, on a pure solid black background. Each mouth is made of luminous glowing "
    "white teeth with soft light bloom around it, in a stylised anime way, the same drawing "
    "style for all five. Left to right the five shapes are: "
    "(1) a wide closed grin, teeth together in a long crescent; "
    "(2) the same grin slightly parted, a thin dark gap between an upper and a lower row of teeth; "
    "(3) the mouth open in a rounded oval shape, narrower than the grin, dark interior visible "
    "between upper and lower teeth; "
    "(4) a wide open mouth, teeth top and bottom, a large dark interior between them; "
    "(5) a small round pursed O shape, narrow, a small dark opening. "
    "Each shape clearly separated from the others with black space between. No face, no head, "
    "no hood, no background detail, no text or labels. Only the five glowing mouths on black."
)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    mode, out = sys.argv[1], pathlib.Path(sys.argv[2])
    args = sys.argv[3:]
    def flag(n, d=None):
        return args[args.index(n) + 1] if n in args else d
    refs = [pathlib.Path(flag("--ref"))] if flag("--ref") else []
    out.parent.mkdir(parents=True, exist_ok=True)
    if mode == "mouthset":
        gen_openai(MOUTHSET_PROMPT, out)
    elif mode == "base":
        gen(BASE_PROMPT, refs, out)
    elif mode == "mouth":
        shape = flag("--shape")
        if not shape or not refs:
            sys.exit("mouth needs --ref <base.png> and --shape '<description>'")
        gen(MOUTH_PROMPT.format(shape=shape), refs, out)
    else:
        sys.exit(f"unknown mode {mode}")
