"""
ml_pipeline.py — Desktop ML Pipeline Orchestrator

Manages a job queue and runs the full processing pipeline in a
background thread so the FastAPI server stays responsive.

Pipeline Steps:
    1. Validate inputs (video codec, CSV columns)
    2. Extract frames + YOLO inference (video_processor)
    3. IRI computation (existing iri_calculator_logic.py)
    4. Write results to SQLite (UploadModel + PotholeImageModel)
    5. Update job status to 'done' or 'failed'
"""

import json
import logging
import shutil
import threading
import time
import traceback
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger("express-ai-desktop.ml_pipeline")

# ── Job store (in-memory, survives the session) ────────────────────────────
# { job_id: { status, progress, error, name, created_at, upload_ids } }
_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()


# ── Public helpers ─────────────────────────────────────────────────────────

def get_job(job_id: str) -> Optional[dict]:
    with _jobs_lock:
        return dict(_jobs[job_id]) if job_id in _jobs else None


def list_jobs() -> list[dict]:
    with _jobs_lock:
        return [dict(j) for j in reversed(list(_jobs.values()))]


def cancel_job(job_id: str) -> bool:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            return False
        if job["status"] in ("done", "failed", "cancelled"):
            return False
        job["status"] = "cancelled"
        return True


# ── Main entry point ───────────────────────────────────────────────────────

def start_pipeline(
    video_path: str | Path,
    csv_path: str | Path,
    job_name: str,
    db_session_factory,
    storage_dir: str | Path,
    task: str = "pothole_detect",
    model_name: str = "pothole_detection",
) -> str:
    """
    Enqueue a new pipeline job and start it in a background thread.
    Returns the job_id immediately.
    """
    job_id = str(uuid.uuid4())
    job = {
        "job_id": job_id,
        "name": job_name,
        "task": task,
        "model": model_name,
        "status": "queued",
        "progress": 0,
        "error": None,
        "created_at": datetime.utcnow().isoformat(),
        "upload_ids": [],
        "potholes": 0,
        "cracks": 0,
        "iri_segments": 0,
    }
    with _jobs_lock:
        _jobs[job_id] = job

    thread = threading.Thread(
        target=_run_pipeline,
        args=(job_id, job_name, Path(video_path), Path(csv_path), db_session_factory,
              Path(storage_dir), task, model_name),
        daemon=True,
        name=f"pipeline-{job_id[:8]}",
    )
    thread.start()
    logger.info(f"Pipeline job {job_id} [{task}/{model_name}] started for '{job_name}'")
    return job_id


# ── Internal pipeline runner ───────────────────────────────────────────────

def _update(job_id: str, **kwargs):
    with _jobs_lock:
        if job_id in _jobs:
            _jobs[job_id].update(kwargs)


def _run_pipeline(
    job_id: str,
    job_name: str,
    video_path: Path,
    csv_path: Path,
    db_session_factory,
    storage_dir: Path,
    task: str = "pothole_detect",
    model_name: str = "pothole_detection",
):
    try:
        _update(job_id, status="processing", progress=2)
        logger.info(f"[{job_id}] Starting pipeline: {video_path.name}")

        # Check for cancellation
        def _check_cancel():
            with _jobs_lock:
                return _jobs.get(job_id, {}).get("status") == "cancelled"

        # ── Step 1: Validate ────────────────────────────────────────────────
        _update(job_id, progress=5)
        _validate_inputs(video_path, csv_path)

        # ── Step 2: GPS Syncer ─────────────────────────────────────────────
        _update(job_id, progress=8)
        from gps_sync import GPSSyncer
        gps = GPSSyncer(csv_path)

        if _check_cancel(): return

        # ── Step 3: Video Processing (task-specific branch) ──────────────────
        frames_dir = storage_dir / "pothole" / job_id
        frames_dir.mkdir(parents=True, exist_ok=True)

        from video_processor import process_video, write_detections_csv

        def on_video_progress(p: float):
            _update(job_id, progress=int(8 + p * 52))  # 8% → 60%

        detections = process_video(
            video_path=video_path,
            output_dir=frames_dir,
            gps_syncer=gps,
            model_name=model_name,
            task=task,
            progress_callback=on_video_progress,
        )

        if _check_cancel(): return

        # ── Step 4: Write detections CSV ───────────────────────────────────
        _update(job_id, progress=62)
        det_csv_path = frames_dir / "detections.csv"
        write_detections_csv(detections, det_csv_path)

        potholes = sum(1 for d in detections if "pothole" in d.get("class_name", "").lower())
        cracks = sum(1 for d in detections if "crack" in d.get("class_name", "").lower())
        _update(job_id, potholes=potholes, cracks=cracks)

        # ── Step 5: IRI Computation ────────────────────────────────────────
        _update(job_id, progress=65)
        iri_results = _run_iri(csv_path, job_id)

        if _check_cancel(): return

        # ── Step 6: Write to SQLite DB ─────────────────────────────────────
        _update(job_id, progress=80)
        upload_ids = _write_to_db(
            detections=detections,
            det_csv_path=det_csv_path,
            iri_results=iri_results,
            frames_dir=frames_dir,
            job_id=job_id,
            job_name=job_name,
            db_session_factory=db_session_factory,
        )

        _update(
            job_id,
            status="done",
            progress=100,
            upload_ids=upload_ids,
            iri_segments=len(iri_results) if iri_results else 0,
        )
        logger.info(f"[{job_id}] Pipeline complete — {potholes} potholes, {cracks} cracks")

    except Exception as e:
        err = traceback.format_exc()
        logger.error(f"[{job_id}] Pipeline failed: {err}")
        _update(job_id, status="failed", error=str(e))


# ── Helpers ────────────────────────────────────────────────────────────────

def job_name_from_video(video_path: Path) -> str:
    return video_path.stem.replace("_", " ").replace("-", " ").title()


def _validate_inputs(video_path: Path, csv_path: Path):
    if not video_path.exists():
        raise FileNotFoundError(f"Video not found: {video_path}")
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")
    if video_path.suffix.lower() not in {".mp4", ".avi", ".mov", ".mkv"}:
        raise ValueError(f"Unsupported video format: {video_path.suffix}")

    import pandas as pd
    df = pd.read_csv(csv_path, nrows=2)
    required = {"time", "ax", "ay", "az", "latitude", "longitude"}
    missing = required - {c.lower() for c in df.columns}
    if missing:
        raise ValueError(f"GPS CSV missing required columns: {missing}")


def _run_iri(csv_path: Path, job_id: str) -> list[dict]:
    """Run the existing IRICalculator and return list of segment dicts."""
    try:
        import sys
        from pathlib import Path as P
        # server/ is already on sys.path via desktop_main.py
        from services.iri_calculator_logic import IRICalculator

        calc = IRICalculator()
        df = calc.load_data(str(csv_path))
        if df is None:
            return []
        result = calc.preprocess_data(df)
        if result is None:
            return []
        processed_df, _ = result
        iri_values, segments, _, _ = calc.calculate_iri_rms_method(processed_df)

        segment_list = []
        for i, (iri, seg) in enumerate(zip(iri_values, segments)):
            start_lat, start_lon, end_lat, end_lon = None, None, None, None
            
            start_idx = seg.get('start_index')
            end_idx = seg.get('end_index')
            
            if start_idx is not None and end_idx is not None:
                if start_idx < len(processed_df) and 'latitude' in processed_df.columns:
                    try:
                        start_lat = float(processed_df.iloc[start_idx]['latitude'])
                        start_lon = float(processed_df.iloc[start_idx]['longitude'])
                    except: pass
                
                actual_end_idx = end_idx - 1
                if 0 <= actual_end_idx < len(processed_df) and 'latitude' in processed_df.columns:
                    try:
                        end_lat = float(processed_df.iloc[actual_end_idx]['latitude'])
                        end_lon = float(processed_df.iloc[actual_end_idx]['longitude'])
                    except: pass

            segment_list.append({
                "segment_id": i + 1,
                "distance_start": seg["distance_start"],
                "distance_end": seg["distance_end"],
                "segment_length": seg["length"],
                "iri_value": iri,
                "mean_speed": seg["mean_speed"],
                "rms_accel": seg["rms_accel"],
                "speed_flag": seg.get("speed_flag", "normal"),
                "start_lat": start_lat,
                "start_lon": start_lon,
                "end_lat": end_lat,
                "end_lon": end_lon,
            })
        logger.info(f"[{job_id}] IRI: {len(segment_list)} segments computed")
        return segment_list
    except Exception as e:
        logger.warning(f"[{job_id}] IRI computation skipped: {e}")
        return []


def _write_to_db(
    detections: list[dict],
    det_csv_path: Path,
    iri_results: list[dict],
    frames_dir: Path,
    job_id: str,
    job_name: str,
    db_session_factory,
) -> list[int]:
    """Write UploadModel + PotholeImageModel rows. Returns list of upload IDs."""
    from models.upload import UploadModel, PotholeImageModel
    from datetime import datetime

    db = db_session_factory()
    upload_ids = []

    try:
        # ── Pothole upload record ──────────────────────────────────────────
        pot_upload = UploadModel(
            user_id=1,         # desktop superuser is always id=1
            filename=det_csv_path.name,
            original_filename=det_csv_path.name,
            file_type="csv",
            category="pothole",
            storage_path=str(det_csv_path),
            file_size=det_csv_path.stat().st_size,
            cached_data=json.dumps({}),   # patched after flush with real upload_id
            upload_date=datetime.utcnow(),
        )
        db.add(pot_upload)
        db.flush()   # get pot_upload.id so we can patch cached_data

        # Now build cache with the real upload_id
        cache_payload = _build_pothole_cache(detections, job_name, frames_dir, pot_upload.id)
        pot_upload.cached_data = json.dumps(cache_payload)

        # ── PotholeImageModel rows (one per detection) ─────────────────────
        for det in detections:
            img_path = frames_dir / det["image_path"]
            if img_path.exists():
                db.add(PotholeImageModel(
                    upload_id=pot_upload.id,
                    image_path=str(img_path),
                    frame_number=det["frame_number"],
                    detection_confidence=det["confidence_score"],
                ))
        upload_ids.append(pot_upload.id)

        # ── IRI upload record ──────────────────────────────────────────────
        if iri_results:
            iri_csv_path = frames_dir.parent / f"iri_{job_id}.json"
            iri_csv_path.write_text(json.dumps(iri_results))
            iri_upload = UploadModel(
                user_id=1,
                filename=iri_csv_path.name,
                original_filename=iri_csv_path.name,
                file_type="json",
                category="iri",
                storage_path=str(iri_csv_path),
                file_size=iri_csv_path.stat().st_size,
                cached_data=json.dumps({
                    "success": True,
                    "message": "Computed via desktop pipeline",
                    "total_segments": len(iri_results),
                    "segments": iri_results
                }),
                upload_date=datetime.utcnow(),
            )
            db.add(iri_upload)
            db.flush()
            upload_ids.append(iri_upload.id)

        db.commit()
        logger.info(f"[{job_id}] DB write complete — upload IDs: {upload_ids}")
        return upload_ids

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _build_pothole_cache(detections: list[dict], job_name: str, frames_dir: Path, upload_id: int = None) -> dict:
    """
    Build the cached_data JSON that the Dashboard reads to render markers.
    upload_id must be set — markers with upload_id=None are ignored by the Dashboard.
    """
    markers = []
    for det in detections:
        if det["confidence_score"] < 0.01:
            continue
            
        # Ensure the desktop app can fetch the local image via the proxy
        storage_path = str(frames_dir / det["image_path"])
        
        markers.append({
            "latitude": det["latitude"],
            "longitude": det["longitude"],
            "confidence": det["confidence_score"],
            "image_path": det["image_path"],
            "image_url": f"/api/v1/pothole/proxy?key={storage_path}",
            "storage_path": storage_path,
            "frame_number": det["frame_number"],
            "class_name": det.get("class_name", "pothole"),
            "area_m2": det.get("area_m2"),
            "repair_cost": det.get("repair_cost", 0),
            "severity": det.get("severity", "low"),
            "length_m": det.get("length_m"),
            "source": f"Desktop ML Pipeline — {job_name}",
            "measurement": det.get("length_m", 0.0),
            "upload_id": upload_id,
        })
        
        # Add a rich popup HTML formatted for Desktop mapping
        category_title = "🚧 Pothole Detection" if "pothole" in job_name.lower() else "📉 Crack Detection"
        cost_display = f"₱{int(det.get('repair_cost') or 0):,}"
        img_url = markers[-1]["image_url"]
        conf_pct = det["confidence_score"] * 100
        area = det.get("area_m2") or 0.0
        
        markers[-1]["popup_html"] = f"""
        <div style="text-align: center; min-width: 250px; font-family: Arial, sans-serif;">
            <h4 style="margin: 0 0 10px 0; color: #dc2626; border-bottom: 2px solid #fee2e2; padding-bottom: 5px;">{category_title}</h4>
            <p style="margin: 5px 0;"><strong>Confidence:</strong> {conf_pct:.1f}%</p>
            
            <div style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
                <a href="{img_url}" target="_blank">
                    <img src="{img_url}" 
                         style="width: 200px; height: auto; border-radius: 6px; cursor: pointer;" 
                         onerror="this.style.display='none'; this.parentElement.nextElementSibling.style.display='block';"
                         alt="Detection Image">
                </a>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; text-align: left;">
                 <div style="background: #f9fafb; padding: 4px; border-radius: 4px;">
                    <div style="color: #6b7280; font-size: 10px; text-transform: uppercase;">Est. Area</div>
                    <div style="font-weight: bold; color: #1f2937;">{area:.2f} m²</div>
                </div>
                <div style="background: #fffbe6; padding: 4px; border-radius: 4px; border: 1px solid #fef3c7;">
                    <div style="color: #b45309; font-size: 10px; text-transform: uppercase;">Repair Cost</div>
                    <div style="font-weight: bold; color: #92400e;">{cost_display}</div>
                </div>
            </div>
        </div>
        """

    return {"data": markers, "total": len(markers), "source": "desktop_pipeline"}
