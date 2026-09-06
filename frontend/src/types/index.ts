export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type EventClassification =
  | 'Industrial Fire'
  | 'Routine Flare'
  | 'Forest Fire'
  | 'Agricultural Burning'
  | 'Unknown Anomaly';

export type FacilityType =
  | 'Refinery'
  | 'Power Plant'
  | 'Chemical Complex'
  | 'LNG Terminal'
  | 'Fertilizer Plant'
  | 'Metal Smelter';

export type FacilityStatus = 'NORMAL' | 'ELEVATED' | 'ANOMALY_DETECTED';

export type LandCoverCategory = 'Built-up Industrial' | 'Dense Forest' | 'Cropland' | 'Water Body' | 'Scrubland';

export interface ReasoningStep {
  stepIndex: number;
  label: string;
  detail: string;
  status: 'passed' | 'warning' | 'critical' | 'neutral';
}

export interface ThermalHotspot {
  id: string;
  lat: number;
  lng: number;
  frpMw: number;
  brightnessK: number;
  confidence: number;
  timestamp: string;
  timeFormatted: string;
  dayNight: 'D' | 'N';
  landCover: LandCoverCategory;
  facilityDistanceKm: number;
  nearestFacilityId: string;
  nearestFacilityName: string;
  classification: EventClassification;
  severity: SeverityLevel;
  historicalOccurrenceCount: number;
  firstSeenDate: string;
  reasoningSteps: ReasoningStep[];
  suggestedAction: string;
  locationName: string;
  isNew: boolean;

  /** Provenance & backend-only fields, present when the record came from the FastAPI backend. */
  isLive?: boolean;
  statusLabel?: string;
  sourceLabel?: string;
  customRadiusMeters?: number;
}

export interface IndustrialFacility {
  id: string;
  name: string;
  type: FacilityType;
  lat: number;
  lng: number;
  location: string;
  status: FacilityStatus;
  baselineFRP: number; // MW
  currentFRP: number;  // MW
  lastDetected: string;
  totalEventsPast90Days: number;
  emergencyContact: string;
  riskBufferRadiusKm: number;
}

export interface AlertItem {
  id: string;
  hotspotId: string;
  incidentId?: string;
  title: string;
  message?: string;
  severity: SeverityLevel;
  facilityName: string;
  timestamp: string;
  timestampFormatted?: string;
  locationName: string;
  frpMw: number;
  isUnresolved: boolean;
}

export interface GISLayerVisibility {
  thermalVIIRS: boolean;
  frpIntensity: boolean;
  industrialFacilities: boolean;
  landCover: boolean;
  riskZones: boolean;
  administrativeBounds: boolean;
}

export type MapMode = 'satellite' | 'dark' | 'terrain' | 'street';

export interface FilterState {
  region: string;
  eventType: string;
  severity: string;
  dateRange: '24h' | '7d' | '30d' | '180d';
  minFRP: number;
  landCover: string;
  searchKeyword: string;
}

export interface SituationMetrics {
  totalDetected: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  avgFrp: number;
  eventMix: Record<EventClassification, number>;
  latestHotspot?: ThermalHotspot;
}
