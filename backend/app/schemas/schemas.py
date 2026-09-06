from typing import List, Optional
from pydantic import BaseModel

class ReasoningStepSchema(BaseModel):
    """Matches the `ReasoningStep` shape the frontend's ReasoningFlow renders."""
    stepIndex: int
    label: str
    detail: str
    status: str  # passed | warning | critical | neutral


class FeatureHitSchema(BaseModel):
    """One OSM land-use feature found near the ignition point."""
    osm_id: str
    category: str
    name: str
    distance_m: float
    bearing: str
    contains: bool = False
    area_m2: float = 0.0


class CategoryEvidenceSchema(BaseModel):
    """Aggregated evidence for one competing land-use category."""
    category: str
    label: str
    count: int
    nearest_m: float
    total_area_m2: float
    contains_point: bool
    score: float


class ClassifyRequest(BaseModel):
    lat: float
    lng: float
    radius_m: int = 1000


class ClassifyResponse(BaseModel):
    lat: float
    lng: float
    radius_m: int
    classification: str
    severity: str
    confidence: int
    land_cover: Optional[str] = None
    nearest_feature: Optional[str] = None
    nearest_distance_m: Optional[float] = None
    #: Total features found in the radius. Low values mean the area is thinly
    #: mapped, which is different from "nothing is there".
    feature_density: int
    suggested_action: str
    reasoning_steps: List[ReasoningStepSchema]
    hits: List[FeatureHitSchema]
    #: Competing land uses in range, strongest first.
    evidence: List[CategoryEvidenceSchema] = []
    #: True when a rival land use scored close enough to make this uncertain.
    contested: bool = False
    #: False when Overpass had to be queried live for this point.
    cache_hit: bool


class IncidentCreate(BaseModel):
    """Operator input. `type`, `severity` and `confidence` are NOT accepted —
    they are derived from the location by the classifier."""
    title: str
    lat: float
    lng: float
    frp_mw: float = 85.0
    brightness_k: float = 330.0
    location_name: str = ""
    custom_radius_meters: float = 1000.0
    description: Optional[str] = None


class IncidentResponse(BaseModel):
    id: str
    title: str
    type: str
    status: str
    severity: str
    lat: float
    lng: float
    frp_mw: float
    brightness_k: float
    confidence: int
    source: str
    custom_radius_meters: float
    location_name: str
    suggested_action: Optional[str] = None
    created_at: str
    # --- classifier output ---
    land_cover: Optional[str] = None
    nearest_feature: Optional[str] = None
    nearest_distance_m: Optional[float] = None
    feature_density: int = 0
    reasoning_steps: List[ReasoningStepSchema] = []

class RiskAnalysisRequest(BaseModel):
    incident_id: str
    radius_meters: float = 1000.0

class AffectedUserSchema(BaseModel):
    id: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    distance_meters: float
    opt_in: bool

class EmergencyContactSchema(BaseModel):
    id: str
    name: str
    organization: str
    category: str
    phone: str
    email: str
    distance_meters: float

class AlertAuthorizeRequest(BaseModel):
    incident_id: str
    channels: List[str] = ["FCM", "SMS", "EMAIL"]
    custom_radius_meters: float = 1000.0

class NotificationRecipientSchema(BaseModel):
    id: str
    event_id: str
    recipient_name: str
    recipient_type: str
    channel: str
    status: str
    sent_at: Optional[str] = None
    delivered_at: Optional[str] = None
    read_at: Optional[str] = None
    acknowledged_at: Optional[str] = None

class SystemStatusResponse(BaseModel):
    status: str
    demo_mode: bool
    database: str
    postgis: str
    fcm: str
    twilio: str
    sendgrid: str
    map_tiles: str
