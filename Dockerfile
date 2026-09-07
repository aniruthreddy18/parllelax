# Parallax as a single container: the frontend is built with Node, then served
# by the same FastAPI process that answers /api. One image, one port, no
# serverless caveats — deployable on Render, Railway, Fly.io or any host that
# runs containers.

# ---- build the frontend ----------------------------------------------------
FROM node:22-slim AS web
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm --prefix frontend ci
COPY frontend ./frontend
RUN npm --prefix frontend run build

# ---- run the API, serving the built frontend -------------------------------
FROM python:3.12-slim
WORKDIR /app

# Install Python deps first so the layer caches across code changes.
# The root requirements.txt is the lean runtime set — backend/requirements.txt
# also carries SQLAlchemy, psycopg2, asyncpg and geoalchemy2, none of which are
# imported at runtime (models.py is unused) and which only bloat the image.
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt "uvicorn[standard]>=0.28.0"

COPY backend ./backend
# main.py serves ../frontend/dist relative to itself, so the built assets must
# land at /app/frontend/dist.
COPY --from=web /build/frontend/dist ./frontend/dist

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

# Hosts inject the port; default to 8000 for local runs.
CMD ["sh", "-c", "cd backend && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
