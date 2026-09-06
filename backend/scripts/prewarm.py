"""
Fetch a region's OSM land-use features into the on-disk cache.

Cached areas classify instantly and offline. Uncached ones fall back to a live
Overpass query, whose latency is unpredictable because it depends on a free
public service — so prewarm anywhere you intend to demo.

    .venv/bin/python scripts/prewarm.py                        # Hyderabad (default)
    .venv/bin/python scripts/prewarm.py --lat 28.61 --lng 77.21 --radius 30 --name "New Delhi"
    .venv/bin/python scripts/prewarm.py --city delhi
"""
from __future__ import annotations

import argparse
import logging
import math
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.osm.feature_cache import cache, cells_for_bbox  # noqa: E402
from app.services.osm.overpass_client import OverpassError, fetch_bbox  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("prewarm")

# Hyderabad demo region (default).
CENTRE_LAT, CENTRE_LNG = 17.39, 78.49
RADIUS_KM = 50

#: Shorthands for --city.
CITIES = {
    "hyderabad": (17.39, 78.49, 50),
    "delhi": (28.6139, 77.2090, 35),
    "mumbai": (19.0760, 72.8777, 35),
    "chennai": (13.0827, 80.2707, 35),
    "bengaluru": (12.9716, 77.5946, 35),
    "kolkata": (22.5726, 88.3639, 35),
    "ahmedabad": (23.0225, 72.5714, 35),
    "visakhapatnam": (17.6868, 83.2185, 35),
}

#: Start with large tiles and subdivide only on failure. Overpass rate-limits
#: by request *count* (HTTP 429) and rejects oversized queries by *area* (504),
#: so the two failure modes pull in opposite directions: few big requests trip
#: 504, many small ones trip 429. Adaptive splitting finds the middle.
TILE_DEG = 0.25
MIN_TILE_DEG = 0.0625
PAUSE_BETWEEN_TILES_S = 3.0

#: Points the prototype is demoed against — the run fails loudly if any of
#: these end up with no features around them.
#: (label, lat, lng, expect_features) — the open-ground entry deliberately
#: expects nothing, to keep the "no features within 1km" branch covered.
FIXTURES = [
    ("Patancheru (industrial)", 17.5300, 78.2600),
    ("IDA Jeedimetla (industrial)", 17.5228, 78.4481),
    ("Katedan (industrial)", 17.3100, 78.4400),
    ("KBR National Park (forest)", 17.4200, 78.4200),
    ("Mrugavani NP (forest)", 17.3579, 78.3417),
    ("Osman Sagar (water)", 17.3700, 78.3100),
    ("Himayat Sagar (water)", 17.3300, 78.3500),
]

#: Deliberately empty: open ground with nothing mapped inside 1km.
EMPTY_FIXTURE = ("Open ground SW of Mrugavani", 17.3400, 78.3100)


def bbox_for_radius(lat: float, lng: float, radius_km: float):
    """Bounding box enclosing a radius, correcting longitude for latitude."""
    lat_delta = radius_km / 111.32
    lng_delta = radius_km / (111.32 * math.cos(math.radians(lat)))
    return (lat - lat_delta, lng - lng_delta, lat + lat_delta, lng + lng_delta)


def main() -> int:
    parser = argparse.ArgumentParser(description="Cache a region's OSM land use.")
    parser.add_argument("--city", choices=sorted(CITIES), help="shorthand for a known city")
    parser.add_argument("--lat", type=float, help="centre latitude")
    parser.add_argument("--lng", type=float, help="centre longitude")
    parser.add_argument("--radius", type=float, help="radius in km")
    parser.add_argument("--name", default="", help="label for the log output")
    args = parser.parse_args()

    if args.city:
        lat, lng, radius_km = CITIES[args.city]
        label = args.name or args.city.title()
    elif args.lat is not None and args.lng is not None:
        lat, lng, radius_km = args.lat, args.lng, args.radius or 35
        label = args.name or f"{lat:.3f},{lng:.3f}"
    else:
        lat, lng, radius_km = CENTRE_LAT, CENTRE_LNG, RADIUS_KM
        label = "Hyderabad (default)"

    logger.info("Caching %s — %.0f km radius around %.4f, %.4f", label, radius_km, lat, lng)
    south, west, north, east = bbox_for_radius(lat, lng, radius_km)
    logger.info("Region bbox: %.4f,%.4f -> %.4f,%.4f", south, west, north, east)

    # Build the work queue of tiles, largest first.
    queue = []
    lat_steps = int(math.ceil((north - south) / TILE_DEG))
    lng_steps = int(math.ceil((east - west) / TILE_DEG))
    for i in range(lat_steps):
        for j in range(lng_steps):
            t_south = south + i * TILE_DEG
            t_west = west + j * TILE_DEG
            queue.append((t_south, t_west, min(t_south + TILE_DEG, north), min(t_west + TILE_DEG, east)))

    logger.info("Fetching %d tiles of %.3f deg (subdividing on failure)", len(queue), TILE_DEG)

    done = 0
    failed = 0
    while queue:
        t_south, t_west, t_north, t_east = queue.pop(0)

        # Skip tiles already fully covered by an earlier run or a prior split.
        if cells_for_bbox(t_south, t_west, t_north, t_east) <= cache.covered_cells:
            continue

        try:
            started = time.time()
            features = fetch_bbox(t_south, t_west, t_north, t_east)
            added = cache.add(features, cells_for_bbox(t_south, t_west, t_north, t_east))
            done += 1
            logger.info(
                "[%d done, %d queued] %.3f,%.3f (%.3f deg)  %d features (%d new) in %.1fs",
                done, len(queue), t_south, t_west, t_north - t_south,
                len(features), added, time.time() - started,
            )
            cache.save()  # checkpoint, so an interrupted run is not wasted
            time.sleep(PAUSE_BETWEEN_TILES_S)

        except OverpassError as exc:
            span = t_north - t_south
            if span / 2 >= MIN_TILE_DEG:
                # Probably a 504 from too much area — split into quarters.
                mid_lat = (t_south + t_north) / 2
                mid_lng = (t_west + t_east) / 2
                queue[:0] = [
                    (t_south, t_west, mid_lat, mid_lng),
                    (t_south, mid_lng, mid_lat, t_east),
                    (mid_lat, t_west, t_north, mid_lng),
                    (mid_lat, mid_lng, t_north, t_east),
                ]
                logger.warning("Tile %.3f,%.3f failed (%.3f deg) — subdividing", t_south, t_west, span)
            else:
                failed += 1
                logger.error("Tile %.3f,%.3f failed at minimum size: %s", t_south, t_west, exc)
            time.sleep(PAUSE_BETWEEN_TILES_S * 2)

    cache.save()

    stats = cache.stats()
    print("\n" + "=" * 62)
    print("CACHE CONTENTS")
    print("=" * 62)
    print(f"  total features : {stats['total_features']}")
    print(f"  covered cells  : {stats['covered_cells']}")
    for category, count in sorted(stats["by_category"].items()):
        print(f"    {category:<24} {count}")
    if failed:
        print(f"  tiles failed   : {failed}")

    if args.city or args.lat is not None:
        # The fixture gate is specific to the Hyderabad demo region.
        print(f"\n  {label} cached. Points there now classify instantly.\n")
        return 0

    print("\n" + "=" * 62)
    print("FIXTURE COVERAGE GATE")
    print("=" * 62)
    from app.services.spatial.proximity_service import proximity  # noqa: E402

    all_ok = True
    for label, lat, lng in FIXTURES:
        covered = cache.covers(lat, lng)
        hits = proximity.find_within(lat, lng, 1000)
        ok = covered and bool(hits)
        all_ok &= ok
        nearest = f"{hits[0].category} @ {hits[0].distance_m:.0f}m" if hits else "NOTHING FOUND"
        print(f"  {'OK ' if ok else 'FAIL'} {label:<32} cached={covered}  {len(hits):>2} hits  nearest={nearest}")

    label, lat, lng = EMPTY_FIXTURE
    covered = cache.covers(lat, lng)
    hits = proximity.find_within(lat, lng, 1000)
    ok = covered and not hits  # this one is supposed to find nothing
    all_ok &= ok
    print(f"  {'OK ' if ok else 'FAIL'} {label:<32} cached={covered}  {len(hits):>2} hits  (expected 0)")

    print()
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
