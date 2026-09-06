"""
Mapping from OpenStreetMap tags onto the land-cover categories the frontend
already understands (`LandCoverCategory` in `frontend/src/types/index.ts`).

Land *use* is what matters here, not land *cover*: a satellite raster can only
say "built-up", whereas OSM records whether a built-up polygon is a factory or
a housing estate. That distinction is the whole basis of the classifier.
"""
from typing import Dict, List, Tuple

# Categories mirror the frontend union type exactly — do not invent new names.
INDUSTRIAL = "Built-up Industrial"
FOREST = "Dense Forest"
CROPLAND = "Cropland"
WATER = "Water Body"
SETTLEMENT = "Scrubland"  # stand-in for built-up non-industrial

#: (osm_key, osm_value) -> category. Order matters only for documentation;
#: lookup is exact-match on the tag pair.
TAG_CATEGORY: Dict[Tuple[str, str], str] = {
    # --- Industrial / extractive -------------------------------------------
    ("landuse", "industrial"): INDUSTRIAL,
    ("landuse", "quarry"): INDUSTRIAL,
    ("landuse", "port"): INDUSTRIAL,
    ("man_made", "works"): INDUSTRIAL,
    ("man_made", "petroleum_well"): INDUSTRIAL,
    ("man_made", "wastewater_plant"): INDUSTRIAL,
    ("power", "plant"): INDUSTRIAL,

    # --- Vegetation --------------------------------------------------------
    ("natural", "wood"): FOREST,
    ("landuse", "forest"): FOREST,
    ("leisure", "nature_reserve"): FOREST,
    ("boundary", "national_park"): FOREST,
    ("boundary", "protected_area"): FOREST,

    # --- Agriculture -------------------------------------------------------
    ("landuse", "farmland"): CROPLAND,
    ("landuse", "orchard"): CROPLAND,
    ("landuse", "meadow"): CROPLAND,
    ("landuse", "vineyard"): CROPLAND,
    ("landuse", "farmyard"): CROPLAND,

    # --- Water -------------------------------------------------------------
    ("natural", "water"): WATER,
    ("landuse", "reservoir"): WATER,
    ("landuse", "basin"): WATER,

    # --- Settlement (non-industrial built-up) ------------------------------
    ("landuse", "residential"): SETTLEMENT,
    ("landuse", "commercial"): SETTLEMENT,
    ("landuse", "retail"): SETTLEMENT,
}

#: Human-readable label per category, used in reasoning output.
CATEGORY_LABEL: Dict[str, str] = {
    INDUSTRIAL: "industrial",
    FOREST: "forest / protected vegetation",
    CROPLAND: "agricultural land",
    WATER: "water body",
    SETTLEMENT: "residential / commercial",
}


def categorise(tags: Dict[str, str]) -> str | None:
    """Return the land-cover category for an OSM feature's tags, or None.

    Industrial wins when a feature carries several recognised tags (a power
    plant tagged `landuse=industrial` + `power=plant` should not fall through
    to something softer).
    """
    matches = [
        TAG_CATEGORY[(key, value)]
        for key, value in tags.items()
        if (key, value) in TAG_CATEGORY
    ]
    if not matches:
        return None
    if INDUSTRIAL in matches:
        return INDUSTRIAL
    return matches[0]


def overpass_tag_filters() -> List[Tuple[str, str]]:
    """Every (key, value) pair worth querying, for building Overpass requests."""
    return list(TAG_CATEGORY.keys())


def overpass_key_groups() -> Dict[str, List[str]]:
    """Recognised values grouped by OSM key.

    Overpass charges per statement, so collapsing 23 key/value pairs into one
    regex-alternation statement per key (6 total) is dramatically cheaper than
    emitting a statement each — the difference between a 504 and a fast reply.
    """
    grouped: Dict[str, List[str]] = {}
    for key, value in TAG_CATEGORY:
        grouped.setdefault(key, []).append(value)
    return grouped
