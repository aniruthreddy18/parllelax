"""
Deterministic fire classification from surroundings.

Ported from the frontend's `classificationEngine.ts` (which was dead code), but
driven by real proximity hits rather than a caller-supplied land-cover value.
The nearest recognised feature decides the verdict; confidence falls off with
distance. Every reasoning step quotes the actual lookup, and all candidates are
listed — never just the winner — so an operator can see and challenge the call.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List

from app.services.osm.taxonomy import (
    CATEGORY_LABEL,
    CROPLAND,
    FOREST,
    INDUSTRIAL,
    SETTLEMENT,
    WATER,
)
from app.services.spatial.proximity_service import FeatureHit

# Verdicts mirror the frontend's `EventClassification` union exactly.
INDUSTRIAL_FIRE = "Industrial Fire"
FOREST_FIRE = "Forest Fire"
AGRICULTURAL_BURNING = "Agricultural Burning"
UNKNOWN = "Unknown Anomaly"

#: Inside this distance the winner is treated as decisive — a fire practically
#: on top of a site is not made ambiguous by whatever else sits nearby.
DECISIVE_DISTANCE_M = 150.0

#: Beyond that, a rival land use within this multiple of the winner's distance
#: makes the call contested.
CONTEST_DISTANCE_RATIO = 2.0

CATEGORY_VERDICT: Dict[str, str] = {
    INDUSTRIAL: INDUSTRIAL_FIRE,
    FOREST: FOREST_FIRE,
    CROPLAND: AGRICULTURAL_BURNING,
    WATER: UNKNOWN,
    SETTLEMENT: UNKNOWN,
}

SUGGESTED_ACTION: Dict[str, str] = {
    INDUSTRIAL_FIRE: (
        "CRITICAL ALERT: Verify facility safety telemetry and dispatch industrial "
        "fire suppression. Check for chemical storage within the danger radius."
    ),
    FOREST_FIRE: (
        "FORESTRY DISPATCH: Alert the regional forest department and monitor the "
        "wind expansion vector."
    ),
    AGRICULTURAL_BURNING: (
        "MONITORING: Consistent with crop residue burning. Track to ensure it "
        "stays contained within the parcel."
    ),
    UNKNOWN: (
        "INSPECTION REQUIRED: Surroundings do not support an automatic verdict. "
        "Task optical re-analysis or dispatch a ground observer."
    ),
}


@dataclass
class Classification:
    classification: str
    severity: str
    confidence: int
    reasoning_steps: List[Dict[str, Any]]
    suggested_action: str
    land_cover: str | None
    nearest_feature: str | None
    nearest_distance_m: float | None
    feature_density: int
    hits: List[FeatureHit] = field(default_factory=list)
    #: Per-category competing evidence, strongest first.
    evidence: List[Dict[str, Any]] = field(default_factory=list)


def score_hit(hit: FeatureHit, radius_m: int) -> float:
    """How strongly one feature argues for its own category.

    Pure nearest-wins is too crude: a 50 m2 unnamed copse at 400 m would beat a
    named 2 km2 refinery at 600 m. Three things matter instead —

      * containment, which is decisive and outranks anything merely nearby;
      * proximity, falling off quadratically to zero at the search radius;
      * significance, since a large named site is stronger evidence than a
        scrap of untagged land.
    """
    if hit.contains:
        # Inside the polygon. Rank containing features by size so the dominant
        # land use wins when polygons overlap.
        return 1000.0 + math.log10(max(hit.area_m2, 1.0))

    proximity = (1.0 - hit.distance_m / radius_m) ** 2
    # 100 m2 -> 1.0, 10k m2 -> 2.0, 1M m2 -> 4.0
    significance = math.log10(max(hit.area_m2, 100.0)) - 1.0
    named = 1.2 if hit.name else 1.0
    return proximity * significance * named


def _evidence_factor(hit_count: int) -> float:
    """Discount confidence when the verdict rests on very little.

    One lone feature 600 m away is a far weaker basis than eight overlapping
    ones, and the score alone does not capture that.
    """
    return min(1.0, 0.55 + 0.15 * hit_count)


def summarise_evidence(hits: List[FeatureHit], radius_m: int) -> List[Dict[str, Any]]:
    """Per-category totals, so the operator can see the competing evidence."""
    grouped: Dict[str, List[FeatureHit]] = {}
    for hit in hits:
        grouped.setdefault(hit.category, []).append(hit)

    summary = [
        {
            "category": category,
            "label": CATEGORY_LABEL.get(category, category),
            "count": len(items),
            "nearest_m": round(min(h.distance_m for h in items), 1),
            "total_area_m2": round(sum(h.area_m2 for h in items)),
            "contains_point": any(h.contains for h in items),
            "score": round(max(score_hit(h, radius_m) for h in items), 3),
        }
        for category, items in grouped.items()
    ]
    summary.sort(key=lambda row: row["score"], reverse=True)
    return summary


def _confidence_for(distance_m: float) -> tuple[int, str]:
    """Confidence falls off with distance from the deciding feature."""
    if distance_m <= 200:
        return 95, "within 200m — very high"
    if distance_m <= 500:
        return 85, "within 500m — high"
    return 70, "within 1km — medium"


def _severity_for(verdict: str, distance_m: float) -> str:
    if verdict == INDUSTRIAL_FIRE:
        return "CRITICAL" if distance_m <= 200 else "HIGH"
    if verdict == FOREST_FIRE:
        return "HIGH"
    if verdict == AGRICULTURAL_BURNING:
        return "LOW"
    return "MEDIUM"


def classify(lat: float, lng: float, hits: List[FeatureHit], radius_m: int) -> Classification:
    """Decide what kind of fire this is from what surrounds it."""
    steps: List[Dict[str, Any]] = [{
        "stepIndex": 1,
        "label": "Ignition Point Received",
        "detail": f"Fire reported at {lat:.5f}, {lng:.5f}. Scanning {radius_m}m radius for land-use context.",
        "status": "neutral",
    }]

    # --- Rule 0: nothing recognised nearby ---------------------------------
    if not hits:
        steps.append({
            "stepIndex": 2,
            "label": "Proximity Scan",
            "detail": (
                f"No recognised land-use features within {radius_m}m. This is either genuinely "
                "open ground, or the area is not mapped in OpenStreetMap — the two cannot be "
                "distinguished from this data alone."
            ),
            "status": "warning",
        })
        steps.append({
            "stepIndex": 3,
            "label": "Rule Engine Output",
            "detail": "No basis for an automatic verdict. Escalated for manual inspection.",
            "status": "warning",
        })
        return Classification(
            classification=UNKNOWN,
            severity="MEDIUM",
            confidence=25,
            reasoning_steps=steps,
            suggested_action=SUGGESTED_ACTION[UNKNOWN],
            land_cover=None,
            nearest_feature=None,
            nearest_distance_m=None,
            feature_density=0,
            hits=[],
        )

    # --- Proximity summary -------------------------------------------------
    by_category: Dict[str, int] = {}
    for hit in hits:
        by_category[hit.category] = by_category.get(hit.category, 0) + 1
    breakdown = ", ".join(
        f"{count}x {CATEGORY_LABEL.get(category, category)}"
        for category, count in sorted(by_category.items(), key=lambda kv: -kv[1])
    )
    steps.append({
        "stepIndex": 2,
        "label": "Proximity Scan",
        "detail": f"{len(hits)} land-use features found within {radius_m}m — {breakdown}.",
        "status": "passed",
    })

    # --- Score the candidates and let the strongest decide ----------------
    evidence = summarise_evidence(hits, radius_m)
    ranked = sorted(hits, key=lambda h: score_hit(h, radius_m), reverse=True)
    nearest = ranked[0]

    verdict = CATEGORY_VERDICT.get(nearest.category, UNKNOWN)
    confidence, band = _confidence_for(0.0 if nearest.contains else nearest.distance_m)

    # Thin evidence must not read as certainty.
    evidence_factor = _evidence_factor(len(hits))
    confidence = round(confidence * evidence_factor)

    # A close contest between two different land uses is genuinely uncertain,
    # and reporting a confident verdict there would be the inaccurate answer.
    #
    # Judged on distance rather than score: score gaps compress at close range
    # and exaggerate at long range, so a decisive 13 m hit can look "close" to a
    # 127 m one while a real 491 m vs 823 m toss-up looks decided.
    runner_up = next((h for h in ranked[1:] if h.category != nearest.category), None)
    contested = (
        runner_up is not None
        and not nearest.contains
        and nearest.distance_m > DECISIVE_DISTANCE_M
        and runner_up.distance_m < nearest.distance_m * CONTEST_DISTANCE_RATIO
    )
    if contested:
        confidence = round(confidence * 0.7)

    confidence = max(35, confidence)

    severity = _severity_for(verdict, 0.0 if nearest.contains else nearest.distance_m)
    is_urgent = severity in ("CRITICAL", "HIGH")

    steps.append({
        "stepIndex": 3,
        "label": "Strongest Evidence" if not nearest.contains else "Ignition Point Falls Inside",
        "detail": (
            f"{nearest.describe()} — {CATEGORY_LABEL.get(nearest.category, nearest.category)}, "
            f"{nearest.area_m2 / 10_000:.1f} ha."
            + ("" if nearest.contains else " Ranked on distance and site size, not distance alone.")
        ),
        "status": "critical" if is_urgent else "passed",
    })

    # --- Alternatives considered ------------------------------------------
    others = ranked[1:5]
    if others:
        steps.append({
            "stepIndex": 4,
            "label": "Alternatives Considered",
            "detail": "; ".join(
                f"{CATEGORY_LABEL.get(hit.category, hit.category)} {hit.describe()}"
                for hit in others
            ),
            "status": "neutral",
        })

    if contested and runner_up is not None:
        steps.append({
            "stepIndex": len(steps) + 1,
            "label": "Contested Call",
            "detail": (
                f"{CATEGORY_LABEL.get(runner_up.category, runner_up.category)} "
                f"({runner_up.describe()}) scores nearly as highly. The site sits between two "
                "different land uses, so this verdict is not clear-cut — confidence lowered "
                "and manual confirmation advised."
            ),
            "status": "warning",
        })

    next_index = len(steps) + 1

    # --- Water bodies are treated as sensor artefacts ----------------------
    if nearest.category == WATER:
        steps.append({
            "stepIndex": next_index,
            "label": "Rule Engine Output",
            "detail": (
                f"Nearest feature is a water body at {nearest.distance_m:.0f}m. A fire cannot "
                "sustain on open water, so this is flagged as a probable sensor false positive."
            ),
            "status": "warning",
        })
        return Classification(
            classification=UNKNOWN, severity="LOW", confidence=60,
            reasoning_steps=steps,
            suggested_action="LIKELY FALSE POSITIVE: Nearest land use is open water. Verify the sensor reading before dispatch.",
            land_cover=nearest.category, nearest_feature=nearest.describe(),
            nearest_distance_m=nearest.distance_m, feature_density=len(hits), hits=hits, evidence=evidence,
        )

    # --- Residential / commercial has no dedicated verdict -----------------
    if nearest.category == SETTLEMENT:
        steps.append({
            "stepIndex": next_index,
            "label": "Rule Engine Output",
            "detail": (
                f"Nearest feature is residential or commercial at {nearest.distance_m:.0f}m — a "
                "structural fire rather than an industrial or vegetation event. No industrial "
                "land use is closer, so no industrial verdict is issued."
            ),
            "status": "warning",
        })
        return Classification(
            classification=UNKNOWN, severity="MEDIUM", confidence=confidence,
            reasoning_steps=steps,
            suggested_action="URBAN RESPONSE: Nearest land use is residential/commercial. Route to municipal fire services.",
            land_cover=nearest.category, nearest_feature=nearest.describe(),
            nearest_distance_m=nearest.distance_m, feature_density=len(hits), hits=hits, evidence=evidence,
        )

    # --- Industrial / forest / cropland verdict ----------------------------
    where = "contains the ignition point" if nearest.contains else f"is {nearest.distance_m:.0f}m away ({band})"
    thin = "" if evidence_factor >= 1.0 else (
        f" Confidence reduced because only {len(hits)} feature"
        f"{'' if len(hits) == 1 else 's'} could be found in range."
    )
    steps.append({
        "stepIndex": next_index,
        "label": "Confidence Assessment",
        "detail": f"Deciding feature {where} — confidence {confidence}%.{thin}",
        "status": "warning" if confidence < 85 else "passed",
    })
    steps.append({
        "stepIndex": next_index + 1,
        "label": "Rule Engine Output",
        "detail": f"Classified as {verdict} at {severity} severity.",
        "status": "critical" if is_urgent else "passed",
    })

    return Classification(
        classification=verdict,
        severity=severity,
        confidence=confidence,
        reasoning_steps=steps,
        suggested_action=SUGGESTED_ACTION[verdict],
        land_cover=nearest.category,
        nearest_feature=nearest.describe(),
        nearest_distance_m=nearest.distance_m,
        feature_density=len(hits),
        hits=hits,
        evidence=evidence,
    )
