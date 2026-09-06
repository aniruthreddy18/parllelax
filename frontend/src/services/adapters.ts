/**
 * Translates backend DTOs into the frontend domain model.
 *
 * The backend incident record is authoritative for classification, severity,
 * thermal readings and recommended action. Fields the API does not carry
 * (nearest facility, land cover, day/night flag) are derived here from data the
 * frontend already holds, and every derived value is reflected honestly in the
 * generated reasoning trail.
 */
import { MOCK_FACILITIES } from '../data/mockFacilities';
import type {
  AlertItem,
  EventClassification,
  IndustrialFacility,
  LandCoverCategory,
  ReasoningStep,
  SeverityLevel,
  ThermalHotspot,
} from '../types';
import { haversineDistanceMeters } from '../utils/geo';
import type { IncidentDTO } from './types';

const CLASSIFICATION_BY_BACKEND_TYPE: Record<string, EventClassification> = {
  'industrial fire': 'Industrial Fire',
  'routine flare': 'Routine Flare',
  'gas flare': 'Routine Flare',
  'forest fire': 'Forest Fire',
  wildfire: 'Forest Fire',
  'agricultural burning': 'Agricultural Burning',
  'agricultural fire': 'Agricultural Burning',
  'unknown thermal event': 'Unknown Anomaly',
  'unknown anomaly': 'Unknown Anomaly',
};

const SEVERITY_VALUES: SeverityLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

function mapClassification(backendType: string): EventClassification {
  return CLASSIFICATION_BY_BACKEND_TYPE[backendType.trim().toLowerCase()] ?? 'Unknown Anomaly';
}

function mapSeverity(backendSeverity: string): SeverityLevel {
  const upper = backendSeverity.trim().toUpperCase() as SeverityLevel;
  return SEVERITY_VALUES.includes(upper) ? upper : 'MEDIUM';
}

/**
 * The backend stamps `created_at` as "YYYY-MM-DD HH:MM:SS IST" but generates the
 * value with `datetime.utcnow()`, so the numbers are UTC. Parse them as UTC and
 * let the browser render the true IST wall-clock time.
 */
function parseBackendTimestamp(createdAt: string): Date {
  const match = createdAt.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    const fallback = new Date(createdAt);
    return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
  }
  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)),
  );
}

function formatIst(date: Date): string {
  return `${date.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false })} IST`;
}

function istHour(date: Date): number {
  return Number(date.toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }));
}

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${Math.round(hours / 24)} day${Math.round(hours / 24) === 1 ? '' : 's'} ago`;
}

interface NearestFacility {
  facility: IndustrialFacility | null;
  distanceKm: number;
}

function resolveNearestFacility(lat: number, lng: number, facilities: IndustrialFacility[]): NearestFacility {
  let nearest: IndustrialFacility | null = null;
  let shortestMeters = Number.POSITIVE_INFINITY;

  for (const facility of facilities) {
    const meters = haversineDistanceMeters(lat, lng, facility.lat, facility.lng);
    if (meters < shortestMeters) {
      shortestMeters = meters;
      nearest = facility;
    }
  }

  return {
    facility: nearest,
    distanceKm: nearest ? Math.round((shortestMeters / 1000) * 100) / 100 : 0,
  };
}

function deriveLandCover(classification: EventClassification, distanceKm: number): LandCoverCategory {
  switch (classification) {
    case 'Forest Fire':
      return 'Dense Forest';
    case 'Agricultural Burning':
      return 'Cropland';
    case 'Industrial Fire':
    case 'Routine Flare':
      return 'Built-up Industrial';
    default:
      return distanceKm <= 2 ? 'Built-up Industrial' : 'Scrubland';
  }
}

/**
 * Reasoning now comes from the backend rule engine, which cites the actual OSM
 * features it measured. This fallback only covers records predating that (or a
 * backend that failed to classify) so the UI never renders an empty trail.
 */
function fallbackReasoningSteps(
  incident: IncidentDTO,
  classification: EventClassification,
  severity: SeverityLevel,
  nearest: NearestFacility,
): ReasoningStep[] {
  return [
    {
      stepIndex: 1,
      label: 'Detection Source',
      detail: `FRP ${incident.frp_mw} MW / brightness ${incident.brightness_k} K at ${incident.confidence}% confidence (source: ${incident.source})`,
      status: severity === 'CRITICAL' || severity === 'HIGH' ? 'critical' : 'passed',
    },
    {
      stepIndex: 2,
      label: 'Spatial Context',
      detail: nearest.facility
        ? `${Math.round(nearest.distanceKm * 1000)} m from ${nearest.facility.name}`
        : 'No registered facility near these coordinates',
      status: 'neutral',
    },
    {
      stepIndex: 3,
      label: 'Classification',
      detail: `Recorded as ${classification} at ${severity} severity. Detailed reasoning unavailable for this record.`,
      status: 'warning',
    },
  ];
}

/** Convert one backend incident record into the frontend `ThermalHotspot` model. */
export function incidentToHotspot(
  incident: IncidentDTO,
  facilities: IndustrialFacility[] = MOCK_FACILITIES,
): ThermalHotspot {
  const detectedAt = parseBackendTimestamp(incident.created_at);
  const classification = mapClassification(incident.type);
  const severity = mapSeverity(incident.severity);
  const nearest = resolveNearestFacility(incident.lat, incident.lng, facilities);
  const hour = istHour(detectedAt);

  return {
    id: incident.id,
    lat: incident.lat,
    lng: incident.lng,
    frpMw: incident.frp_mw,
    brightnessK: incident.brightness_k,
    confidence: incident.confidence,
    timestamp: detectedAt.toISOString(),
    timeFormatted: formatIst(detectedAt),
    dayNight: hour >= 6 && hour < 18 ? 'D' : 'N',
    // The backend resolves land cover from real OSM geometry; the local
    // derivation is only a fallback for records it did not classify.
    landCover: (incident.land_cover as LandCoverCategory | undefined)
      ?? deriveLandCover(classification, nearest.distanceKm),
    facilityDistanceKm: incident.nearest_distance_m != null
      ? Math.round((incident.nearest_distance_m / 1000) * 100) / 100
      : nearest.distanceKm,
    nearestFacilityId: nearest.facility?.id ?? '',
    nearestFacilityName: incident.nearest_feature
      ?? nearest.facility?.name
      ?? 'No registered facility nearby',
    classification,
    severity,
    // Not tracked by the incidents API; surfaced as 0 rather than invented.
    historicalOccurrenceCount: 0,
    firstSeenDate: detectedAt.toISOString().slice(0, 10),
    reasoningSteps: incident.reasoning_steps?.length
      ? incident.reasoning_steps
      : fallbackReasoningSteps(incident, classification, severity, nearest),
    suggestedAction: incident.suggested_action ?? 'No recommended action supplied by the backend.',
    locationName: incident.location_name,
    isNew: incident.source === 'MANUAL_BETA_EVENT',
    isLive: true,
    statusLabel: incident.status,
    sourceLabel: incident.source,
    customRadiusMeters: incident.custom_radius_meters,
  };
}

export function incidentsToHotspots(
  incidents: IncidentDTO[],
  facilities: IndustrialFacility[] = MOCK_FACILITIES,
): ThermalHotspot[] {
  return incidents
    .map((incident) => incidentToHotspot(incident, facilities))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * The backend has no alerts endpoint; the operational alert queue is derived
 * from active incidents so it stays consistent with live incident data.
 */
export function hotspotsToAlerts(hotspots: ThermalHotspot[], now: Date = new Date()): AlertItem[] {
  return hotspots
    .filter((hotspot) => hotspot.statusLabel !== 'RESOLVED')
    .map((hotspot) => {
      const detectedAt = new Date(hotspot.timestamp);
      return {
        id: `ALT-${hotspot.id}`,
        hotspotId: hotspot.id,
        incidentId: hotspot.id,
        title: `${hotspot.classification.toUpperCase()} — ${hotspot.locationName}`,
        message: hotspot.suggestedAction,
        severity: hotspot.severity,
        facilityName: hotspot.nearestFacilityName,
        timestamp: `${formatRelativeTime(detectedAt, now)} (${hotspot.timeFormatted})`,
        timestampFormatted: hotspot.timeFormatted,
        locationName: hotspot.locationName,
        frpMw: hotspot.frpMw,
        isUnresolved: hotspot.severity === 'CRITICAL' || hotspot.severity === 'HIGH',
      };
    });
}
