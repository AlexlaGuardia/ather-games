"""Town concept shots for the continent (Jin play lane, 2026-11-15). Alex JUDGES these; the pick is what the
town kit gets built to. flux-1.1-pro-ultra on Replicate (BFL: commercial use of outputs permitted).
Built against canon, never inventing a look:
  · world/athernyx.md > Architecture: ROMAN BONES, MANA-TECH VEINS. Columns, arches, marble, stone; the trim is
    mana channels and rune circuits, plain by day, and it breathes soft light at sunset. Nothing looks "techy".
  · world/rune-hold.md: stone stacked up a hillside, winding streets, lantern light, smithy steam; the 1672
    Station is a SPACEPORT (a wide field, several berths, a terminal), a station rather than a tower-forest.
  · world/gale-haven.md: NW peninsula port city on cliff tiers (Low Docks / Cargo Quay with warehouses built
    into the cliff / Sky Port with skyships at mooring towers); the Wet Market.
  · world/locations.md + veradyn-arc.md: Veradyn = NE tropical island city, living Network-grown architecture
    (fungal structures and stone merged), the Barrier Temple on the height, an organic maze down to the water.
  · world/geography.md: Citadel = southern capital, walled, a bridge entrance controls all access, Mediterranean
    coast; 619+ restored to its marble-and-gold glory. ⚠ The 1672 look is an OPEN gap (CANON_GAPS 2801620):
    this shot is a proposal for Magii to rule, not canon.
  · Ashfeld: The Fallen Cap tavern is built under a living mushroom that is still growing (Alex 11-14).
  · The sky by day is normal; no moons drawn by day.
No named characters: their looks are canon-locked elsewhere.
The style asks for what the game can BUILD: chunky stylized 3D, simple readable shapes, instanced-kit friendly.
Usage: python3 gen_towns.py <town|all> [n]   -> towns/<town>-<i>.png"""
import os, sys, urllib.request, replicate
from concurrent.futures import ThreadPoolExecutor

with open("/root/guardia-core/.env") as f:
    for line in f:
        if line.startswith("REPLICATE_API_TOKEN"):
            os.environ["REPLICATE_API_TOKEN"] = line.split("=", 1)[1].strip().strip('"')

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "towns")
MODEL = "black-forest-labs/flux-1.1-pro-ultra"

STYLE = ("Concept art for a stylized 3D open-world fantasy game: chunky simplified shapes, clean flat-shaded "
         "low-poly forms with soft painterly lighting, readable silhouettes, a believable lived-in town with streets "
         "that lead somewhere, houses facing the streets, dense at the centre and thinning toward fields at the edge. "
         "Architecture is ROMAN BONES: columns, arches, pale stone and marble, terracotta roofs, carved trim along "
         "walls and doorways. Nothing looks sci-fi or techy. No text, no logo, no close-up people; tiny distant "
         "townsfolk only.")
DUSK = (" Golden-hour dusk: the carved trim along walls and doorways glows softly with warm light, windows lit, "
        "the sky warm and clear.")
DAY = " Bright clear daytime, a normal blue sky with soft clouds."

PROMPTS = {
    "rune-hold": STYLE + DUSK + (" Wide establishing view from the road approaching a mountain town carved into a "
        "hillside: stone buildings stacked along winding streets that climb the slope, a crossroads square at the "
        "bottom, smithy chimneys venting steam, lanterns along the streets. Beside the town on flat ground, a wide "
        "open spaceport field with a long stone terminal and several berths where a few elegant sky-ships stand. "
        "Jagged mountains rise behind."),
    "gale-haven": STYLE + DAY + (" Side-on establishing view from the sea of a port city climbing a tall sheer sea "
        "cliff on a rocky peninsula, in three distinct stacked tiers. BOTTOM tier at the waterline: wooden docks, "
        "piers, merchant ships and a crowded market of coloured awnings. MIDDLE tier halfway up the cliff: a long "
        "ledge of warehouses carved INTO the rock face with big arched openings and timber cargo cranes swinging "
        "crates. TOP tier on the cliff's crown: a forest of tall slender stone mooring towers with sky-ships tethered "
        "to them. Zig-zag stairways and cable lifts climb the bare rock between the tiers. The cliff is the hero."),
    "veradyn": STYLE + DAY + (" Wide establishing view of a tropical island city of living architecture: buildings "
        "grown rather than built, giant fungal forms and roots fused with carved stone arches and columns, an organic "
        "maze of terraces tumbling down to turquoise water, a temple on the highest point, a small dormant volcano "
        "woven into the city, lush jungle, smaller islands across a strait."),
    "citadel": STYLE + DAY + (" Establishing view of a grand walled capital standing on an island of rock in a "
        "wide river mouth on a warm Mediterranean coast. A massive unbroken pale stone wall with towers rings the "
        "entire city right down to the water. ONE long arched stone bridge crosses the water to a single huge "
        "gatehouse, clearly the only way in, with a road leading onto the bridge in the foreground. Inside the wall, "
        "marble and gold buildings rise toward a domed exchange hall and colonnades. Olive groves and vineyards on "
        "the near shore."),
    "ashfeld": STYLE + DUSK + (" Establishing view at street level of a small frontier village where green "
        "farmland gives out into dry tan broken country: modest stone cottages along one dusty main street. At the "
        "street's end stands a two-storey stone tavern built underneath a living mushroom: the mushroom's thick "
        "stalk rises out of the tavern and its broad cap spreads just over the roof like an umbrella, only a little "
        "wider than the building itself, chimney smoke curling up past the sooty gills. The mushroom is big for a "
        "mushroom but small for a building, a village landmark, not a mountain."),
    "rune-hold-station": STYLE + DUSK + (" Establishing view of a mountain town of stacked stone buildings climbing "
        "a hillside, and in the foreground on wide flat ground at the foot of the town, a large SPACEPORT field: a "
        "long colonnaded stone terminal hall with lantern-lit arches, a paved landing field marked into several "
        "circular berths, and in four of the berths elegant streamlined sky-ships of carved stone, brass and sail-like "
        "fins standing ready to leave the planet, one lifting off on a column of soft light. Jagged mountains behind."),
    "village": STYLE + DAY + (" Wide establishing view of a small farming village on gentle coastal plains: a "
        "dozen stone and timber cottages along a road that widens into a little square with a well, lanes "
        "branching to farmhouses, hedges and fields, a road leading off toward distant hills."),
}

def one(town, i):
    import time
    path = os.path.join(HERE, f"{town}-{i}.png")
    if os.path.exists(path): return path + " (kept)"
    for attempt in range(8):
        try:
            out = replicate.run(MODEL, input={"prompt": PROMPTS[town], "aspect_ratio": "16:9", "output_format": "png",
                                      "safety_tolerance": 2, "raw": False})
            break
        except replicate.exceptions.ReplicateError as e:  # under $5 credit Replicate allows 6/min, burst 1
            if getattr(e, "status", None) != 429: raise
            time.sleep(12)
    url = out if isinstance(out, str) else (out.url if hasattr(out, "url") else str(out))
    urllib.request.urlretrieve(url, path)
    return path

if __name__ == "__main__":
    os.makedirs(HERE, exist_ok=True)
    towns = list(PROMPTS) if sys.argv[1] == "all" else sys.argv[1].split(",")
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    start = int(sys.argv[3]) if len(sys.argv) > 3 else 1   # rerolls keep earlier picks: start at 3
    with ThreadPoolExecutor(1) as ex:
        for p in ex.map(lambda a: one(*a), [(t, i) for t in towns for i in range(start, start + n)]):
            print(p)
