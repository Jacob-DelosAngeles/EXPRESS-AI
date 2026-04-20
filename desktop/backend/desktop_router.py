"""
desktop_router.py — Desktop-Only FastAPI Router

Exposes 4 endpoints for the ML pipeline, only mounted when
DEPLOYMENT_MODE=desktop (set by Electron in desktop_main.py).

Endpoints:
    POST   /api/v1/desktop/process          Start a pipeline job
    GET    /api/v1/desktop/status/{job_id}  Poll job progress
    GET    /api/v1/desktop/jobs             List all past jobs
    DELETE /api/v1/desktop/cancel/{job_id}  Cancel a running job
"""

import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from core.database import get_db
import ml_pipeline as pipeline

logger = logging.getLogger("express-ai-desktop.desktop_router")
router = APIRouter(prefix="/api/v1/desktop", tags=["desktop-pipeline"])

# ── Resolve the desktop storage directory ─────────────────────────────────
def _get_storage_dir() -> Path:
    """
    Returns the path where pipeline outputs (frames, CSVs) are stored.
    In production, this is the same desktop data dir used by LocalStorageService.
    In dev, it falls back to a 'desktop_data' folder next to the project root.
    """
    env_dir = os.environ.get("DESKTOP_STORAGE_DIR")
    if env_dir:
        return Path(env_dir)
    # Fallback: use the server's local uploads/ dir in dev mode
    return Path(__file__).resolve().parent.parent.parent / "server" / "uploads"


STORAGE_DIR = _get_storage_dir()


# ── POST /api/v1/desktop/process ────────────────────────────────────────────
@router.post("/process")
def start_process(
    video: Optional[UploadFile] = File(None, description="Dashcam video upload"),
    gps_csv: Optional[UploadFile] = File(None, description="GPS+Sensor CSV upload"),
    video_path_str: Optional[str] = Form(None, description="Absolute path on disk"),
    csv_path_str: Optional[str] = Form(None, description="Absolute path on disk"),
    job_name: Optional[str] = Form(None),
    task: Optional[str] = Form("pothole_detect"),
    model_name: Optional[str] = Form("pothole_detection"),
    db: Session = Depends(get_db),
):
    """
    Accept a video + GPS CSV (via upload or direct disk path) and start the ML pipeline.
    """
    if video_path_str and csv_path_str:
        # Zero-copy fast path (Electron provides absolute paths)
        video_path = Path(video_path_str)
        csv_path = Path(csv_path_str)
        video_filename = video_path.name
    else:
        # Fallback HTTP upload path
        if not video or not gps_csv:
            raise HTTPException(400, "Both video and gps_csv files are required if paths are not provided.")
        
        video_filename = video.filename
        tmp_dir = Path(tempfile.mkdtemp(prefix="express_pipeline_"))
        video_path = tmp_dir / video_filename
        csv_path = tmp_dir / gps_csv.filename
        
        try:
            with open(video_path, "wb") as f:
                shutil.copyfileobj(video.file, f)
            with open(csv_path, "wb") as f:
                shutil.copyfileobj(gps_csv.file, f)
        except Exception as e:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            raise HTTPException(500, f"Failed to save uploaded files: {e}")

    video_ext = video_path.suffix.lower()
    if video_ext not in {".mp4", ".avi", ".mov", ".mkv"}:
        raise HTTPException(400, f"Unsupported video format: {video_ext}")

    resolved_job_name = job_name or video_path.stem.replace("_", " ").title()
    resolved_task = task or "pothole_detect"
    resolved_model = model_name or "pothole_detection"

    from core.database import SessionLocal
    def db_factory():
        return SessionLocal()

    job_id = pipeline.start_pipeline(
        video_path=video_path,
        csv_path=csv_path,
        job_name=resolved_job_name,
        db_session_factory=db_factory,
        storage_dir=STORAGE_DIR,
        task=resolved_task,
        model_name=resolved_model,
    )

    logger.info(f"Job {job_id} enqueued: {resolved_job_name} [{resolved_task}/{resolved_model}]")
    return {
        "job_id": job_id,
        "status": "queued",
        "name": resolved_job_name,
        "task": resolved_task,
        "model": resolved_model,
    }


# ── GET /api/v1/desktop/status/{job_id} ───────────────────────────────────
@router.get("/status/{job_id}")
def get_status(job_id: str):
    """Poll the status and progress of a running or completed job."""
    job = pipeline.get_job(job_id)
    if not job:
        raise HTTPException(404, f"Job not found: {job_id}")
    return {
        "job_id": job["job_id"],
        "name": job["name"],
        "status": job["status"],        # queued | processing | done | failed | cancelled
        "progress": job["progress"],    # 0–100
        "error": job.get("error"),
        "potholes": job.get("potholes", 0),
        "cracks": job.get("cracks", 0),
        "iri_segments": job.get("iri_segments", 0),
        "upload_ids": job.get("upload_ids", []),
        "created_at": job.get("created_at"),
    }


# ── GET /api/v1/desktop/jobs ───────────────────────────────────────────────
@router.get("/jobs")
def get_jobs():
    """Return a list of all pipeline jobs (most recent first)."""
    jobs = pipeline.list_jobs()
    return {
        "total": len(jobs),
        "jobs": [
            {
                "job_id": j["job_id"],
                "name": j["name"],
                "status": j["status"],
                "progress": j["progress"],
                "potholes": j.get("potholes", 0),
                "cracks": j.get("cracks", 0),
                "iri_segments": j.get("iri_segments", 0),
                "created_at": j.get("created_at"),
            }
            for j in jobs
        ],
    }


# ── DELETE /api/v1/desktop/cancel/{job_id} ────────────────────────────────
@router.delete("/cancel/{job_id}")
def cancel_job(job_id: str):
    """Request cancellation of a running job."""
    success = pipeline.cancel_job(job_id)
    if not success:
        job = pipeline.get_job(job_id)
        if not job:
            raise HTTPException(404, f"Job not found: {job_id}")
        raise HTTPException(400, f"Job cannot be cancelled (status: {job['status']})")
    return {"success": True, "job_id": job_id, "status": "cancelled"}


# ── GET /api/v1/desktop/models ────────────────────────────────────────────
@router.get("/models")
def get_models():
    """Return which YOLO model files are available on disk."""
    from model_manager import list_available_models, is_model_available
    available = list_available_models()
    return {
        "available": available,
        # Per-model readiness checks
        "pothole_detection_ready":    is_model_available("pothole_detection"),
        "pothole_segmentation_ready": is_model_available("pothole_segmentation"),
        "cracks_segmentation_ready":  is_model_available("cracks_segmentation"),
        "road_classification_ready":  is_model_available("road_classification"),
        "traffic_ready":              is_model_available("traffic"),
        "sam2_ready":                 is_model_available("sam2_hiera_small"),
    }
