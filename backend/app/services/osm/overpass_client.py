"""
Client for the public Overpass API.

Overpass needs no API key and no registration; the published fair-use budget is
roughly 10k requests and 1 GB per day, with HTTP 429 for rate limiting and 504
when a query exceeds its resource allowance. Everything fetched here is written
to the on-disk cache so a given area is only ever pulled once.
"""
from __future__ import annotations

import logging
import time
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from typing import Any, Dict, List

import httpx
import osm2geojson

from app.services.osm.taxonomy import categorise, overpass_key_groups

logger = logging.getLogger(__name__)

#: Tried in order, rotating on failure. Individual mirrors go down or block a
#: busy IP fairly often, so more than one is not optional — losing every mirror
#: means losing the ability to classify anywhere outside the cache.
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.osm.jp/api/interpreter",
]

QUERY_TIMEOUT_S = 180
HTTP_TIMEOUT_S = 200.0
#: How long to give a mirror before also asking the next one.
HEDGE_DELAY_S = 4.0


class OverpassError(RuntimeError):
    """Overpass could not be reached or refused the query."""


def _build_query(spatial_filter: str) -> str:
    """Wrap every recognised tag pair in one Overpass query.

    `spatial_filter` is an Overpass filter fragment such as
    `(around:1000,17.53,78.26)` or `(17.1,78.1,17.7,78.9)`.
    """
    statements: List[str] = []
    for key, values in overpass_key_groups().items():
        alternation = "|".join(sorted(values))
        # `nwr` covers node/way/relation in one statement; non-polygon results
        # are discarded downstream anyway.
        statements.append(f'nwr{spatial_filter}["{key}"~"^({alternation})$"];')

    body = "\n  ".join(statements)
    return f"[out:json][timeout:{QUERY_TIMEOUT_S}];\n(\n  {body}\n);\nout geom;"


def _request_once(endpoint: str, query: str) -> Dict[str, Any] | None:
    """One attempt against one mirror. None means "this mirror declined"."""
    response = httpx.post(
        endpoint,
        data={"data": query},
        timeout=HTTP_TIMEOUT_S,
        headers={"User-Agent": "industrial-firewatch-prototype/0.1"},
    )
    if response.status_code in (429, 504):
        # Rate limited or over the resource budget on this mirror.
        raise OverpassError(f"{endpoint} returned {response.status_code}")
    response.raise_for_status()
    return response.json()


def _execute(query: str) -> Dict[str, Any]:
    """Query Overpass, hedging across mirrors, and return the first success.

    Mirrors vary wildly in load: the same query can take 3s on one and 60s on
    another. Trying them strictly in sequence means a single slow mirror costs
    a minute before the next is even attempted.

    So requests are *hedged*: start with one mirror, and only if it has not
    answered within HEDGE_DELAY_S bring in the next. A fast reply therefore
    costs exactly one request, and only slow ones fan out — which keeps the
    load on free public infrastructure proportionate.
    """
    errors: List[Exception] = []
    pool = ThreadPoolExecutor(max_workers=len(OVERPASS_ENDPOINTS))
    pending: Dict[Future, str] = {}
    deadline = time.monotonic() + HTTP_TIMEOUT_S

    def harvest(timeout: float) -> Dict[str, Any] | None:
        """Collect any finished request; return a payload if one succeeded."""
        if not pending:
            return None
        done, _ = wait(list(pending), timeout=timeout, return_when=FIRST_COMPLETED)
        for future in done:
            endpoint = pending.pop(future, "?")
            try:
                payload = future.result()
                if payload is not None:
                    return payload
            except Exception as exc:  # noqa: BLE001 - recorded and reported below
                logger.warning("Overpass %s failed: %s", endpoint, exc)
                errors.append(exc)
        return None

    try:
        for endpoint in OVERPASS_ENDPOINTS:
            pending[pool.submit(_request_once, endpoint, query)] = endpoint

            hedge_at = time.monotonic() + HEDGE_DELAY_S
            while time.monotonic() < hedge_at:
                payload = harvest(timeout=0.25)
                if payload is not None:
                    return payload
                if not pending:
                    break  # every request so far failed; bring in the next mirror

        # Every mirror is in flight — wait for whichever answers first.
        while pending and time.monotonic() < deadline:
            payload = harvest(timeout=1.0)
            if payload is not None:
                return payload
    finally:
        # Do not block on stragglers; abandoned threads finish on their own.
        pool.shutdown(wait=False, cancel_futures=True)

    raise OverpassError(
        f"All {len(OVERPASS_ENDPOINTS)} Overpass mirrors failed or timed out: "
        f"{errors[-1] if errors else 'no response'}"
    )


def _to_features(overpass_json: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Convert an Overpass response into categorised GeoJSON polygon features.

    osm2geojson assembles multipolygon relations properly; raw `out geom;`
    output does not close relation rings on its own.
    """
    collection = osm2geojson.json2geojson(overpass_json)
    features: List[Dict[str, Any]] = []

    for feature in collection.get("features", []):
        geometry = feature.get("geometry") or {}
        if geometry.get("type") not in ("Polygon", "MultiPolygon"):
            continue  # points and open ways carry no area to measure against

        properties = feature.get("properties") or {}
        tags = properties.get("tags") or {}
        category = categorise(tags)
        if category is None:
            continue

        osm_type = properties.get("type", "way")
        osm_id = properties.get("id")

        features.append({
            "type": "Feature",
            "geometry": geometry,
            "properties": {
                "osm_id": f"{osm_type}/{osm_id}",
                "category": category,
                "name": tags.get("name") or tags.get("operator") or "",
                "tags": {k: v for k, v in tags.items() if k in ("landuse", "natural", "man_made", "leisure", "boundary", "power")},
            },
        })

    return features


def fetch_around(lat: float, lng: float, radius_m: int) -> List[Dict[str, Any]]:
    """Every recognised land-use feature whose geometry lies within `radius_m`.

    Overpass measures `around:` from the feature's geometry, not its centroid,
    so a large factory whose boundary clips the radius is correctly returned.
    """
    query = _build_query(f"(around:{radius_m},{lat},{lng})")
    return _to_features(_execute(query))


def fetch_bbox(south: float, west: float, north: float, east: float) -> List[Dict[str, Any]]:
    """Every recognised land-use feature intersecting a bounding box."""
    query = _build_query(f"({south},{west},{north},{east})")
    return _to_features(_execute(query))
