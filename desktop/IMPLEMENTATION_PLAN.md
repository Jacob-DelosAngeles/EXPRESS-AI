# Desktop ML Pipeline — Implementation Plan (v3)

> ⚠️ **Web App Isolation Guarantee**  
> All new code lives exclusively in `desktop/backend/`. New endpoints only mount when `DEPLOYMENT_MODE=desktop`. Zero changes to `server/` or the Vercel web deployment.

---

## Model Registry (`desktop/models/`)

| Status | Filename | Task | Architecture | Output |
|---|---|---|---|---|
| ✅ Ready | `pothole_detection.pt` | Pothole detection | YOLOv8-det (fine-tuned) | bbox + confidence |
| ✅ Ready | `pothole_segmentation.pt` | Pothole segmentation | YOLOv8-seg (fine-tuned) | mask → area (m²) |
| ✅ Ready | `cracks_segmentation.pt` | Crack segmentation | YOLOv8-seg (fine-tuned) | mask → length (m) |
| ✅ Ready | `road_classification.pt` | Pavement type | YOLOv8-cls (fine-tuned) | asphalt/concrete/unpaved |
| ✅ Ready | `traffic.pt` | Vehicle counting | **YOLOv8s (not fine-tuned)** | car/truck/bus/moto count |
| ✅ Ready | `sam2_hiera_small.pt` | Mask refinement | SAM 2 Small (~46MB) | enhanced seg masks |

> **Notes:**
> - All models + SAM 2 Small are now placed in `desktop/models/`
> - `traffic.pt` is stock YOLOv8s — fine-tuning is a future step

---

## Pipeline Architecture

```
VideoUploadPanel.jsx  (6 task cards)
  │  POST /api/v1/desktop/process (video + GPS CSV + task + model_name)
  ▼
desktop_router.py → ml_pipeline.py (background thread)
  │
  ├── pothole_detect  → pothole_detection.pt  + ByteTrack  → bbox + GPS
  ├── pothole_seg     → pothole_segmentation.pt + SAM 2 ✅  → area_m² + GPS
  ├── crack_seg       → cracks_segmentation.pt + skeletonize → length_m + GPS
  ├── road_classify   → road_classification.pt              → pavement type + GPS
  ├── traffic         → traffic.pt + DeepSORT               → vehicle counts
  └── IRI (always)   → iri_calculator_logic.py             → IRI per 100m segment
         │
         ▼  Poll /api/v1/desktop/status/{job_id} every 2s
  ProcessingStatus.jsx → DesktopHome jobs table → Dashboard / Analytics
```

---

## ✅ Completed

| # | Task | Files Changed |
|---|---|---|
| 1 | Backend infrastructure (router, pipeline, queue) | `desktop_router.py`, `ml_pipeline.py` |
| 2 | GPS sync + model loader | `gps_sync.py`, `model_manager.py` |
| 3 | `video_processor.py` — 5 task-specific branches | `video_processor.py` |
| 4 | `VideoUploadPanel.jsx` — 6 real task cards, model/SAM 2 status | `VideoUploadPanel.jsx` |
| 5 | `desktop_router.py` — task/model_name form params | `desktop_router.py` |
| 6 | `ml_pipeline.py` — task/model_name threaded through | `ml_pipeline.py` |
| 7 | SAM 2 Small downloaded| `desktop/models/sam2_hiera_small.pt` |
| 8 | Install Python ML dependencies (`ultralytics`, `sam2`, etc.) | `server/venv` |
| 9 | Pothole detection bugfixes (predict fallback, DB `upload_id`) | `video_processor.py`, `ml_pipeline.py` |
| 10 | Cancel processing job UI/UX | `ProcessingStatus.jsx`, `DesktopHome.jsx` |
| 11 | Fix survey name persistence bug | `ml_pipeline.py` |

---

## 🔲 Next Steps

### ⭐ Step A — End-to-End Testing (In Progress)

Test each pipeline branch with a real video + GPS CSV to ensure full integration.

1. Start backend: `cd desktop/backend && python desktop_main.py`
2. Start frontend: `cd client && npm run dev`
3. Open DesktopHome → Upload → test each task card:

| Task | Status | Expected Result |
|---|---|---|
| Pothole Detection | 🔲 Pending | Markers on Dashboard map with confidence score |
| Pothole Segmentation | 🔲 Pending | Markers with area_m² in popup, SAM 2 enhanced masks |
| Crack Segmentation | 🔲 Pending | Markers with length_m in popup |
| Road Classification | 🔲 Pending | GPS points labeled asphalt/concrete/unpaved |
| Traffic Counting | 🔲 Pending | Vehicle count summary in Analytics |
| IRI | 🔲 Pending | Segments on IRI page |

---

### Step B — Dashboard: Road Classification Map Layer
Road classification output (`latitude, longitude, type`) needs a new colour-coded  
GPS polyline layer on the Dashboard map to visualise pavement types.

- **Asphalt** → 🟢 green  
- **Concrete** → 🔵 blue  
- **Unpaved** → 🟠 orange

---

### Step D — Fine-tune `traffic.pt`
When training data is ready, swap `desktop/models/traffic.pt` with the fine-tuned  
model — no code changes needed, just drop the new file.

---

### Step E — PyInstaller Packaging
Bundle all models + dependencies into the desktop installer:
- Add `desktop/models/*.pt` to `pyinstaller.spec` datas
- Test that `model_manager.py` resolves paths correctly in the bundled `.exe`
- Rebuild installer: tag `v2.2.0`

---

## Verification Checklist

- [ ] All 5 task cards → pipeline completes without error
- [ ] Pothole seg → `area_m2` values appear in Dashboard marker popup
- [ ] Crack seg → `length_m` values appear in Dashboard marker popup
- [ ] Road classify → pavement type recorded per GPS point
- [ ] Traffic → vehicle counts visible in Analytics summary
- [ ] IRI → segments appear on IRI page
- [ ] Web app (Vercel) → unaffected (zero changes to `server/`)
