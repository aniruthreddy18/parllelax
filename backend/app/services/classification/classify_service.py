"""
Orchestrates a classification request: make sure the surroundings are cached,
measure them, then apply the rules.

The cascade is what makes this work anywhere on Earth without an API key:
cached areas answer in milliseconds, and anything else is fetched from Overpass
on demand and written back so the covered area grows with use.
"""
from __future__ import annotations

import logging
import math
from typing import Tuple

from app.services.classification.rule_engine import Classification, classify
from app.services.osm.feature_cache import CELL_SIZE_DEG, cache, cells_for_bbox
from app.services.osm.overpass_client import OverpassError, fetch_bbox
from app.services.spatial.proximity_service import DEFAULT_RADIUS_M, proximity

logger = logging.getLogger(__name__)


def _cell_bbox(cell_y: int, cell_x: int) -> Tuple[float, float, float, float]:
    """Geographic bounds of a coverage cell."""
    south = cell_y * CELL_SIZE_DEG
    west = cell_x * CELL_SIZE_DEG
    return (south, west, south + CELL_SIZE_DEG, west + CELL_SIZE_DEG)


def ensure_cached(lat: float, lng: float, radius_m: int) -> bool:
    """Fetch any uncovered cells the search radius touches.

    Returns True when everything was already cached (no network needed).
    Fetches are cell-aligned so they compose with the pre-warmed region rather
    than leaving ragged part-covered areas.
    """
    missing = cache.cells_touched(lat, lng, radius_m) - set(
        cell for cell in cache.cells_touched(lat, lng, radius_m) if cache.covers_cell(cell)
    )
    if not missing:
        return True

    logger.info("Cache miss at %.4f,%.4f — fetching %d cell(s)", lat, lng, len(missing))
    for cell_y, cell_x in sorted(missing):
        south, west, north, east = _cell_bbox(cell_y, cell_x)
        try:
            features = fetch_bbox(south, west, north, east)
            cache.add(features, [(cell_y, cell_x)])
            logger.info("Fetched cell %s: %d features", (cell_y, cell_x), len(features))
        except OverpassError as exc:
            # Leave the cell uncovered so a later attempt retries it, and let
            # the caller classify on whatever is already known.
            logger.warning("Overpass fetch failed for cell %s: %s", (cell_y, cell_x), exc)
    cache.save()
    return False


def classify_location(
    lat: float,
    lng: float,
    radius_m: int = DEFAULT_RADIUS_M,
) -> Tuple[Classification, bool]:
    """Classify a fire at these coordinates. Returns (result, was_cache_hit)."""
    if not math.isfinite(lat) or not math.isfinite(lng):
        raise ValueError("lat/lng must be finite numbers")
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        raise ValueError("lat/lng out of range")

    # Pick up anything the prewarm script has written since the server booted.
    cache.refresh_if_stale()

    cache_hit = ensure_cached(lat, lng, radius_m)
    hits = proximity.find_within(lat, lng, radius_m)
    return classify(lat, lng, hits, radius_m), cache_hit
