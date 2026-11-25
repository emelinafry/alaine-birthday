"""Turn an OpenStreetMap download of central Washington, DC into the files the
3D overview loads:

  data/dc-map.json   buildings (footprint, height, domes), landmark labels
  data/dc-ground.jpg the ground seen from above: water, parks, streets

Map data (c) OpenStreetMap contributors, available under the ODbL.

Usage: python bake-dc-map.py raw.json   (needs shapely and pillow)
The raw file comes from an Overpass "out geom" query; see query.txt next to
this script.
"""
import json
import math
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw
from shapely.geometry import LineString, MultiPolygon, Polygon, box
from shapely.ops import polygonize, unary_union
from shapely.strtree import STRtree

SOUTH, WEST, NORTH, EAST = 38.8770, -77.0580, 38.9010, -77.0030
LAT0, LON0 = (SOUTH + NORTH) / 2, (WEST + EAST) / 2
MX = 111320 * math.cos(math.radians(LAT0))  # metres per degree of longitude
MZ = 110950                                # metres per degree of latitude


def xz(lon, lat):
    """Local metres: +x is east, +z is south (so north is -z, as in three.js)."""
    return (lon - LON0) * MX, -(lat - LAT0) * MZ


W2, H2 = xz(EAST, SOUTH)  # half-width, half-height of the area
BOUNDS = box(-W2, -H2, W2, H2)
OUT = Path(__file__).resolve().parent.parent / "data"

raw = json.load(open(sys.argv[1]))["elements"]


def num(v):
    if v is None:
        return None
    m = re.match(r"\s*([0-9.]+)", str(v).replace(",", "."))
    return float(m.group(1)) if m else None


def ring(geom):
    return [xz(p["lon"], p["lat"]) for p in geom if p]


def polygons(el):
    """Shapely polygon(s) for a closed way or a multipolygon relation."""
    if el["type"] == "way":
        pts = ring(el.get("geometry", []))
        if len(pts) < 4 or pts[0] != pts[-1]:
            return None
        g = Polygon(pts)
    else:
        outer = [LineString(ring(m["geometry"])) for m in el.get("members", [])
                 if m.get("geometry") and m.get("role") in ("outer", "")]
        inner = [LineString(ring(m["geometry"])) for m in el.get("members", [])
                 if m.get("geometry") and m.get("role") == "inner"]
        o = unary_union(list(polygonize(unary_union(outer)))) if outer else None
        if o is None or o.is_empty:
            return None
        if inner:
            o = o.difference(unary_union(list(polygonize(unary_union(inner)))))
        g = o
    g = g.buffer(0)
    if g.is_empty:
        return None
    g = g.intersection(BOUNDS)
    return None if g.is_empty else g


def parts(g):
    if g is None:
        return []
    if isinstance(g, Polygon):
        return [g]
    if isinstance(g, MultiPolygon):
        return list(g.geoms)
    return [p for p in getattr(g, "geoms", []) if isinstance(p, Polygon)]


# ---------------- buildings ----------------
def height_of(t, area):
    h = num(t.get("height"))
    if h is None and num(t.get("building:levels")):
        h = num(t["building:levels"]) * 3.4 + 1
    if h is None:
        h = 8 if area < 150 else 14
    return h


building_parts, outlines, obelisks = [], [], []
for el in raw:
    t = el.get("tags", {})
    if t.get("man_made") == "obelisk":
        for p in parts(polygons(el)):
            c = p.centroid
            side = math.sqrt(p.area)
            obelisks.append({"x": round(c.x, 1), "z": round(c.y, 1), "w": round(side, 1),
                             "h": num(t.get("height")) or 169})
        continue
    if "building:part" in t:
        building_parts.append((el, t))
    elif "building" in t:
        outlines.append((el, t))

# OSM maps a building either as one outline or as detailed parts inside an
# outline. Where parts exist, use them and drop the outline they sit in.
part_polys = [(p, t) for el, t in building_parts for p in parts(polygons(el))]
tree = STRtree([p for p, _ in part_polys]) if part_polys else None
obelisk_pts = [Polygon([(o["x"] - o["w"], o["z"] - o["w"]), (o["x"] + o["w"], o["z"] - o["w"]),
                        (o["x"] + o["w"], o["z"] + o["w"]), (o["x"] - o["w"], o["z"] + o["w"])])
               for o in obelisks]

shapes = []
for el, t in outlines:
    for p in parts(polygons(el)):
        if tree is not None and any(p.contains(part_polys[i][0].representative_point())
                                    for i in tree.query(p)):
            continue
        if any(p.intersects(o) for o in obelisk_pts):
            continue
        shapes.append((p, t))
shapes += part_polys


def flat(coords):
    out = []
    for x, z in list(coords)[:-1]:
        out += [round(x), round(z)]
    return out


buildings = []
for p, t in shapes:
    if p.area < 12:
        continue
    p = p.simplify(0.6, preserve_topology=True)
    if p.is_empty or not isinstance(p, Polygon):
        continue
    h = height_of(t, p.area)
    b = {"h": round(h, 1), "o": flat(p.exterior.coords)}
    mh = num(t.get("min_height"))
    if mh:
        b["m"] = round(mh, 1)
    holes = [flat(r.coords) for r in p.interiors if Polygon(r).area > 30]
    if holes:
        b["i"] = holes
    if t.get("roof:shape") == "dome":
        r = math.sqrt(p.area / math.pi)
        b["d"] = round(num(t.get("roof:height")) or r, 1)
    if t.get("building") in ("church", "cathedral", "government", "museum", "civic") or t.get("tourism") or t.get("historic"):
        b["c"] = 1  # landmark stone colour
    buildings.append(b)

# ---------------- labels ----------------
WANTED = {
    "United States Capitol": "U.S. Capitol",
    "Washington Monument": "Washington Monument",
    "Lincoln Memorial": "Lincoln Memorial",
    "White House": "White House",
    "Thomas Jefferson Memorial": "Jefferson Memorial",
    "Jefferson Memorial": "Jefferson Memorial",
    "National Air and Space Museum": "Air and Space Museum",
    "National Museum of Natural History": "Natural History Museum",
    "National Gallery of Art": "National Gallery of Art",
    "Smithsonian Institution Building": "Smithsonian Castle",
    "Lincoln Memorial Reflecting Pool": "Reflecting Pool",
    "Tidal Basin": "Tidal Basin",
}
labels = {}
for el in raw:
    name = el.get("tags", {}).get("name")
    if name in WANTED and WANTED[name] not in labels:
        g = polygons(el)
        if g is None and el["type"] == "way" and el.get("geometry"):
            g = LineString(ring(el["geometry"]))
        if g is not None and not g.is_empty:
            c = g.centroid
            labels[WANTED[name]] = [round(c.x), round(c.y)]
for o in obelisks:
    labels.setdefault("Washington Monument", [round(o["x"]), round(o["z"])])

OUT.mkdir(exist_ok=True)
json.dump({
    "attribution": "© OpenStreetMap contributors",
    "size": [round(W2 * 2), round(H2 * 2)],
    "buildings": buildings,
    "obelisks": obelisks,
    "labels": [{"name": k, "x": v[0], "z": v[1]} for k, v in labels.items()],
}, open(OUT / "dc-map.json", "w"), separators=(",", ":"))

# ---------------- ground image ----------------
PX = 4096 / (W2 * 2)       # final pixels per metre
SS = 2                     # draw at 2x, then shrink, for smooth edges
img = Image.new("RGB", (round(W2 * 2 * PX * SS), round(H2 * 2 * PX * SS)), "#e9e3d6")
d = ImageDraw.Draw(img)


def px(x, z):
    return ((x + W2) * PX * SS, (z + H2) * PX * SS)


def fill(g, colour):
    for p in parts(g):
        d.polygon([px(*c) for c in p.exterior.coords], fill=colour)
        for r in p.interiors:
            d.polygon([px(*c) for c in r.coords], fill="#e9e3d6")


GREEN = {"park": "#b9d99a", "garden": "#b0d48f", "pitch": "#a9d08a", "golf_course": "#b5d896",
         "grass": "#bcdc9e", "recreation_ground": "#b9d99a", "forest": "#8fbf74", "wood": "#8fbf74",
         "scrub": "#a6c98a", "grassland": "#bcdc9e"}
layers = {"green": [], "water": []}
for el in raw:
    t = el.get("tags", {})
    kind = t.get("leisure") or t.get("landuse") or (t.get("natural") if t.get("natural") != "water" else None)
    if kind in GREEN:
        layers["green"].append((polygons(el), GREEN[kind], 0 if kind in ("park", "golf_course") else 1))
    if t.get("natural") == "water" or t.get("waterway") == "riverbank":
        layers["water"].append(polygons(el))

for g, colour, _ in sorted(layers["green"], key=lambda x: x[2]):
    fill(g, colour)
for g in layers["water"]:
    fill(g, "#8ec5e8")

ROAD = {  # class: (width in metres, colour)
    "motorway": (16, "#ffffff"), "trunk": (15, "#ffffff"), "primary": (14, "#ffffff"),
    "secondary": (12, "#ffffff"), "tertiary": (10, "#ffffff"), "motorway_link": (8, "#ffffff"),
    "trunk_link": (8, "#ffffff"), "primary_link": (8, "#ffffff"), "secondary_link": (7, "#ffffff"),
    "residential": (8, "#fbf8f2"), "unclassified": (8, "#fbf8f2"), "living_street": (6, "#fbf8f2"),
    "service": (4.5, "#f6f2ea"), "pedestrian": (5, "#f2e8d3"), "footway": (2.5, "#efe3c8"),
    "path": (2.5, "#efe3c8"),
}
order = list(ROAD)[::-1]  # small roads first, big roads on top
for cls in order:
    w, colour = ROAD[cls]
    for el in raw:
        if el.get("tags", {}).get("highway") != cls or el["type"] != "way":
            continue
        if el["tags"].get("tunnel") in ("yes", "building_passage") or el["tags"].get("layer", "0").startswith("-"):
            continue
        pts = [px(*xz(p["lon"], p["lat"])) for p in el.get("geometry", []) if p]
        if len(pts) > 1:
            d.line(pts, fill=colour, width=max(1, round(w * PX * SS)), joint="curve")

img = img.resize((img.width // SS, img.height // SS), Image.LANCZOS)

# fade the edges into plain land so the map doesn't end in a hard line
mask = Image.new("L", img.size, 0)
md = ImageDraw.Draw(mask)
edge = round(min(img.size) * 0.12)
for i in range(edge):
    md.rectangle([i, i, img.width - 1 - i, img.height - 1 - i], outline=round(255 * (i / edge) ** 1.5))
md.rectangle([edge, edge, img.width - 1 - edge, img.height - 1 - edge], fill=255)
img = Image.composite(img, Image.new("RGB", img.size, "#e9e3d6"), mask)
img.save(OUT / "dc-ground.jpg", quality=86, optimize=True, progressive=True)
print(f"{len(buildings)} buildings, {len(obelisks)} obelisk, labels: {sorted(labels)}")
print(f"area {W2*2:.0f} x {H2*2:.0f} m, ground {img.width}x{img.height}px")
