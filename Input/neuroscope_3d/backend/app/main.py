"""
FastAPI application entrypoint for NeuroScope 3D.
Provides NIfTI upload & validation API, segmentation routing, health checks,
and serves the React web interface.
"""

import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import segmentation, upload
from app.core.exceptions import NIfTIValidationError

app = FastAPI(
    title="NeuroScope 3D — NIfTI Upload & Validation Module",
    description="Medical imaging upload, multi-sequence validation, and BraTS 2021 segmentation interface.",
    version="1.0.0",
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


@app.exception_handler(NIfTIValidationError)
async def nifti_validation_exception_handler(request: Request, exc: NIfTIValidationError):
    """Centralized handler for custom NIfTI validation errors."""
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict(),
    )


# Include API routers
app.include_router(upload.router)
app.include_router(segmentation.router)

# Paths for frontend web app
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
FRONTEND_INDEX = FRONTEND_DIST / "index.html"


@app.get("/health", tags=["System"])
@app.get("/api/health", tags=["System"])
async def health_check():
    """Health check endpoint verifying backend service status."""
    return {
        "status": "healthy",
        "service": "NeuroScope 3D",
        "version": "1.0.0",
        "validation_engine": "active",
        "ready_for_uploads": True,
    }


if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")


@app.get("/", response_class=HTMLResponse, tags=["Web Interface"])
async def serve_root():
    """Serve the interactive web frontend at root URL."""
    if FRONTEND_INDEX.exists():
        return FileResponse(str(FRONTEND_INDEX))

    fallback_index = PROJECT_ROOT / "frontend" / "index.html"
    if fallback_index.exists():
        return FileResponse(str(fallback_index))

    return HTMLResponse(
        """
        <!DOCTYPE html>
        <html>
        <head><title>NeuroScope 3D</title></head>
        <body style="font-family:sans-serif;background:#0b0f19;color:#f9fafb;padding:2rem;">
            <h1>NeuroScope 3D API is Running</h1>
            <p>Interactive API documentation is available at <a href="/docs" style="color:#06b6d4;">/docs</a>.</p>
        </body>
        </html>
        """
    )
