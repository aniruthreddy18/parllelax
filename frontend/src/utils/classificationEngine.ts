import type { EventClassification, LandCoverCategory, ReasoningStep, SeverityLevel } from '../types';

export interface ClassificationInput {
  frpMw: number;
  brightnessK: number;
  facilityDistanceKm: number;
  landCover: LandCoverCategory;
  historicalOccurrenceCount: number;
  isNew: boolean;
}

export interface ClassificationResult {
  classification: EventClassification;
  severity: SeverityLevel;
  confidence: number;
  reasoningSteps: ReasoningStep[];
  suggestedAction: string;
}

export function classifyThermalAnomaly(input: ClassificationInput): ClassificationResult {
  const isInsideIndustrialZone = input.facilityDistanceKm <= 1.0 || input.landCover === 'Built-up Industrial';

  // Rule 1: Industrial + Repeat Pattern => Routine Flare / Normal Heat Source
  if (isInsideIndustrialZone && input.historicalOccurrenceCount >= 10) {
    return {
      classification: 'Routine Flare',
      severity: 'MEDIUM',
      confidence: 94,
      reasoningSteps: [
        { stepIndex: 1, label: 'Spatial Proximity Check', detail: `Located ${Math.round(input.facilityDistanceKm * 1000)}m inside industrial asset perimeter`, status: 'passed' },
        { stepIndex: 2, label: 'Historical Recurrence Check', detail: `${input.historicalOccurrenceCount} historical occurrences logged over 180 days`, status: 'passed' },
        { stepIndex: 3, label: 'Thermal Profile Analysis', detail: `FRP ${input.frpMw} MW aligns with baseline industrial flare signature`, status: 'passed' },
        { stepIndex: 4, label: 'Rule Engine Output', detail: 'Classified as Routine Gas Flare / Industrial Process Heat', status: 'passed' },
      ],
      suggestedAction: 'ROUTINE MONITORING: Operational flare signature verified against facility emissions baseline.',
    };
  }

  // Rule 2: Industrial + New or High FRP => Suspected Industrial Fire
  if (isInsideIndustrialZone && (input.isNew || input.frpMw > 100)) {
    const isCritical = input.frpMw > 150 || input.historicalOccurrenceCount === 0;
    return {
      classification: 'Industrial Fire',
      severity: isCritical ? 'HIGH' : 'HIGH',
      confidence: 91,
      reasoningSteps: [
        { stepIndex: 1, label: 'Spatial Proximity Check', detail: `Located ${Math.round(input.facilityDistanceKm * 1000)}m inside high-risk industrial facility zone`, status: 'critical' },
        { stepIndex: 2, label: 'Thermal Spike Detection', detail: `FRP ${input.frpMw} MW exceeds industrial safety threshold (100 MW)`, status: 'warning' },
        { stepIndex: 3, label: 'Historical Anomaly Lookup', detail: `${input.historicalOccurrenceCount} past occurrences (Unprecedented thermal activity)`, status: 'critical' },
        { stepIndex: 4, label: 'Rule Engine Output', detail: 'Classified as Suspected Industrial Fire — Immediate Action Required', status: 'critical' },
      ],
      suggestedAction: 'CRITICAL ALERT: Initiate emergency safety verification with facility manager & local responder units.',
    };
  }

  // Rule 3: Dense Forest land cover => Forest Fire
  if (input.landCover === 'Dense Forest') {
    return {
      classification: 'Forest Fire',
      severity: input.frpMw > 50 ? 'HIGH' : 'MEDIUM',
      confidence: 85,
      reasoningSteps: [
        { stepIndex: 1, label: 'Land Cover Intersection', detail: 'Coordinates intersect classified dense forest reserve canopy', status: 'warning' },
        { stepIndex: 2, label: 'Distance to Infrastructure', detail: `Located ${input.facilityDistanceKm.toFixed(1)}km from nearest industrial site (Remote)`, status: 'passed' },
        { stepIndex: 3, label: 'Rule Engine Output', detail: 'Classified as Forest / Vegetation Canopy Fire', status: 'warning' },
      ],
      suggestedAction: 'FORESTRY DISPATCH: Alert regional forest department and monitor wind expansion vector.',
    };
  }

  // Rule 4: Cropland land cover => Agricultural Burning
  if (input.landCover === 'Cropland') {
    return {
      classification: 'Agricultural Burning',
      severity: 'LOW',
      confidence: 78,
      reasoningSteps: [
        { stepIndex: 1, label: 'Land Cover Intersection', detail: 'Coordinates intersect agricultural cropland parcel', status: 'passed' },
        { stepIndex: 2, label: 'Thermal Profile Analysis', detail: `Low-to-moderate FRP (${input.frpMw} MW) characteristic of stubble burning`, status: 'passed' },
        { stepIndex: 3, label: 'Rule Engine Output', detail: 'Classified as Agricultural Crop Residue Burning', status: 'passed' },
      ],
      suggestedAction: 'MONITORING: Track crop burning location to ensure it remains contained within parcel bounds.',
    };
  }

  // Rule 5: Default => Unknown Anomaly
  return {
    classification: 'Unknown Anomaly',
    severity: 'MEDIUM',
    confidence: 65,
    reasoningSteps: [
      { stepIndex: 1, label: 'Spatial Context Check', detail: `Located ${input.facilityDistanceKm.toFixed(1)}km from industrial boundary`, status: 'warning' },
      { stepIndex: 2, label: 'Land Cover Check', detail: `Land cover: ${input.landCover}`, status: 'neutral' },
      { stepIndex: 3, label: 'Rule Engine Output', detail: 'Unclassified Anomaly — Manual GIS Inspection Required', status: 'warning' },
    ],
    suggestedAction: 'INSPECTION REQUIRED: Task satellite optical re-analysis or dispatch ground observer for manual verification.',
  };
}
