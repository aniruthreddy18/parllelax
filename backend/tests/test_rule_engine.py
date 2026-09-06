"""
Rule-engine tests.

Two layers: pure unit tests over synthetic hits (no I/O at all), and integration
tests that read the committed OSM cache. Neither touches the network — the
integration tests call `proximity.find_within` directly rather than
`classify_location`, so there is no fetch path to trigger.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.classification.rule_engine import (  # noqa: E402
    AGRICULTURAL_BURNING,
    FOREST_FIRE,
    INDUSTRIAL_FIRE,
    UNKNOWN,
    classify,
)
from app.services.osm.taxonomy import (  # noqa: E402
    CROPLAND,
    FOREST,
    INDUSTRIAL,
    SETTLEMENT,
    WATER,
)
from app.services.spatial.proximity_service import FeatureHit, proximity  # noqa: E402

LAT, LNG = 17.39, 78.49
RADIUS = 1000


def hit(
    category: str,
    distance_m: float,
    name: str = "test feature",
    *,
    contains: bool = False,
    area_m2: float = 50_000.0,
    osm_id: str = "way/1",
) -> FeatureHit:
    return FeatureHit(
        osm_id=osm_id, category=category, name=name,
        distance_m=distance_m, bearing="N", tags={},
        contains=contains, area_m2=area_m2,
    )


def many(category: str, distance_m: float, count: int = 5) -> list[FeatureHit]:
    """Enough hits to avoid the sparse-evidence discount."""
    return [hit(category, distance_m + i, osm_id=f"way/{i}") for i in range(count)]


# --------------------------------------------------------------------------
# Pure unit tests — the decision logic in isolation
# --------------------------------------------------------------------------

def test_industrial_within_200m_is_critical():
    result = classify(LAT, LNG, many(INDUSTRIAL, 120), RADIUS)
    assert result.classification == INDUSTRIAL_FIRE
    assert result.severity == "CRITICAL"
    assert result.confidence == 95


def test_industrial_beyond_200m_is_high_not_critical():
    result = classify(LAT, LNG, many(INDUSTRIAL, 640), RADIUS)
    assert result.classification == INDUSTRIAL_FIRE
    assert result.severity == "HIGH"
    assert result.confidence < 95


def test_sparse_evidence_lowers_confidence():
    """One lone feature is a weaker basis than several, and must say so."""
    lone = classify(LAT, LNG, [hit(INDUSTRIAL, 120)], RADIUS)
    plenty = classify(LAT, LNG, many(INDUSTRIAL, 120), RADIUS)
    assert lone.confidence < plenty.confidence


def test_containment_beats_a_closer_neighbour():
    """Standing inside a forest outranks a factory fence 40m away."""
    hits = [
        hit(INDUSTRIAL, 40, "factory"),
        hit(FOREST, 0, "reserve", contains=True, area_m2=2_000_000),
    ]
    assert classify(LAT, LNG, hits, RADIUS).classification == FOREST_FIRE


def test_large_site_outranks_a_slightly_closer_scrap():
    """A 2km2 estate at 600m beats a 500m2 patch at 450m — size is evidence."""
    hits = [
        hit(FOREST, 450, "", area_m2=500),
        hit(INDUSTRIAL, 600, "Big Estate", area_m2=2_000_000),
    ]
    assert classify(LAT, LNG, hits, RADIUS).classification == INDUSTRIAL_FIRE


def test_close_rival_is_flagged_contested_with_lower_confidence():
    hits = [
        hit(FOREST, 500, "wood", area_m2=300_000),
        hit(INDUSTRIAL, 700, "estate", area_m2=300_000),
    ]
    result = classify(LAT, LNG, hits, RADIUS)
    labels = [s["label"] for s in result.reasoning_steps]
    assert "Contested Call" in labels
    assert result.confidence < 70


def test_decisive_close_hit_is_not_contested():
    """A fire practically on a site is not made ambiguous by nearby land use."""
    hits = [
        hit(INDUSTRIAL, 13, "plant", area_m2=1_500_000),
        hit(WATER, 127, "lake", area_m2=500_000),
    ]
    result = classify(LAT, LNG, hits, RADIUS)
    assert "Contested Call" not in [s["label"] for s in result.reasoning_steps]
    assert result.classification == INDUSTRIAL_FIRE


def test_evidence_table_ranks_categories():
    hits = [hit(INDUSTRIAL, 50, "plant", area_m2=1_000_000), hit(CROPLAND, 800, "field", area_m2=1_000)]
    evidence = classify(LAT, LNG, hits, RADIUS).evidence
    assert [e["category"] for e in evidence][0] == INDUSTRIAL
    assert evidence[0]["score"] > evidence[1]["score"]


def test_forest_yields_forest_fire():
    assert classify(LAT, LNG, [hit(FOREST, 300)], RADIUS).classification == FOREST_FIRE


def test_cropland_yields_agricultural_burning():
    result = classify(LAT, LNG, [hit(CROPLAND, 300)], RADIUS)
    assert result.classification == AGRICULTURAL_BURNING
    assert result.severity == "LOW"


def test_water_is_flagged_as_false_positive():
    result = classify(LAT, LNG, [hit(WATER, 50)], RADIUS)
    assert result.classification == UNKNOWN
    assert "false positive" in result.suggested_action.lower()


def test_settlement_does_not_become_an_industrial_fire():
    """A housing estate must never be reported as an industrial fire — the
    distinction land-cover rasters cannot make, and the reason OSM is used."""
    result = classify(LAT, LNG, [hit(SETTLEMENT, 90)], RADIUS)
    assert result.classification == UNKNOWN
    assert result.classification != INDUSTRIAL_FIRE


def test_much_closer_feature_still_wins_at_equal_size():
    hits = [hit(FOREST, 150, "wood", area_m2=300_000), hit(INDUSTRIAL, 900, "estate", area_m2=300_000)]
    assert classify(LAT, LNG, hits, RADIUS).classification == FOREST_FIRE


def test_no_features_is_unknown_and_low_confidence():
    result = classify(LAT, LNG, [], RADIUS)
    assert result.classification == UNKNOWN
    assert result.confidence < 50
    assert result.feature_density == 0
    # Must not silently claim emptiness — unmapped and empty are different.
    assert "not mapped" in " ".join(s["detail"] for s in result.reasoning_steps).lower()


def test_reasoning_lists_alternatives_not_just_the_winner():
    hits = [hit(INDUSTRIAL, 100, "winner"), hit(FOREST, 400, "runner up")]
    details = " ".join(s["detail"] for s in classify(LAT, LNG, hits, RADIUS).reasoning_steps)
    assert "runner up" in details


def test_reasoning_steps_match_the_frontend_contract():
    result = classify(LAT, LNG, [hit(INDUSTRIAL, 100)], RADIUS)
    for step in result.reasoning_steps:
        assert set(step) == {"stepIndex", "label", "detail", "status"}
        assert step["status"] in {"passed", "warning", "critical", "neutral"}


# --------------------------------------------------------------------------
# Integration — real cached OSM geometry, still no network
# --------------------------------------------------------------------------

FIXTURES = [
    ("Patancheru industrial estate", 17.5300, 78.2600, INDUSTRIAL_FIRE),
    ("IDA Jeedimetla", 17.5228, 78.4481, INDUSTRIAL_FIRE),
    ("Katedan industrial estate", 17.3100, 78.4400, INDUSTRIAL_FIRE),
    ("KBR National Park", 17.4200, 78.4200, FOREST_FIRE),
    ("Mrugavani National Park", 17.3579, 78.3417, FOREST_FIRE),
    ("Osman Sagar reservoir", 17.3700, 78.3100, UNKNOWN),
]


@pytest.mark.parametrize("label,lat,lng,expected", FIXTURES)
def test_real_locations_classify_correctly(label, lat, lng, expected):
    hits = proximity.find_within(lat, lng, RADIUS)
    assert hits, f"{label}: no cached features — run scripts/prewarm.py"
    result = classify(lat, lng, hits, RADIUS)
    assert result.classification == expected, (
        f"{label}: got {result.classification}, nearest was {result.nearest_feature}"
    )


def test_open_ground_finds_nothing_and_says_so():
    """Open ground southwest of Mrugavani has nothing mapped inside 1km. The
    engine must report that honestly rather than reaching for a verdict."""
    lat, lng = 17.3400, 78.3100
    hits = proximity.find_within(lat, lng, RADIUS)
    assert hits == []
    result = classify(lat, lng, hits, RADIUS)
    assert result.classification == UNKNOWN
    assert result.feature_density == 0


def test_real_industrial_site_cites_its_osm_source():
    """The verdict must be traceable to a real feature, not asserted."""
    hits = proximity.find_within(17.5228, 78.4481, RADIUS)
    result = classify(17.5228, 78.4481, hits, RADIUS)
    assert "OSM way/" in (result.nearest_feature or "") or "OSM relation/" in (result.nearest_feature or "")
