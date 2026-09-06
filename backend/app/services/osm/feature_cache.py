"""
On-disk cache of OSM land-use features, plus an index of which areas have
actually been fetched.

Caching only the features would make an empty result ambiguous: is there really
nothing here, or has this area never been queried? So coverage is tracked
separately, as a grid of fetched cells.
"""
from __future__ import annotations

import json
import logging
import os
import math
import threading
from pathlib import Path
from typing import Any, Dict, Iterable, List, Set, Tuple

logger = logging.getLogger(__name__)

#: Bundled cache, committed to the repo. Always readable; read-only on
#: serverless platforms, whose filesystems are immutable apart from /tmp.
CACHE_DIR = Path(__file__).resolve().parents[2] / "data" / "osm_cache"
FEATURES_PATH = CACHE_DIR / "features.geojson"
COVERAGE_PATH = CACHE_DIR / "covered_cells.json"

#: Where newly fetched areas are written. Defaults to the bundled directory,
#: which is right for local and container deploys. On a read-only filesystem
#: point FIREWATCH_CACHE_DIR at a writable path (e.g. /tmp/osm_cache) so live
#: fetches still persist for the life of the instance.
WRITE_DIR = Path(os.environ.get("FIREWATCH_CACHE_DIR", str(CACHE_DIR)))

#: ~5.5km at the equator. Coverage is tracked per cell rather than per point.
CELL_SIZE_DEG = 0.05

CellKey = Tuple[int, int]

_lock = threading.Lock()


def cell_key(lat: float, lng: float) -> CellKey:
    return (math.floor(lat / CELL_SIZE_DEG), math.floor(lng / CELL_SIZE_DEG))


def cells_for_bbox(south: float, west: float, north: float, east: float) -> Set[CellKey]:
    """Every cell whose centre falls inside the bbox."""
    cells: Set[CellKey] = set()
    lat_start, lng_start = cell_key(south, west)
    lat_end, lng_end = cell_key(north, east)
    for y in range(lat_start, lat_end + 1):
        for x in range(lng_start, lng_end + 1):
            cells.add((y, x))
    return cells


class FeatureCache:
    """Deduplicated feature store keyed by OSM id, with a coverage index."""

    def __init__(self) -> None:
        self._features: Dict[str, Dict[str, Any]] = {}
        self._covered: Set[CellKey] = set()
        self._loaded = False
        #: Bumped on every mutation so dependent spatial indexes know to rebuild.
        self._version = 0
        #: Disk mtimes at load time, used to spot writes by other processes.
        self._signature: tuple[float, float] = (0.0, 0.0)
        self._warned_readonly = False

    # -- persistence --------------------------------------------------------

    def _disk_signature(self) -> tuple[float, float]:
        """Modification times of the cache files, for staleness detection."""
        def mtime(path: Path) -> float:
            try:
                return path.stat().st_mtime
            except OSError:
                return 0.0
        return (mtime(WRITE_DIR / "features.geojson"), mtime(WRITE_DIR / "covered_cells.json"))

    def refresh_if_stale(self) -> bool:
        """Reload when another process (e.g. the prewarm script) has written.

        The API server holds the cache in memory, so without this a region
        cached by `scripts/prewarm.py` stays invisible until a restart — and
        every point in it keeps paying for a live fetch.
        """
        if not self._loaded:
            return False
        if self._disk_signature() == self._signature:
            return False
        with _lock:
            self._loaded = False
            self._features.clear()
            self._covered.clear()
        self.load()
        return True

    def load(self) -> None:
        if self._loaded:
            return
        with _lock:
            if self._loaded:
                return

            if FEATURES_PATH.exists():
                data = json.loads(FEATURES_PATH.read_text())
                for feature in data.get("features", []):
                    osm_id = feature["properties"]["osm_id"]
                    self._features[osm_id] = feature

            if COVERAGE_PATH.exists():
                cells = json.loads(COVERAGE_PATH.read_text())
                self._covered = {(int(y), int(x)) for y, x in cells}

            # Merge anything written to a separate writable location.
            if WRITE_DIR.resolve() != CACHE_DIR.resolve():
                overlay_features = WRITE_DIR / "features.geojson"
                overlay_cells = WRITE_DIR / "covered_cells.json"
                if overlay_features.exists():
                    for feature in json.loads(overlay_features.read_text()).get("features", []):
                        self._features[feature["properties"]["osm_id"]] = feature
                if overlay_cells.exists():
                    self._covered.update(
                        (int(y), int(x)) for y, x in json.loads(overlay_cells.read_text())
                    )

            self._loaded = True
            self._signature = self._disk_signature()
            self._version += 1
            logger.info(
                "OSM cache loaded: %d features, %d covered cells",
                len(self._features), len(self._covered),
            )

    def save(self) -> None:
        """Persist the cache, tolerating a read-only filesystem.

        Serverless deployments cannot write into the bundle. Failing to persist
        only costs a re-fetch later, so it must never take down a request that
        has already produced a correct answer.
        """
        try:
            WRITE_DIR.mkdir(parents=True, exist_ok=True)
            (WRITE_DIR / "features.geojson").write_text(json.dumps({
                "type": "FeatureCollection",
                "features": list(self._features.values()),
            }))
            (WRITE_DIR / "covered_cells.json").write_text(json.dumps(sorted(self._covered)))
            self._signature = self._disk_signature()
        except OSError as exc:
            if not self._warned_readonly:
                logger.warning(
                    "Cache is not writable (%s) — classification still works, but "
                    "newly fetched areas will not persist. Set FIREWATCH_CACHE_DIR "
                    "to a writable path to keep them.", exc,
                )
                self._warned_readonly = True

    # -- reads --------------------------------------------------------------

    @property
    def version(self) -> int:
        self.load()
        return self._version

    @property
    def features(self) -> List[Dict[str, Any]]:
        self.load()
        return list(self._features.values())

    def cells_touched(self, lat: float, lng: float, radius_m: int) -> Set[CellKey]:
        """Cells the search circle actually overlaps.

        Usually one, but up to four when the point sits near a cell corner. This
        is what must be fetched — requiring a fixed 3x3 block would demand far
        more area than a 1km search reads, and no live fetch could satisfy it.
        """
        lat_pad = radius_m / 111_320
        lng_pad = lat_pad / max(math.cos(math.radians(lat)), 0.01)
        return cells_for_bbox(lat - lat_pad, lng - lng_pad, lat + lat_pad, lng + lng_pad)

    @property
    def covered_cells(self) -> Set[CellKey]:
        self.load()
        return set(self._covered)

    def covers_cell(self, cell: CellKey) -> bool:
        self.load()
        return cell in self._covered

    def covers(self, lat: float, lng: float, radius_m: int = 1000) -> bool:
        """True when every cell the search circle touches has been fetched."""
        self.load()
        return self.cells_touched(lat, lng, radius_m) <= self._covered

    def stats(self) -> Dict[str, Any]:
        self.load()
        by_category: Dict[str, int] = {}
        for feature in self._features.values():
            category = feature["properties"]["category"]
            by_category[category] = by_category.get(category, 0) + 1
        return {
            "total_features": len(self._features),
            "covered_cells": len(self._covered),
            "by_category": by_category,
        }

    # -- writes -------------------------------------------------------------

    def add(self, features: Iterable[Dict[str, Any]], covered: Iterable[CellKey]) -> int:
        """Merge features (deduplicated by OSM id) and mark cells as fetched."""
        self.load()
        added = 0
        with _lock:
            for feature in features:
                osm_id = feature["properties"]["osm_id"]
                if osm_id not in self._features:
                    added += 1
                self._features[osm_id] = feature
            self._covered.update(covered)
            self._version += 1
        return added


#: Process-wide singleton — the cache is read on every classify call.
cache = FeatureCache()
