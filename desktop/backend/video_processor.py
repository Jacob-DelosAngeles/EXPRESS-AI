"""
video_processor.py — Task-Specific Video Processing Engine (v2)

Supports 4 distinct pipeline branches matching production notebook behaviour:

  1. pothole_detect  → YOLOv8 detect + ByteTrack → bbox + confidence
  2. pothole_seg     → YOLOv8 seg + SAM 2 optional → mask → area_m2
  3. crack_seg       → YOLOv8 seg → skeleton → length_m
  4. road_classify   → YOLOv8 cls every N frames → pavement type per GPS point
  5. traffic         → YOLOv8s (stock/fine-tuned) → DeepSORT → vehicle counts

Outputs a list of detection dicts that ml_pipeline.py writes to SQLite.

All measurement maths (IPM, skeletonize) ported directly from the Colab notebooks.
"""

import csv
import logging
import math
import os
import sys
import uuid
from pathlib import Path
from typing import Callable, Optional

import cv2
import numpy as np

logger = logging.getLogger("express-ai-desktop.video_processor")

# ── Vehicle classes (traffic task) ──────────────────────────────────────────
ALLOWED_VEHICLE_CLASSES = {"car", "motorcycle", "bus", "truck", "bicycle"}

# ── IPM camera defaults (overridable via pipeline config) ───────────────────
DEFAULT_CAM_HEIGHT_M = 1.2
DEFAULT_PITCH_DEG = 15.0
DEFAULT_FOV_DEG = 70.0

# ── Sanity limits (from notebook) ────────────────────────────────────────────
MAX_CRACK_LENGTH_M = 3.0
MAX_POTHOLE_AREA_M2 = 1.5


# ════════════════════════════════════════════════════════════════════════════
# Public dispatch function
# ════════════════════════════════════════════════════════════════════════════

def process_video(
    video_path: str | Path,
    output_dir: str | Path,
    gps_syncer,
    model_name: str = "pothole_detection",
    task: str = "pothole_detect",
    frame_interval_sec: float = 1.0,
    confidence_threshold: float = 0.25,
    progress_callback: Optional[Callable[[float], None]] = None,
) -> list[dict]:
    """
    Main dispatch: routes to the correct pipeline branch based on `task`.

    task values:
        pothole_detect   → _run_detection_pipeline()
        pothole_seg      → _run_segmentation_pipeline("Potholes")
        crack_seg        → _run_segmentation_pipeline("Cracks")
        road_classify    → _run_classification_pipeline()
        traffic          → _run_traffic_pipeline()
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    dispatch = {
        "pothole_detect": lambda: _run_detection_pipeline(
            video_path, output_dir, gps_syncer, model_name, task,
            frame_interval_sec, confidence_threshold, progress_callback),
        "pothole_seg": lambda: _run_segmentation_pipeline(
            video_path, output_dir, gps_syncer, model_name, "Potholes",
            frame_interval_sec, confidence_threshold, progress_callback),
        "crack_seg": lambda: _run_segmentation_pipeline(
            video_path, output_dir, gps_syncer, model_name, "Cracks",
            frame_interval_sec, confidence_threshold, progress_callback),
        "road_classify": lambda: _run_classification_pipeline(
            video_path, output_dir, gps_syncer, model_name,
            frame_skip=5, confidence_threshold=confidence_threshold,
            progress_callback=progress_callback),
        "traffic": lambda: _run_traffic_pipeline(
            video_path, output_dir, gps_syncer, model_name,
            frame_interval_sec, confidence_threshold, progress_callback),
    }

    fn = dispatch.get(task)
    if fn is None:
        raise ValueError(f"Unknown task: {task!r}. Valid: {list(dispatch)}")
    return fn()


# ════════════════════════════════════════════════════════════════════════════
# Branch 1 — Detection (pothole_detection.pt)
# ════════════════════════════════════════════════════════════════════════════

def _run_detection_pipeline(
    video_path, output_dir, gps_syncer, model_name, task,
    frame_interval_sec, confidence_threshold, progress_callback,
) -> list[dict]:
    """
    Detection pipeline using predict() per sampled frame.
    Uses model.predict() instead of model.track() — track() requires ByteTrack warmup
    and silently returns boxes_res.id=None on the first many frames on CPU.
    """
    from model_manager import load_model
    model = load_model(model_name)

    if model is None:
        logger.error(
            f"[detect] CRITICAL: model '{model_name}' not loaded. "
            f"Check that desktop/models/{model_name}.pt exists."
        )
        return []

    logger.info(f"[detect] Model '{model_name}' ready. Video: {Path(video_path).name}")
    logger.info(f"[detect] conf={confidence_threshold}  interval={frame_interval_sec}s")

    cap, fps, total_frames, frame_step = _open_video(video_path, frame_interval_sec)
    detections = []
    frames_processed = 0
    total_boxes_seen = 0
    frame_idx = 0

    try:
        while True:
            ret = cap.grab()
            if not ret:
                break

            if frame_idx % frame_step != 0:
                frame_idx += 1
                continue

            ret, frame = cap.retrieve()
            if not ret:
                frame_idx += 1
                continue

            frames_processed += 1
            timestamp_sec = frame_idx / fps
            lat, lon, spd = gps_syncer.interpolate(timestamp_sec)

            # ── Inference: predict per sampled frame ─────────────────────
            results = model.predict(frame, conf=confidence_threshold, verbose=False)
            boxes_res = results[0].boxes if results else None

            if boxes_res is not None and len(boxes_res) > 0:
                total_boxes_seen += len(boxes_res)
                best_idx = int(boxes_res.conf.argmax())
                box = boxes_res.xyxy[best_idx].cpu().numpy()
                conf = float(boxes_res.conf[best_idx])
                cls_id = int(boxes_res.cls[best_idx].item())
                cls_name = model.names.get(cls_id, "pothole")
                if cls_name.isdigit():
                    cls_name = "pothole" if "pothole" in task else "crack"

                img_filename = f"det_f{frame_idx}_c{int(conf*100)}.jpg"
                img_path = output_dir / img_filename
                x1, y1, x2, y2 = map(int, box)
                annotated = frame.copy()
                cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 0, 255), 3)
                cv2.putText(annotated, f"{cls_name} {conf:.2f}",
                            (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                cv2.imwrite(str(img_path), annotated)

                detections.append({
                    "frame_number": frame_idx,
                    "timestamp_sec": round(timestamp_sec, 3),
                    "latitude": round(lat, 7),
                    "longitude": round(lon, 7),
                    "speed": round(spd, 3),
                    "confidence_score": round(conf, 4),
                    "image_path": img_filename,
                    "class_name": cls_name,
                    "area_m2": None,
                    "length_m": None,
                })

            if progress_callback and total_frames > 0:
                progress_callback(min(0.58, (frame_idx / total_frames) * 0.58))
            frame_idx += 1

    finally:
        cap.release()

    logger.info(
        f"[detect] COMPLETE — frames_processed={frames_processed} | "
        f"boxes_seen={total_boxes_seen} | detections={len(detections)}"
    )
    if frames_processed > 0 and total_boxes_seen == 0:
        logger.warning(
            f"[detect] Zero detections. Possible causes: "
            f"no potholes visible, confidence threshold too high ({confidence_threshold}), "
            f"or wrong model for this video type."
        )
    return detections


# ════════════════════════════════════════════════════════════════════════════
# Branch 2 & 3 — Segmentation (pothole_seg / crack_seg)
# ════════════════════════════════════════════════════════════════════════════

def _run_segmentation_pipeline(
    video_path, output_dir, gps_syncer, model_name, task_type,
    frame_interval_sec, confidence_threshold, progress_callback,
) -> list[dict]:
    """
    YOLOv8 segmentation with optional SAM 2 refinement.
    task_type: "Potholes" → area_m2   |   "Cracks" → length_m
    """
    from model_manager import load_model, is_model_available
    model = load_model(model_name)

    # Try to load SAM 2 if available
    sam_predictor = _try_load_sam2()

    cap, fps, total_frames, frame_step = _open_video(video_path, frame_interval_sec)
    h_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    detections = []
    frame_idx = 0

    try:
        while True:
            ret = cap.grab()
            if not ret:
                break
            if frame_idx % frame_step != 0:
                frame_idx += 1
                continue
            ret, frame = cap.retrieve()
            if not ret:
                frame_idx += 1
                continue

            timestamp_sec = frame_idx / fps
            lat, lon, spd = gps_syncer.interpolate(timestamp_sec)

            if model is not None:
                results = model(frame, conf=confidence_threshold, verbose=False)
                res = results[0]

                if res.masks is not None and len(res.masks) > 0:
                    best_conf_idx = int(res.boxes.conf.argmax())
                    conf = float(res.boxes.conf[best_conf_idx])
                    box = res.boxes.xyxy[best_conf_idx].cpu().numpy()
                    cls_name = model.names.get(int(res.boxes.cls[best_conf_idx]), task_type.lower())

                    # Get mask — prefer SAM 2, fallback to YOLO mask
                    mask = _get_best_mask(res, best_conf_idx, frame, box, sam_predictor)

                    # Measurement
                    measurement, annotated_frame = _measure_defect(
                        mask, frame, box, h_w, h_h, task_type
                    )

                    # Save annotated frame
                    img_filename = f"seg_{task_type.lower()}_f{frame_idx}_{uuid.uuid4().hex[:5]}.jpg"
                    cv2.imwrite(str(output_dir / img_filename), annotated_frame)

                    det = {
                        "frame_number": frame_idx,
                        "timestamp_sec": round(timestamp_sec, 3),
                        "latitude": round(lat, 7),
                        "longitude": round(lon, 7),
                        "speed": round(spd, 3),
                        "confidence_score": round(conf, 4),
                        "image_path": img_filename,
                        "class_name": cls_name,
                        "area_m2": None,
                        "length_m": None,
                    }
                    if task_type == "Potholes":
                        det["area_m2"] = round(min(measurement, MAX_POTHOLE_AREA_M2), 4)
                    else:
                        det["length_m"] = round(min(measurement, MAX_CRACK_LENGTH_M), 4)

                    detections.append(det)

            if progress_callback and total_frames > 0:
                progress_callback(min(0.58, (frame_idx / total_frames) * 0.58))
            frame_idx += 1
    finally:
        cap.release()

    logger.info(f"[seg/{task_type}] {len(detections)} segmented detections")
    return detections


# ════════════════════════════════════════════════════════════════════════════
# Branch 4 — Road Classification
# ════════════════════════════════════════════════════════════════════════════

def _run_classification_pipeline(
    video_path, output_dir, gps_syncer, model_name,
    frame_skip=5, confidence_threshold=0.25, progress_callback=None,
) -> list[dict]:
    """
    YOLOv8 classification task.
    Outputs: latitude, longitude, pavement_type per GPS point.
    Matches pavement_data.csv format from Production_Notebook_Road_Classification.
    """
    from model_manager import load_model
    model = load_model(model_name)

    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    records = []
    frame_idx = 0

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % frame_skip == 0:
                lat, lon, spd = gps_syncer.interpolate(frame_idx / fps)

                pavement_type = "Unknown"
                if model is not None:
                    res = model.predict(frame, verbose=False, imgsz=640)[0]
                    top1_idx = res.probs.top1
                    pavement_type = res.names[top1_idx]

                records.append({
                    "frame_number": frame_idx,
                    "timestamp_sec": round(frame_idx / fps, 3),
                    "latitude": round(lat, 7),
                    "longitude": round(lon, 7),
                    "speed": round(spd, 3),
                    "confidence_score": round(float(res.probs.top1conf) if model else 0.0, 4),
                    "image_path": "",          # no images saved for classify
                    "class_name": pavement_type,
                    "area_m2": None,
                    "length_m": None,
                })

                if progress_callback and total_frames > 0:
                    progress_callback(min(0.58, (frame_idx / total_frames) * 0.58))

            frame_idx += 1
    finally:
        cap.release()

    logger.info(f"[classify] {len(records)} pavement type records")
    return records


# ════════════════════════════════════════════════════════════════════════════
# Branch 5 — Traffic (DeepSORT)
# ════════════════════════════════════════════════════════════════════════════

def _run_traffic_pipeline(
    video_path, output_dir, gps_syncer, model_name,
    frame_interval_sec, confidence_threshold, progress_callback,
) -> list[dict]:
    """
    YOLOv8 (stock or fine-tuned) + DeepSORT vehicle counting.
    Counts vehicles that cross a virtual counting line at 80% frame height.
    """
    from model_manager import load_model

    try:
        from deep_sort_realtime.deepsort_tracker import DeepSort
        tracker = DeepSort(max_age=30, n_init=3, nms_max_overlap=1.0)
    except ImportError:
        logger.warning("deep-sort-realtime not installed — falling back to YOLO tracking")
        tracker = None

    model = load_model(model_name)
    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Virtual counting line (horizontal, at 80% height)
    line_y = int(height * 0.80)
    line_start = (0, line_y)
    line_end = (width, line_y)

    counters = {"car": 0, "bus": 0, "truck": 0, "bicycle": 0, "motorcycle": 0}
    counted_ids: set = set()
    track_history: dict = {}
    PPM = 8.0   # pixels-per-meter (approximate for speed estimation)

    records = []
    frame_idx = 0

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            timestamp_sec = frame_idx / fps
            lat, lon, spd = gps_syncer.interpolate(timestamp_sec)

            if model is None:
                continue

            if tracker is not None:
                # DeepSORT path
                det_results = model.predict(frame, verbose=False, conf=confidence_threshold)
                deepsort_inputs = []
                for row in det_results[0].boxes.data.cpu().numpy():
                    x1, y1, x2, y2 = int(row[0]), int(row[1]), int(row[2]), int(row[3])
                    conf = float(row[4])
                    cls_name = model.names.get(int(row[5]), "unknown")
                    if cls_name in ALLOWED_VEHICLE_CLASSES:
                        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                        if 0 <= cx <= width and 0 <= cy <= height:
                            deepsort_inputs.append([[x1, y1, x2 - x1, y2 - y1], conf, cls_name])

                tracks = tracker.update_tracks(deepsort_inputs, frame=frame)
                for track in tracks:
                    if not track.is_confirmed():
                        continue
                    tid = track.track_id
                    ltrb = track.to_ltrb()
                    cx, cy = int((ltrb[0] + ltrb[2]) / 2), int(ltrb[3])
                    det_class = track.get_det_class() or "unknown"

                    track_history.setdefault(tid, []).append((cx, cy))
                    if len(track_history[tid]) > 64:
                        track_history[tid].pop(0)

                    trail = track_history[tid]
                    if tid not in counted_ids and len(trail) >= 2:
                        p1, p2 = trail[-2], trail[-1]
                        if _crosses_line(p1, p2, line_start, line_end):
                            counted_ids.add(tid)
                            if det_class in counters:
                                counters[det_class] += 1

            else:
                # Fallback: YOLO built-in tracking
                results = model.track(frame, persist=True, conf=confidence_threshold, verbose=False)
                if results[0].boxes.id is not None:
                    for box, tid, conf, cls_id in zip(
                        results[0].boxes.xyxy.cpu().numpy(),
                        results[0].boxes.id.cpu().numpy().astype(int),
                        results[0].boxes.conf.cpu().numpy(),
                        results[0].boxes.cls.cpu().numpy().astype(int),
                    ):
                        cls_name = model.names.get(cls_id, "unknown")
                        if cls_name not in ALLOWED_VEHICLE_CLASSES:
                            continue
                        cx, cy = int((box[0] + box[2]) / 2), int(box[3])
                        track_history.setdefault(tid, []).append((cx, cy))
                        if len(track_history[tid]) > 64:
                            track_history[tid].pop(0)
                        trail = track_history[tid]
                        if tid not in counted_ids and len(trail) >= 2:
                            if _crosses_line(trail[-2], trail[-1], line_start, line_end):
                                counted_ids.add(tid)
                                if cls_name in counters:
                                    counters[cls_name] += 1

            # Record per-frame snapshot (with GPS)
            records.append({
                "frame_number": frame_idx,
                "timestamp_sec": round(timestamp_sec, 3),
                "latitude": round(lat, 7),
                "longitude": round(lon, 7),
                "speed": round(spd, 3),
                "confidence_score": 1.0,
                "image_path": "",
                "class_name": "traffic_count",
                "area_m2": None,
                "length_m": None,
                "counters": dict(counters),   # running total
            })

            if progress_callback and total_frames > 0:
                progress_callback(min(0.58, (frame_idx / total_frames) * 0.58))

    finally:
        cap.release()

    logger.info(f"[traffic] Final counts: {counters}")
    # Return summary record + all frame records
    summary = {
        "frame_number": 0,
        "timestamp_sec": 0.0,
        "latitude": records[0]["latitude"] if records else 0.0,
        "longitude": records[0]["longitude"] if records else 0.0,
        "speed": 0.0,
        "confidence_score": 1.0,
        "image_path": "",
        "class_name": "traffic_summary",
        "area_m2": None,
        "length_m": None,
        "counters": dict(counters),
    }
    return [summary]   # one summary row — detailed frames not needed in DB


# ════════════════════════════════════════════════════════════════════════════
# Measurement helpers (ported from Ultra_Production_Pipeline_V7 notebooks)
# ════════════════════════════════════════════════════════════════════════════

def _get_local_scale(bbox, width, height,
                     cam_height=DEFAULT_CAM_HEIGHT_M,
                     pitch_deg=DEFAULT_PITCH_DEG,
                     fov_deg=DEFAULT_FOV_DEG) -> float:
    """Estimate pixels-per-meter at bbox location using IPM model."""
    x1, y1, x2, y2 = map(int, bbox)
    bbox_center_y = (y1 + y2) / 2
    pitch = math.radians(pitch_deg)
    fov = math.radians(fov_deg)
    fx = (width / 2) / math.tan(fov / 2)
    cy = height / 2
    denom = (bbox_center_y - cy) * math.cos(pitch) + fx * math.sin(pitch)
    denom = max(denom, 1.0)
    ground_distance = max(1.0, min(cam_height * fx / denom, 20.0))
    view_width_m = 2 * ground_distance * math.tan(fov / 2)
    return width / view_width_m


def _measure_defect(mask_prob, frame, box, width, height, task_type):
    """
    Measure a segmented defect.
    Returns (measurement_value, annotated_frame).
    Potholes → area_m2   |   Cracks → length_m
    """
    # Build binary mask inside bbox
    clean_mask = np.zeros((height, width), dtype=bool)
    x1, y1, x2, y2 = map(int, box)
    if mask_prob is not None:
        region = mask_prob[y1:y2, x1:x2] > 0.5
        clean_mask[y1:y2, x1:x2] = region

    local_ppm = _get_local_scale(box, width, height)

    if task_type == "Cracks":
        try:
            from skimage.morphology import skeletonize as sk
            skeleton = sk(clean_mask)
            pixel_length = float(np.sum(skeleton))
        except ImportError:
            # Fallback: contour perimeter / 2
            contours, _ = cv2.findContours(
                clean_mask.astype(np.uint8) * 255, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            pixel_length = sum(cv2.arcLength(c, True) for c in contours) / 2 if contours else 0.0
            skeleton = clean_mask

        val_m = pixel_length / max(local_ppm, 1.0)
        val_m = max(val_m, 0.01) if pixel_length > 0 else 0.0

        # Annotate
        annotated = frame.copy()
        overlay = np.zeros_like(annotated)
        overlay[clean_mask] = (0, 200, 200)
        overlay[skeleton] = (255, 255, 0)
        annotated = cv2.addWeighted(annotated, 0.7, overlay, 0.3, 0)
        label = f"Crack | {val_m:.2f}m"

    else:  # Potholes
        pixel_area = float(np.sum(clean_mask))
        val_m = pixel_area / max(local_ppm ** 2, 1.0)
        val_m = max(val_m, 0.001) if pixel_area > 0 else 0.0

        annotated = frame.copy()
        overlay = np.zeros_like(annotated)
        overlay[clean_mask] = (0, 0, 255)
        annotated = cv2.addWeighted(annotated, 0.7, overlay, 0.3, 0)
        label = f"Pothole | {val_m:.3f}m²"

    cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
    cv2.putText(annotated, label, (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 0), 2)
    return val_m, annotated


def _get_best_mask(yolo_result, idx: int, frame, box, sam_predictor):
    """Return the best binary mask: SAM 2 if available, else YOLO seg mask."""
    height, width = frame.shape[:2]

    if sam_predictor is not None:
        try:
            import torch
            sam_predictor.set_image(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            masks, _, _ = sam_predictor.predict(box=box, multimask_output=False)
            mask = masks[0] if masks.ndim == 3 else masks
            full = np.zeros((height, width), dtype=np.float32)
            full[:mask.shape[0], :mask.shape[1]] = mask.astype(np.float32)
            return full
        except Exception as e:
            logger.debug(f"SAM 2 predict failed, fallback to YOLO mask: {e}")

    # YOLO seg mask fallback
    try:
        mask_data = yolo_result.masks.data[idx].cpu().numpy()
        # Resize to frame size if needed
        if mask_data.shape != (height, width):
            mask_data = cv2.resize(mask_data, (width, height), interpolation=cv2.INTER_LINEAR)
        return mask_data
    except Exception:
        return None


def _try_load_sam2():
    """Try to load SAM 2 predictor. Returns None if not available."""
    try:
        from pathlib import Path as P
        import sys as _sys
        _sys.path.insert(0, str(P(__file__).resolve().parent.parent.parent / "server"))
        from model_manager import is_model_available, MODELS_DIR
        sam_path = MODELS_DIR / "sam2_hiera_small.pt"
        if not sam_path.exists():
            return None
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = build_sam2("sam2_hiera_s.yaml", str(sam_path), device=device)
        predictor = SAM2ImagePredictor(model)
        logger.info("SAM 2 loaded for mask refinement")
        return predictor
    except Exception as e:
        logger.debug(f"SAM 2 not available: {e}")
        return None


# ════════════════════════════════════════════════════════════════════════════
# Utils
# ════════════════════════════════════════════════════════════════════════════

def _open_video(video_path, frame_interval_sec):
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_step = max(1, int(fps * frame_interval_sec))
    logger.info(f"Video: {Path(video_path).name} | {fps:.1f} fps | {total_frames} frames | step={frame_step}")
    return cap, fps, total_frames, frame_step


def _crosses_line(p1, p2, l_start, l_end) -> bool:
    """Check if line segment p1→p2 crosses l_start→l_end."""
    x1, y1 = p1; x2, y2 = p2
    x3, y3 = l_start; x4, y4 = l_end
    denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
    if denom == 0:
        return False
    ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom
    ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom
    return 0 < ua < 1 and 0 < ub < 1


def write_detections_csv(detections: list[dict], csv_path: str | Path) -> Path:
    """Write detections to CSV that the existing pothole endpoint can read."""
    csv_path = Path(csv_path)
    fieldnames = [
        "frame_number", "timestamp_sec", "latitude", "longitude", "speed",
        "confidence_score", "image_path", "class_name", "area_m2", "length_m",
    ]
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(detections)
    logger.info(f"Detections CSV: {csv_path} ({len(detections)} rows)")
    return csv_path
