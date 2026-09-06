# Industrial FireWatch v2 — Technical Architecture & Provider Decisions

This document details all technical decisions requiring environment configuration, tile provider configurations, backend database connections, notification API credentials, and user privacy enforcement rules.

---

## 1. Map & GIS Tile Providers

| Configuration Item | Decision / Provider | Status | Environment Variable |
| :--- | :--- | :--- | :--- |
| **Dark Vector GIS Basemap** | Carto Dark Matter (`https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png`) | **ACTIVE (FALLBACK READY)** | `VITE_MAP_STYLE_URL` |
| **Satellite Imagery Layer** | Esri World Imagery (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`) | **ACTIVE** | `VITE_SATELLITE_TILE_URL` |
| **NASA GIBS Tile Layer** | NASA GIBS Near Real-Time MODIS / VIIRS true color imagery | **READY** | `VITE_NASA_GIBS_URL` |

> [!NOTE]
> If custom tile provider credentials are required in production, specify `VITE_MAP_STYLE_URL` in `frontend/.env`. If omitted, the application uses the default Carto Dark and Esri World Imagery fallback services.

---

## 2. Spatial Database & Backend Setup

| Service | Technology | Status | Connection String / Config |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | Python 3.11+ / FastAPI | **IMPLEMENTED (`backend/app/main.py`)** | `uvicorn app.main:app --port 8000` |
| **Spatial Database** | PostgreSQL + PostGIS | **READY (SRID 4326)** | `DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/firewatch_db` |
| **Spatial Querying** | PostGIS `ST_DWithin` & Haversine | **ACTIVE (`spatial_service.py`)** | Spatial queries calculate 500m, 1km, 2km, and custom admin radii |

---

## 3. Emergency Notification Services & Demo Mode

| Channel | Provider | Configuration Variables | Demo Mode Behavior |
| :--- | :--- | :--- | :--- |
| **Push Notifications** | Firebase Cloud Messaging (FCM) | `FCM_PROJECT_ID`, `FCM_CREDENTIALS` | Logs simulated FCM push payloads when credentials are unconfigured |
| **SMS Emergency Broadcast** | Twilio SMS API | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Logs simulated SMS dispatch when credentials are unconfigured |
| **Email Dispatch** | SendGrid v3 Mail API | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` | Logs simulated Email dispatch when credentials are unconfigured |

### Notification Lifecycle States
All emergency alerts follow an explicit state lifecycle:
$$\text{QUEUED} \longrightarrow \text{SENT} \longrightarrow \text{DELIVERED} \longrightarrow \text{READ} \longrightarrow \text{ACKNOWLEDGED}$$

In **Demo Mode**, the backend generates realistic state progression while clearly labeling all alerts with `DEMO MODE / BETA SIMULATION` to prevent false emergency claims.

---

## 4. User Privacy & Safety Rules

1. **Opt-in Enforcement**: Only users with `notification_opt_in = True` are included in public risk radius alerts.
2. **Contact Masking**: Personal phone numbers and email addresses are masked (`+91 98250 XXX23`) in public UI views to protect user privacy.
3. **Admin Alert Authorization**: Alert dispatch requires explicit admin/operator authorization (`POST /api/incidents/{id}/alerts/authorize`). Accidental map clicks will not trigger public alerts.
