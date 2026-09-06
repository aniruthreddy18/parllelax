/**
 * Wire-format types returned by the FastAPI backend (`backend/app/schemas/schemas.py`).
 * These mirror the API exactly (snake_case) and are translated into the frontend
 * domain types in `adapters.ts`.
 */

export interface IncidentDTO {
  id: string;
  title: string;
  type: string;
  status: string;
  severity: string;
  lat: number;
  lng: number;
  frp_mw: number;
  brightness_k: number;
  confidence: number;
  source: string;
  custom_radius_meters: number;
  location_name: string;
  suggested_action?: string | null;
  created_at: string;
  // --- classifier output ---
  land_cover?: string | null;
  nearest_feature?: string | null;
  nearest_distance_m?: number | null;
  feature_density?: number;
  reasoning_steps?: ReasoningStepDTO[];
}

/**
 * Operator input for a new incident. `type`, `severity` and `confidence` are
 * deliberately absent — the backend derives them from the location.
 */
export interface IncidentCreateDTO {
  title: string;
  lat: number;
  lng: number;
  frp_mw: number;
  brightness_k: number;
  location_name: string;
  custom_radius_meters: number;
  description?: string | null;
}

export interface ReasoningStepDTO {
  stepIndex: number;
  label: string;
  detail: string;
  status: 'passed' | 'warning' | 'critical' | 'neutral';
}

/** One OSM land-use feature found near the ignition point. */
export interface FeatureHitDTO {
  osm_id: string;
  category: string;
  name: string;
  distance_m: number;
  bearing: string;
  /** True when the ignition point falls inside this polygon. */
  contains: boolean;
  area_m2: number;
}

/** Aggregated evidence for one competing land-use category. */
export interface CategoryEvidenceDTO {
  category: string;
  label: string;
  count: number;
  nearest_m: number;
  total_area_m2: number;
  contains_point: boolean;
  score: number;
}

export interface ClassifyResponseDTO {
  lat: number;
  lng: number;
  radius_m: number;
  classification: string;
  severity: string;
  confidence: number;
  land_cover?: string | null;
  nearest_feature?: string | null;
  nearest_distance_m?: number | null;
  /** Total features in the radius — low means thinly mapped, not empty. */
  feature_density: number;
  suggested_action: string;
  reasoning_steps: ReasoningStepDTO[];
  hits: FeatureHitDTO[];
  evidence: CategoryEvidenceDTO[];
  /** True when a rival land use scored close enough to make this uncertain. */
  contested: boolean;
  /** False when Overpass had to be queried live (slower). */
  cache_hit: boolean;
}

export interface AoiStatusDTO {
  demo_centre: { lat: number; lng: number };
  demo_radius_km: number;
  default_search_radius_m: number;
  total_features: number;
  covered_cells: number;
  by_category: Record<string, number>;
}

export interface AffectedUserDTO {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  distance_meters: number;
  opt_in: boolean;
}

export interface EmergencyContactDTO {
  id: string;
  name: string;
  organization: string;
  category: string;
  phone: string;
  email: string;
  distance_meters: number;
}

export interface RiskAnalysisDTO {
  incident_id: string;
  radius_meters: number;
  affected_users_count: number;
  affected_users: AffectedUserDTO[];
  emergency_services_count: number;
  emergency_services: EmergencyContactDTO[];
}

export interface NotificationRecipientDTO {
  id: string;
  event_id: string;
  recipient_name: string;
  recipient_type: string;
  channel: string;
  status: string;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  acknowledged_at?: string | null;
}

export interface AlertAuthorizeDTO {
  status: string;
  event_id: string;
  incident_id: string;
  dispatched_recipients_count: number;
  recipients: NotificationRecipientDTO[];
}

export interface SystemStatusDTO {
  status: string;
  demo_mode: boolean;
  database: string;
  postgis: string;
  fcm: string;
  twilio: string;
  sendgrid: string;
  map_tiles: string;
}

/** Notification channel identifiers accepted by `POST /api/incidents/{id}/alerts/authorize`. */
export type DispatchChannel = 'FCM' | 'SMS' | 'EMAIL';
