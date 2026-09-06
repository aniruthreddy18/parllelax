"""
Vercel serverless entry point.

Vercel's Python runtime looks for an ASGI app named `app` in this module, so
this simply re-exports the FastAPI application from `backend/`.
"""
import sys
from pathlib import Path

# `backend/` is not a package root on Vercel, so put it on the import path.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.main import app  # noqa: E402  (path must be set before this import)

__all__ = ["app"]
