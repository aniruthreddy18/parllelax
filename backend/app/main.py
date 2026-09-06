import datetime
import uuid
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings
from app.schemas.schemas import (
  AlertAuthorizeRequest,
  EmergencyContactSchema,
  IncidentCreate,
  IncidentResponse,
  NotificationRecipientSchema,
  RiskAnalysisRequest,
  SystemStatusResponse,
)
from app.schemas.schemas import ClassifyRequest, ClassifyResponse
from app.services.classification.classify_service import classify_location
from app.services.classification.rule_engine import Classification
from app.services.notifications.notification_service import dispatch_incident_alert_sequence
from app.services.osm.feature_cache import cache as osm_cache
from app.services.spatial.spatial_service import (
  find_affected_users_in_radius,
  find_emergency_contacts_in_radius,
)

app = FastAPI(
  title=settings.PROJECT_NAME,
  version=settings.VERSION,
  docs_url="/docs",
  redoc_url="/redoc",
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

# In-Memory Beta Seed Store
#
# Seeds carry coordinates only. Their classification is produced by the rule
# engine at startup (see `_seed_incidents`) rather than hardcoded, so the demo
# data can never drift away from what the engine actually decides.
SEED_POINTS = [
  {
    "id": "FW-BETA-1042",
    "title": "Patancheru Chemical Estate Thermal Anomaly",
    "lat": 17.5300,
    "lng": 78.2600,
    "frp_mw": 184.6,
    "brightness_k": 347.2,
    "location_name": "Patancheru Industrial Estate, Sangareddy",
    "created_at": "2026-09-04 14:37:21 IST",
  },
  {
    "id": "FW-BETA-1041",
    "title": "KBR Park Canopy Heat Signature",
    "lat": 17.4200,
    "lng": 78.4200,
    "frp_mw": 42.3,
    "brightness_k": 328.5,
    "location_name": "KBR National Park, Jubilee Hills",
    "created_at": "2026-09-04 12:15:00 IST",
  },
  {
    "id": "FW-BETA-1039",
    "title": "Jeedimetla Industrial Belt Spike",
    "lat": 17.5228,
    "lng": 78.4481,
    "frp_mw": 112.7,
    "brightness_k": 339.1,
    "location_name": "Jeedimetla Industrial Area, Quthbullapur",
    "created_at": "2026-09-04 11:10:00 IST",
  },
]

INCIDENTS_DB: List[dict] = []

USERS_DB = [
  {"id": "USR-001", "name": "Ravi Kumar", "phone": "+91 98480 11223", "email": "r.kumar@patancheru.in", "lat": 17.5325, "lng": 78.2640, "notification_opt_in": True},
  {"id": "USR-002", "name": "Sneha Reddy", "phone": "+91 90000 44556", "email": "s.reddy@jeedimetla.org", "lat": 17.5080, "lng": 78.4420, "notification_opt_in": True},
  {"id": "USR-003", "name": "Imran Sheikh", "phone": "+91 93910 77889", "email": "i.sheikh@katedan.com", "lat": 17.3120, "lng": 78.4410, "notification_opt_in": True},
  {"id": "USR-004", "name": "Lakshmi Prasad", "phone": "+91 99490 33445", "email": "l.prasad@jubileehills.in", "lat": 17.4215, "lng": 78.4245, "notification_opt_in": True},
  {"id": "USR-005", "name": "Arjun Rao", "phone": "+91 94900 22334", "email": "a.rao@cherlapally.in", "lat": 17.4810, "lng": 78.6010, "notification_opt_in": True},
]

EMERGENCY_CONTACTS_DB = [
  {"id": "EMG-001", "name": "Patancheru Fire Station", "organization": "Telangana State Disaster Response & Fire Services", "category": "fire", "phone": "101 / +91 8455 242100", "email": "fire.patancheru@tsdrf.gov.in", "lat": 17.5280, "lng": 78.2665},
  {"id": "EMG-002", "name": "Cyberabad Police Commissionerate", "organization": "Telangana Police", "category": "police", "phone": "100 / +91 40 2785 3333", "email": "control.cyberabad@tspolice.gov.in", "lat": 17.4320, "lng": 78.3820},
  {"id": "EMG-003", "name": "Osmania General Hospital Emergency", "organization": "Telangana Health Services", "category": "ambulance", "phone": "108 / +91 40 2460 0121", "email": "emergency.ogh@telangana.gov.in", "lat": 17.3730, "lng": 78.4780},
  {"id": "EMG-004", "name": "Jeedimetla Industrial Safety Desk", "organization": "TSIIC Industrial Estate", "category": "facility", "phone": "+91 40 2309 1111", "email": "safety@tsiic.telangana.gov.in", "lat": 17.5115, "lng": 78.4385},
  {"id": "EMG-005", "name": "Secunderabad Fire Station", "organization": "Telangana State Disaster Response & Fire Services", "category": "fire", "phone": "101 / +91 40 2780 4949", "email": "fire.secunderabad@tsdrf.gov.in", "lat": 17.4400, "lng": 78.4980},
]

RECIPIENT_RECORDS_DB = []

@app.get("/")
def read_root():
  return {"name": settings.PROJECT_NAME, "version": settings.VERSION, "demo_mode": settings.DEMO_MODE}

@app.get("/api/incidents", response_model=List[IncidentResponse])
def get_incidents():
  return INCIDENTS_DB

@app.get("/api/incidents/{incident_id}", response_model=IncidentResponse)
def get_incident_by_id(incident_id: str):
  found = next((i for i in INCIDENTS_DB if i["id"] == incident_id), None)
  if not found:
    raise HTTPException(status_code=404, detail="Incident not found")
  return found

def _classification_fields(result: Classification) -> dict:
  """Flatten a rule-engine result into the incident record shape."""
  return {
    "type": result.classification,
    "severity": result.severity,
    "confidence": result.confidence,
    "suggested_action": result.suggested_action,
    "land_cover": result.land_cover,
    "nearest_feature": result.nearest_feature,
    "nearest_distance_m": result.nearest_distance_m,
    "feature_density": result.feature_density,
    "reasoning_steps": result.reasoning_steps,
  }


@app.post("/api/classify", response_model=ClassifyResponse)
def classify_fire_location(req: ClassifyRequest):
  """Classify a fire from its surroundings without recording it.

  Backs the map's click-to-preview: the operator sees the verdict and the
  evidence before deciding to log the incident.
  """
  try:
    result, cache_hit = classify_location(req.lat, req.lng, req.radius_m)
  except ValueError as exc:
    raise HTTPException(status_code=422, detail=str(exc))

  return {
    "lat": req.lat,
    "lng": req.lng,
    "radius_m": req.radius_m,
    "classification": result.classification,
    "severity": result.severity,
    "confidence": result.confidence,
    "land_cover": result.land_cover,
    "nearest_feature": result.nearest_feature,
    "nearest_distance_m": result.nearest_distance_m,
    "feature_density": result.feature_density,
    "suggested_action": result.suggested_action,
    "reasoning_steps": result.reasoning_steps,
    "hits": [
      {
        "osm_id": hit.osm_id,
        "category": hit.category,
        "name": hit.name,
        "distance_m": round(hit.distance_m, 1),
        "bearing": hit.bearing,
        "contains": hit.contains,
        "area_m2": round(hit.area_m2),
      }
      for hit in result.hits
    ],
    "evidence": result.evidence,
    "contested": any(s["label"] == "Contested Call" for s in result.reasoning_steps),
    "cache_hit": cache_hit,
  }


@app.get("/api/aoi")
def get_aoi_status():
  """What the classifier currently knows about, for the map legend."""
  stats = osm_cache.stats()
  return {
    "demo_centre": {"lat": 17.39, "lng": 78.49},
    "demo_radius_km": 50,
    "default_search_radius_m": 1000,
    **stats,
  }


@app.get("/api/aoi/features")
def get_aoi_features():
  """The cached OSM land-use geometry, as GeoJSON, for the map layer.

  Served from the API rather than a static file so the map reflects whatever
  the classifier currently knows — including areas fetched live since boot.
  """
  return {"type": "FeatureCollection", "features": osm_cache.features}


@app.post("/api/incidents", response_model=IncidentResponse)
def create_manual_beta_incident(payload: IncidentCreate):
  """Record an operator-placed fire.

  The event type, severity and confidence are decided here from the location's
  surroundings — they are deliberately not accepted from the client.
  """
  try:
    result, _ = classify_location(payload.lat, payload.lng, int(payload.custom_radius_meters) or 1000)
  except ValueError as exc:
    raise HTTPException(status_code=422, detail=str(exc))

  new_id = f"FW-BETA-{uuid.uuid4().hex[:4].upper()}"
  now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

  new_item = {
    "id": new_id,
    "title": payload.title,
    "status": "ACTIVE",
    "lat": payload.lat,
    "lng": payload.lng,
    "frp_mw": payload.frp_mw,
    "brightness_k": payload.brightness_k,
    "source": "MANUAL_BETA_EVENT",
    "custom_radius_meters": payload.custom_radius_meters,
    "location_name": payload.location_name or (result.nearest_feature or "Unnamed location"),
    "created_at": now_str,
    **_classification_fields(result),
  }
  if payload.description:
    new_item["suggested_action"] = payload.description

  INCIDENTS_DB.insert(0, new_item)
  return new_item


@app.post("/api/incidents/{incident_id}/risk-analysis")
def perform_risk_analysis(incident_id: str, req: RiskAnalysisRequest):
  found = next((i for i in INCIDENTS_DB if i["id"] == incident_id), None)
  if not found:
    raise HTTPException(status_code=404, detail="Incident not found")

  radius = req.radius_meters or found.get("custom_radius_meters", 1000.0)
  affected_users = find_affected_users_in_radius(USERS_DB, found["lat"], found["lng"], radius)
  emergency_services = find_emergency_contacts_in_radius(EMERGENCY_CONTACTS_DB, found["lat"], found["lng"], radius)

  return {
    "incident_id": incident_id,
    "radius_meters": radius,
    "affected_users_count": len(affected_users),
    "affected_users": affected_users,
    "emergency_services_count": len(emergency_services),
    "emergency_services": emergency_services,
  }

@app.post("/api/incidents/{incident_id}/alerts/authorize")
def authorize_alert_dispatch(incident_id: str, req: AlertAuthorizeRequest):
  found = next((i for i in INCIDENTS_DB if i["id"] == incident_id), None)
  if not found:
    raise HTTPException(status_code=404, detail="Incident not found")

  radius = req.custom_radius_meters or found.get("custom_radius_meters", 1000.0)
  affected_users = find_affected_users_in_radius(USERS_DB, found["lat"], found["lng"], radius)
  emergency_services = find_emergency_contacts_in_radius(EMERGENCY_CONTACTS_DB, found["lat"], found["lng"], radius)
  
  all_recipients = emergency_services + affected_users
  dispatched = dispatch_incident_alert_sequence(found, all_recipients, req.channels)
  
  global RECIPIENT_RECORDS_DB
  RECIPIENT_RECORDS_DB = [r for r in RECIPIENT_RECORDS_DB if r["event_id"] != f"NOTIF-EVT-{incident_id}"] + dispatched

  return {
    "status": "AUTHORIZED",
    "event_id": f"NOTIF-EVT-{incident_id}",
    "incident_id": incident_id,
    "dispatched_recipients_count": len(dispatched),
    "recipients": dispatched,
  }

@app.get("/api/incidents/{incident_id}/notifications")
def get_incident_notifications(incident_id: str):
  evt_id = f"NOTIF-EVT-{incident_id}"
  items = [r for r in RECIPIENT_RECORDS_DB if r["event_id"] == evt_id]
  return items

@app.post("/api/notifications/{recipient_id}/acknowledge")
def acknowledge_notification(recipient_id: str):
  for r in RECIPIENT_RECORDS_DB:
    if r["id"] == recipient_id:
      r["status"] = "ACKNOWLEDGED"
      r["acknowledged_at"] = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S IST")
      return r
  raise HTTPException(status_code=404, detail="Recipient notification record not found")

@app.get("/api/system/status", response_model=SystemStatusResponse)
def get_system_status():
  return {
    "status": "OPERATIONAL",
    "demo_mode": settings.DEMO_MODE,
    "database": "POSTGRESQL + POSTGIS READY",
    "postgis": "ST_DWITHIN ACTIVE (SRID 4326)",
    "fcm": "FCM DEMO MODE" if settings.DEMO_MODE or not settings.FCM_PROJECT_ID else "CONNECTED",
    "twilio": "TWILIO DEMO MODE" if settings.DEMO_MODE or not settings.TWILIO_ACCOUNT_SID else "CONNECTED",
    "sendgrid": "SENDGRID DEMO MODE" if settings.DEMO_MODE or not settings.SENDGRID_API_KEY else "CONNECTED",
    "map_tiles": "CARTO DARK / ESRI SATELLITE",
  }


@app.on_event("startup")
def _seed_incidents():
  """Classify the seed points with the live engine on boot.

  Running seeds through the real classifier (rather than shipping hardcoded
  verdicts) guarantees the demo data always matches current engine behaviour.
  """
  if INCIDENTS_DB:
    return
  for point in SEED_POINTS:
    try:
      result, _ = classify_location(point["lat"], point["lng"], 1000)
      INCIDENTS_DB.append({
        "id": point["id"],
        "title": point["title"],
        "status": "ACTIVE",
        "lat": point["lat"],
        "lng": point["lng"],
        "frp_mw": point["frp_mw"],
        "brightness_k": point["brightness_k"],
        "source": "SATELLITE_VIIRS",
        "custom_radius_meters": 1000.0,
        "location_name": point["location_name"],
        "created_at": point["created_at"],
        **_classification_fields(result),
      })
    except Exception as exc:  # a cold cache must not stop the API booting
      print(f"[seed] could not classify {point['id']}: {exc}")
