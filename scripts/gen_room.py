#!/usr/bin/env python3
"""Generate THE ROOM surface art via Replicate FLUX-schnell.

Layered hub art for /room (see ROOM_DESIGN.md MASKING PHASE). Each surface ->
public/room/<id>.webp. House style matches gen_cards.py. Floor/ceiling are FLAT
top-down (CSS rotateX supplies perspective — do NOT bake it in).

Usage: python3 scripts/gen_room.py floor    (or no arg = all)
"""
import json, os, sys, time, urllib.request

ENV = "/root/guardia-core/.env"
PUBLIC = "/root/ather-games/public"
MODEL_URL = "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions"

STYLE = ("vector neon glow line-art on a near-black background, Atari and CRT vector "
         "aesthetic, luminous cyan and warm amber light, minimal, atmospheric, "
         "centered composition, no text, no UI, no words, dark and moody")

# (subject, aspect_ratio)
ROOM = {
    "wall": (
        "head-on front elevation of a wall built entirely of dark grey dressed-stone blocks, "
        "even stone masonry texture covering the entire surface uniformly, thin seams of soft "
        "golden-yellow and faint cyan light glowing in the mortar gaps between the blocks like a "
        "quiet magical circuit, gentle moody ambient lighting, golden amber tones, deep blue-black "
        "shadows, even and uniform across the whole wall, flat straight-on architectural elevation, "
        "no columns, no pillars, no pilasters, no perspective, no floor, no ceiling, no doorway, "
        "no opening, no door, no window, no furniture, no people",
        "3:2",
    ),
    "mug-sign": (
        "a tavern hanging sign, a blank dark wooden board with a carved raised border and rounded "
        "corners, hanging from an ornate wrought-iron bracket by two short iron chains, warm amber "
        "rim light glowing along the board edges, dark and moody, straight-on front view, the board "
        "surface is completely empty blank smooth wood with no text and no letters and no symbols, "
        "centered, dark background",
        "3:2",
    ),
    "floor": (
        "top-down overhead view of a dark stone flagstone floor, large flat paving slabs of "
        "dark blue-grey dressed stone, very dark and low-contrast, thin faint golden light seams "
        "glowing in the narrow gaps between the slabs, subtle and moody, fading to near-black, "
        "seamless even masonry texture, flat overhead orthographic top-down, no perspective, "
        "no horizon, no compass, no emblem, no medallion, no center decoration",
        "1:1",
    ),
    "ceiling": (
        "overhead view looking straight up at a dark tavern ceiling, heavy dark timber beams "
        "crossing over dark stone, very dark and low-contrast, faint warm amber glow seeping "
        "between the beams, moody, fading to near-black, seamless even texture, flat orthographic "
        "straight-up view, no perspective, no hanging lights, no chandelier, no fixtures",
        "1:1",
    ),
    "mug-leaf": (
        "head-on front view of ONLY a wooden door panel, vertical medium-brown oak planks with "
        "clearly visible wood grain, warmly lit so the wood reads, two horizontal dark iron "
        "reinforcing bands, a round iron ring handle in the center, rounded arched top edge, the "
        "door panel fills the entire image edge to edge with no gap and no border, soft warm amber "
        "firelight on the wood, brown wood NOT black NOT red, straight-on flat even lighting, "
        "no wall, no stone, no frame, no archway, no surround, no background, no people",
        "2:3",
    ),
    "mug-frame": (
        "head-on front view of a thick ornate doorway archway frame carved from dark dressed stone, "
        "warm golden glowing seams running through the stone, a tall rounded arched opening in the "
        "center, heavy carved stone surround on the left right and top, symmetrical, straight-on flat "
        "architectural elevation, the center opening is solid black and empty, no door, no people, no text",
        "2:3",
    ),
    "mug-beyond": (
        "warm cozy tavern interior seen from a doorway, a glowing stone hearth fire, wooden tables "
        "and benches, hanging iron lanterns with warm flames, deep golden amber firelight filling "
        "the room, inviting and atmospheric, soft warm haze, dark corners, straight-on view into the "
        "room, gentle depth, no people, no text",
        "2:3",
    ),
    "arcade-frame": (
        "head-on front view of a grand wide ornate archway frame carved from dark dressed stone, "
        "warm golden and faint cyan glowing seams running through the stone, a tall wide rounded "
        "arched opening in the very center, heavy carved stone surround filling the left right and "
        "top edges, generous wide central opening, symmetrical, straight-on flat architectural "
        "elevation, the center opening is completely solid black and empty, no door, no gate, "
        "no cabinets, no people, no text",
        "5:4",
    ),
    "arcade-beyond": (
        "looking down a long dark hall lined with two receding rows of glowing arcade cabinets "
        "vanishing into darkness toward a distant central vanishing point, cabinet screens glowing "
        "in cyan amber violet and green vector light, dark stone floor with faint glowing reflections, "
        "strong one-point perspective receding into the dark, atmospheric depth and haze, moody, "
        "no people, no text",
        "5:4",
    ),
    # the old compass-rose floor — repurpose as a flat-on emblem later, NOT as ground
    "compass": (
        "a glowing inlaid compass rose emblem on near-black stone, concentric luminous rings, "
        "thin radial spoke lines, a small glowing emblem at the hub, faint warm amber and cool "
        "cyan light, perfectly symmetrical and centered, flat overhead orthographic, no perspective",
        "1:1",
    ),
}

def token():
    for line in open(ENV):
        if line.startswith("REPLICATE_API_TOKEN"):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("no REPLICATE_API_TOKEN in .env")

def gen(tok, sid, subject, aspect):
    prompt = f"{subject}, {STYLE}"
    body = json.dumps({"input": {
        "prompt": prompt, "aspect_ratio": aspect,
        "output_format": "webp", "output_quality": 90,
        "num_outputs": 1, "go_fast": True,
    }}).encode()
    req = urllib.request.Request(MODEL_URL, data=body, method="POST", headers={
        "Authorization": f"Bearer {tok}", "Content-Type": "application/json", "Prefer": "wait",
    })
    with urllib.request.urlopen(req, timeout=120) as r:
        pred = json.load(r)
    for _ in range(40):
        st = pred.get("status")
        if st == "succeeded":
            break
        if st in ("failed", "canceled"):
            return f"FAILED ({pred.get('error')})"
        time.sleep(2)
        g = urllib.request.Request(pred["urls"]["get"], headers={"Authorization": f"Bearer {tok}"})
        with urllib.request.urlopen(g, timeout=30) as r:
            pred = json.load(r)
    out = pred.get("output")
    url = out[0] if isinstance(out, list) else out
    if not url:
        return "NO OUTPUT"
    dest_dir = os.path.join(PUBLIC, "room")
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, f"{sid}.webp")
    urllib.request.urlretrieve(url, dest)
    return f"OK -> {dest} ({os.path.getsize(dest)} bytes)"

if __name__ == "__main__":
    tok = token()
    only = sys.argv[1:] or list(ROOM)
    for sid in only:
        if sid not in ROOM:
            print(f"{sid}: skip (no brief)"); continue
        subject, aspect = ROOM[sid]
        try:
            print(f"{sid}: {gen(tok, sid, subject, aspect)}", flush=True)
        except Exception as e:
            print(f"{sid}: ERROR {e}", flush=True)
