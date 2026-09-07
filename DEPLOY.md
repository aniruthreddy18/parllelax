# Deploying Parallax

The frontend and backend are two languages but **one application**. For
deployment there is no reason to run two servers: the frontend compiles to
static files and FastAPI serves them, so everything is a single process on a
single port.

Verified locally:

```bash
npm run build && npm start     # whole app on http://127.0.0.1:8000
```

---

## Option A — Render / Railway / Fly.io (recommended)

One container, one service, nothing to connect. `Dockerfile` builds the
frontend with Node and serves it from the Python image.

**Render**

1. New → Web Service → connect this repository.
2. Runtime: **Docker** (it will pick up `render.yaml` and `Dockerfile`).
3. Deploy. That is all — no root-directory juggling.

**Railway / Fly.io** — point them at the `Dockerfile`; no other config needed.

Why this is the easier path: the process stays warm, so the OSM cache and the
spatial index are built once rather than on every cold start, and long
OpenStreetMap lookups are not competing with a function timeout.

---

## Option B — Vercel

Vercel works, but it must be **one project, not two**.

### If it is showing frontend and backend separately

That happens when the project's **Root Directory** is set to `frontend` (or
`backend`). `vercel.json` is only read from the Root Directory, so a project
rooted at `frontend/` never sees it — Vercel just builds the Vite app, and the
API needs a second project.

**Fix, in the Vercel dashboard:**

1. Delete the extra project (keep one).
2. Open the remaining project → **Settings → General → Root Directory**.
3. Set it to the **repository root** — leave the field empty, or `./`.
   It must *not* be `frontend`.
4. **Settings → Git → Redeploy**.

With the root correct, `vercel.json` takes over and builds both halves into one
deployment:

| Path | Served by |
|---|---|
| `/api/*` | `api/index.py` → the FastAPI app |
| everything else | `frontend/dist`, falling back to `index.html` |

### Vercel specifics already handled

- `maxDuration: 300` — uncached areas need a live Overpass query, which can
  take up to a minute.
- `FIREWATCH_CACHE_DIR=/tmp/osm_cache` — serverless filesystems are read-only
  apart from `/tmp`. The bundled cache stays readable; newly fetched areas go
  to `/tmp` and last as long as the warm instance.
- Root `requirements.txt` is the lean runtime set. SQLAlchemy, psycopg2,
  asyncpg and geoalchemy2 are omitted — `models.py` is never imported, and they
  would only inflate the bundle and cold start.

### Known caveats

- Cold starts re-read the 8.9 MB cache and rebuild the spatial index. Measured
  at **0.51s**, so acceptable, but it is paid per cold start.
- `/tmp` does not persist between instances, so live-fetched areas are
  effectively per-instance. The committed cache is unaffected.
- **This Vercel path is unverified.** It follows the documented format and the
  entry point imports cleanly, but no real Vercel deploy has been run against
  it. Option A has been verified locally end to end.

---

## Caching more regions

Anywhere already cached classifies instantly and offline; anywhere else needs a
live OpenStreetMap query, which can take 10–60s. Cache the areas you intend to
demo:

```bash
cd backend && .venv/bin/python scripts/prewarm.py --city mumbai
```

Commit the result and it ships with the deployment.
