# YOLO Model Files — Placement Guide

Place your trained YOLO `.pt` files in **this directory** (`desktop/models/`).

## Required Files

| Filename | Purpose | Min. Recommended |
|---|---|---|
| `pothole.pt` | Detects potholes and cracks | YOLOv8n (nano, ~6MB) |
| `vehicle.pt` | Detects and counts vehicles | YOLOv8n (nano, ~6MB) |

## Naming Convention

The filename **must exactly match** the model name you select in the Upload dialog:
- Select **"Pothole & Crack Detection"** → loads `pothole.pt`
- Select **"Vehicle Detection"** → loads `vehicle.pt`

## Training Your Own Model

If you trained a custom YOLOv8 model, export it as a `.pt` file and
drop it here. The model name in the UI will match the filename (without `.pt`).

```bash
# Example: export from Ultralytics training
yolo export model=runs/detect/train/weights/best.pt format=pt
# Then rename best.pt → pothole.pt and place it here
```

## Checking Model Availability

After placing files, you can verify via the desktop API:
```
GET http://127.0.0.1:8000/api/v1/desktop/models
```

Response:
```json
{
  "available": ["pothole", "vehicle"],
  "pothole_ready": true,
  "vehicle_ready": true
}
```

## Notes

- This folder is **gitignored** — model files are NOT committed to the repo
  (they are large binary files; distribute them separately).
- The `model_manager.py` caches loaded models in memory for the session duration.
- If a model file is missing, the pipeline still runs but saves raw frames
  (no detections) so IRI computation can still proceed.
