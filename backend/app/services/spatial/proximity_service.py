"""
"What is within N metres of this point?"

Distances must be measured in metres, not degrees: a degree of longitude is
~106km at Hyderabad but ~70km in northern Europe, so degree-space distance
would silently move the 1km boundary depending on where you are. Candidates are
therefore reprojected into the local UTM zone before measuring.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Any, Dict, List

from pyproj import Transformer
from shapely.geometry import Point, shape
from shapely.ops import nearest_points, transform
from shapely.strtree import STRtree

from app.services.osm.feature_cache import cache

logger = logging.getLogger(__name__)

DEFAULT_RADIUS_M = 1000
#: Degrees-per-metre prefilter is approximate, so pad it before the exact pass.
PREFILTER_SLACK = 1.5

_COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


@dataclass
class FeatureHit:
    osm_id: str
    category: str
    name: str
    distance_m: float
    bearing: str
    tags: Dict[str, str]
    #: True when the ignition point falls inside this polygon. Far stronger
    #: evidence than merely being nearby.
    contains: bool = False
    #: Footprint in square metres. A 2 km² refinery and a 50 m² copse are not
    #: equally meaningful, and distance alone cannot tell them apart.
    area_m2: float = 0.0

    def describe(self) -> str:
        label = self.name or "unnamed feature"
        where = "at this location" if self.contains else f"{self.distance_m:.0f}m {self.bearing}"
        return f"'{label}' (OSM {self.osm_id}) {where}"


def utm_epsg(lat: float, lng: float) -> int:
    """EPSG code for the UTM zone containing a coordinate, either hemisphere."""
    zone = int((lng + 180) / 6) + 1
    return (32600 if lat >= 0 else 32700) + zone


def _bearing(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> str:
    d_lng = math.radians(to_lng - from_lng)
    lat1, lat2 = math.radians(from_lat), math.radians(to_lat)
    y = math.sin(d_lng) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(d_lng)
    degrees = (math.degrees(math.atan2(y, x)) + 360) % 360
    return _COMPASS[int((degrees + 22.5) % 360 // 45)]


class ProximityService:
    """STRtree over the cached features, rebuilt whenever the cache changes."""

    def __init__(self) -> None:
        self._tree: STRtree | None = None
        self._geometries: List[Any] = []
        self._properties: List[Dict[str, Any]] = []
        self._indexed_version = -1

    def _ensure_index(self) -> None:
        if self._indexed_version == cache.version and self._tree is not None:
            return

        geometries: List[Any] = []
        properties: List[Dict[str, Any]] = []
        for feature in cache.features:
            try:
                geometry = shape(feature["geometry"])
            except (ValueError, AttributeError, TypeError):
                continue
            if geometry.is_empty:
                continue
            if not geometry.is_valid:
                geometry = geometry.buffer(0)  # repair self-intersecting rings
            if geometry.is_empty:
                continue
            geometries.append(geometry)
            properties.append(feature["properties"])

        self._geometries = geometries
        self._properties = properties
        self._tree = STRtree(geometries) if geometries else None
        self._indexed_version = cache.version
        logger.info("Proximity index rebuilt: %d geometries", len(geometries))

    def find_within(
        self,
        lat: float,
        lng: float,
        radius_m: int = DEFAULT_RADIUS_M,
    ) -> List[FeatureHit]:
        """Every cached feature within `radius_m`, nearest first, in true metres."""
        self._ensure_index()
        if self._tree is None:
            return []

        point = Point(lng, lat)

        # Coarse pass in degree space to shortlist candidates cheaply.
        lat_pad = (radius_m / 111_320) * PREFILTER_SLACK
        lng_pad = lat_pad / max(math.cos(math.radians(lat)), 0.01)
        candidates = self._tree.query(point.buffer(max(lat_pad, lng_pad)))

        if len(candidates) == 0:
            return []

        # Exact pass in metres.
        to_utm = Transformer.from_crs(4326, utm_epsg(lat, lng), always_xy=True).transform
        point_utm = transform(to_utm, point)

        hits: List[FeatureHit] = []
        for index in candidates:
            geometry = self._geometries[index]
            distance = transform(to_utm, geometry).distance(point_utm)
            if distance > radius_m:
                continue

            properties = self._properties[index]
            _, closest = nearest_points(point, geometry)
            projected_geometry = transform(to_utm, geometry)
            hits.append(FeatureHit(
                osm_id=properties.get("osm_id", ""),
                category=properties.get("category", ""),
                name=properties.get("name", ""),
                distance_m=distance,
                bearing=_bearing(lat, lng, closest.y, closest.x),
                tags=properties.get("tags", {}),
                contains=geometry.contains(point),
                area_m2=projected_geometry.area,
            ))

        hits.sort(key=lambda hit: hit.distance_m)
        return hits


proximity = ProximityService()
