# =====================================================
# 🚜 PAVI Core: Unified Road Inspection Pipeline (v3.1)
# GPS-ENABLED VERSION - Web Dashboard Ready
# =====================================================
# 
# This is the updated run_production_pipeline() function for
# Ultra_Production_Pipeline_V3.ipynb with GPS matching logic.
#
# COPY THIS ENTIRE CELL into the "4️⃣ Core Pipeline Execution" section.
# =====================================================

from ultralytics import YOLO
from sam2.build_sam import build_sam2
from sam2.sam2_image_predictor import SAM2ImagePredictor
from tqdm import tqdm
import pandas as pd
import shutil
import cv2
import numpy as np
import os

def run_production_pipeline():
    """
    Production-grade defect detection pipeline.
    - ByteTrack for temporal consistency
    - VLM validation per unique track ID
    - GPS synchronization for geo-tagged output
    - SAM 2 segmentation for area/length measurement
    """
    # 1. Initialization
    device = "cuda" if torch.cuda.is_available() else "cpu"
    yolo = YOLO(DET_MODEL_PATH)
    auditor = VLMAuditor(VLM_API_KEY, VLM_MODEL)
    
    predictor = None
    if INFERENCE_MODE == "Segmentation":
        sam2 = build_sam2("sam2_hiera_s.yaml", "sam2_hiera_small.pt", device=device)
        predictor = SAM2ImagePredictor(sam2)

    # 2. Compute Homography (for real-world measurements)
    H_matrix, H_scale = calculate_homography_and_scale(CALIB_IMAGE_PATH, MANUAL_CALIB_POINTS, ROAD_WIDTH_M)
    
    # =========================================
    # 3. Load GPS Data (Frame-Time Sync)
    # =========================================
    gps_df = None
    video_start_time = None
    if os.path.exists(GPS_LOG_PATH):
        try:
            gps_df = pd.read_csv(GPS_LOG_PATH)
            gps_df.columns = gps_df.columns.str.strip().str.lower()
            # Find time column (flexible naming)
            time_col = next((c for c in gps_df.columns if 'time' in c or 'date' in c), None)
            if time_col:
                gps_df[time_col] = pd.to_datetime(gps_df[time_col], format='mixed', utc=True)
                gps_df = gps_df.sort_values(time_col).rename(columns={time_col: 'time'})
                video_start_time = gps_df['time'].iloc[0]
                print(f"✅ GPS Loaded: {len(gps_df)} points")
        except Exception as e:
            print(f"⚠️ GPS Error: {e}")
    else:
        print("⚠️ No GPS log found. Coordinates will be None.")

    # 4. Setup Video
    cap = cv2.VideoCapture(VIDEO_PATH)
    fps = cap.get(cv2.CAP_PROP_FPS)
    width, height = int(cap.get(3)), int(cap.get(4))
    os.makedirs("results/frames", exist_ok=True)
    
    track_history = {}
    final_records = []
    validated_ids = set()
    rejected_ids = set()
    frame_idx = 0
    
    pbar = tqdm(total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT)), desc=f"{TASK_TYPE} Detection")
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break
        
        # Detection + Tracking (ByteTrack)
        results = yolo.track(frame, persist=True, verbose=False)[0]
        
        if results.boxes.id is not None:
            boxes = results.boxes.xyxy.cpu().numpy()
            ids = results.boxes.id.cpu().numpy().astype(int)
            confs = results.boxes.conf.cpu().numpy()
            
            # =========================================
            # GPS for current frame (Nearest-Neighbor)
            # =========================================
            lat, lon = None, None
            if gps_df is not None and video_start_time is not None:
                curr_time = video_start_time + pd.to_timedelta(frame_idx / fps, unit='s')
                idx_near = (gps_df['time'] - curr_time).abs().idxmin()
                row = gps_df.loc[idx_near]
                lat, lon = float(row['latitude']), float(row['longitude'])
            
            for box, tid, conf in zip(boxes, ids, confs):
                if tid in rejected_ids: continue
                
                # =========================================
                # VLM Audit (Once per unique Track ID)
                # =========================================
                if VLM_VALIDATION and tid not in validated_ids:
                    if tid not in track_history: 
                        track_history[tid] = []
                    
                    # Store frame data with GPS for later use
                    track_history[tid].append({
                        'box': box, 
                        'frame': frame.copy(), 
                        'conf': conf,
                        'frame_idx': frame_idx, 
                        'lat': lat, 
                        'lon': lon
                    })
                    
                    # Pick best crop after 15 frames of tracking
                    if len(track_history[tid]) >= 15: 
                        best = max(track_history[tid], key=lambda x: x['conf'])
                        x1, y1, x2, y2 = map(int, best['box'])
                        crop = best['frame'][y1:y2, x1:x2]
                        
                        if auditor.audit_defect(crop, TASK_TYPE.lower()):
                            validated_ids.add(tid)
                            print(f"✅ ID {tid} validated by VLM.")
                            
                            # === PROCESS VALIDATED DETECTION ===
                            measurement = 0
                            if INFERENCE_MODE == "Segmentation" and predictor:
                                predictor.set_image(cv2.cvtColor(best['frame'], cv2.COLOR_BGR2RGB))
                                m, s, _ = predictor.predict(box=best['box'], multimask_output=False)
                                mask = m[0] if m.ndim == 3 else m
                                measurement, _ = measure_defect(mask, width, height, best['box'], H_matrix, H_scale, TASK_TYPE)
                            
                            # Save best crop image
                            image_filename = f"{TASK_TYPE.lower()}_{tid}_{best['frame_idx']}.jpg"
                            cv2.imwrite(f"results/frames/{image_filename}", crop)
                            
                            # Record detection (Web-Ready Format)
                            record = {
                                'track_id': tid,
                                'latitude': best['lat'],
                                'longitude': best['lon'],
                                'confidence': float(best['conf']),
                                'image_path': image_filename,
                                'frame_idx': best['frame_idx']
                            }
                            # Add measurement with correct column name
                            if TASK_TYPE == "Potholes":
                                record['area_m2'] = round(measurement, 4)
                            else:
                                record['length_m'] = round(measurement, 4)
                            
                            final_records.append(record)
                            
                            # Clear history to free memory
                            del track_history[tid]
                        else:
                            rejected_ids.add(tid)
                            del track_history[tid]
                            print(f"❌ ID {tid} rejected by VLM.")
                            continue
                
                # =========================================
                # Non-VLM Mode: Process immediately
                # =========================================
                elif not VLM_VALIDATION and tid not in validated_ids:
                    validated_ids.add(tid)  # Mark as processed
                    measurement = 0
                    if INFERENCE_MODE == "Segmentation" and predictor:
                        predictor.set_image(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                        m, s, _ = predictor.predict(box=box, multimask_output=False)
                        mask = m[0] if m.ndim == 3 else m
                        measurement, _ = measure_defect(mask, width, height, box, H_matrix, H_scale, TASK_TYPE)
                    
                    x1, y1, x2, y2 = map(int, box)
                    crop = frame[y1:y2, x1:x2]
                    image_filename = f"{TASK_TYPE.lower()}_{tid}_{frame_idx}.jpg"
                    cv2.imwrite(f"results/frames/{image_filename}", crop)
                    
                    record = {
                        'track_id': tid,
                        'latitude': lat,
                        'longitude': lon,
                        'confidence': float(conf),
                        'image_path': image_filename,
                        'frame_idx': frame_idx
                    }
                    if TASK_TYPE == "Potholes":
                        record['area_m2'] = round(measurement, 4)
                    else:
                        record['length_m'] = round(measurement, 4)
                    
                    final_records.append(record)
        
        frame_idx += 1
        pbar.update(1)
    
    cap.release()
    pbar.close()
    
    # =========================================
    # 5. Export Results (Web-Ready CSV + ZIP)
    # =========================================
    if final_records:
        df = pd.DataFrame(final_records)
        df.to_csv("results/detections.csv", index=False)
        shutil.make_archive("final_results", 'zip', "results")
        print(f"✅ Exported {len(df)} detections to results/detections.csv")
        print(f"   Columns: {list(df.columns)}")
        try:
            from google.colab import files
            files.download("final_results.zip")
        except: 
            pass  # Not in Colab
    else:
        print("⚠️ No detections found.")
    
    return pd.DataFrame(final_records)

# Uncomment to run:
# df = run_production_pipeline()
# df.head()
