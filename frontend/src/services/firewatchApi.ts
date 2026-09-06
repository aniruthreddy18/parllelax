/**
 * One function per FastAPI endpoint exposed by `backend/app/main.py`.
 * Every call returns the raw backend DTO; translation to frontend domain
 * types happens in `adapters.ts`.
 */
import { apiRequest } from './apiClient';
import type {
  AlertAuthorizeDTO,
  AoiStatusDTO,
  ClassifyResponseDTO,
  DispatchChannel,
  IncidentCreateDTO,
  IncidentDTO,
  NotificationRecipientDTO,
  RiskAnalysisDTO,
  SystemStatusDTO,
} from './types';

/** GET /api/incidents */
export function fetchIncidents(signal?: AbortSignal): Promise<IncidentDTO[]> {
  return apiRequest<IncidentDTO[]>('/api/incidents', { signal });
}

/** GET /api/incidents/{incident_id} */
export function fetchIncident(incidentId: string, signal?: AbortSignal): Promise<IncidentDTO> {
  return apiRequest<IncidentDTO>(`/api/incidents/${encodeURIComponent(incidentId)}`, { signal });
}

/** POST /api/incidents — operator-triggered manual beta event. */
export function createIncident(payload: IncidentCreateDTO, signal?: AbortSignal): Promise<IncidentDTO> {
  return apiRequest<IncidentDTO>('/api/incidents', { method: 'POST', body: payload, signal });
}

/** POST /api/incidents/{incident_id}/risk-analysis — spatial radius query. */
export function fetchRiskAnalysis(
  incidentId: string,
  radiusMeters: number,
  signal?: AbortSignal,
): Promise<RiskAnalysisDTO> {
  return apiRequest<RiskAnalysisDTO>(`/api/incidents/${encodeURIComponent(incidentId)}/risk-analysis`, {
    method: 'POST',
    // The backend schema requires `incident_id` in the body even though it is also in the path.
    body: { incident_id: incidentId, radius_meters: radiusMeters },
    signal,
  });
}

/** POST /api/incidents/{incident_id}/alerts/authorize — admin-authorized dispatch. */
export function authorizeAlertDispatch(
  incidentId: string,
  channels: DispatchChannel[],
  radiusMeters: number,
  signal?: AbortSignal,
): Promise<AlertAuthorizeDTO> {
  return apiRequest<AlertAuthorizeDTO>(`/api/incidents/${encodeURIComponent(incidentId)}/alerts/authorize`, {
    method: 'POST',
    body: { incident_id: incidentId, channels, custom_radius_meters: radiusMeters },
    signal,
  });
}

/** GET /api/incidents/{incident_id}/notifications */
export function fetchIncidentNotifications(
  incidentId: string,
  signal?: AbortSignal,
): Promise<NotificationRecipientDTO[]> {
  return apiRequest<NotificationRecipientDTO[]>(
    `/api/incidents/${encodeURIComponent(incidentId)}/notifications`,
    { signal },
  );
}

/** POST /api/notifications/{recipient_id}/acknowledge */
export function acknowledgeNotification(
  recipientId: string,
  signal?: AbortSignal,
): Promise<NotificationRecipientDTO> {
  return apiRequest<NotificationRecipientDTO>(
    `/api/notifications/${encodeURIComponent(recipientId)}/acknowledge`,
    { method: 'POST', body: {}, signal },
  );
}

/** GET /api/system/status */
export function fetchSystemStatus(signal?: AbortSignal): Promise<SystemStatusDTO> {
  return apiRequest<SystemStatusDTO>('/api/system/status', { signal });
}

/**
 * POST /api/classify — decide what kind of fire a location implies, without
 * recording it. A cache miss queries Overpass live and can take a few seconds,
 * so callers should show a pending state.
 */
export function classifyLocation(
  lat: number,
  lng: number,
  radiusM = 1000,
  signal?: AbortSignal,
): Promise<ClassifyResponseDTO> {
  return apiRequest<ClassifyResponseDTO>('/api/classify', {
    method: 'POST',
    body: { lat, lng, radius_m: radiusM },
    // Uncached areas need a live Overpass fetch, and a densely mapped city can
    // take a minute on a loaded public mirror. 60s was cutting it too fine.
    timeoutMs: 150000,
    signal,
  });
}

/** GET /api/aoi — what the classifier currently has cached. */
export function fetchAoiStatus(signal?: AbortSignal): Promise<AoiStatusDTO> {
  return apiRequest<AoiStatusDTO>('/api/aoi', { signal });
}
