# Desktop App: Landing Page Redesign + ML Model Integration Plan

---

## Part 1: Observations & Quick Findings

### Products Page — Download Link
The `ProductsPage.jsx` download button points to a **hardcoded v2.1.0 URL**:
```
https://github.com/Jacob-DelosAngeles/EXPRESS-AI/releases/download/v2.1.0/EXPRESS-AI-Setup-2.1.0.exe
```
✅ **This is fine** — works as long as the GitHub release tag and `.exe` asset name match exactly.

### Desktop Landing Page — YouTube Embed Error 153
**Root cause:** Electron's sandboxed Chromium detects the restricted environment and refuses to play YouTube embeds (no public `Referer` header). This is a hard Electron limitation — it cannot be fixed with config changes.

**Verdict:** `LandingPage.jsx` is a web marketing page being shown inside a desktop app. Professional desktop apps (VSCode, Figma, Linear, Notion) never show a marketing landing page — they go directly to the functional interface.

---

## Part 2: Desktop Landing Page Redesign

### Design Pattern Reference
| App | First Screen | Pattern |
|---|---|---|
| **VS Code** | Welcome tab with recent projects | Work-first |
| **Figma** | Project browser with recent files | Content-first |
| **Linear** | Dashboard / inbox | Function-first |

### Proposed: `DesktopHome.jsx` — Workspace Launcher

A professional desktop home screen with:
1. **Header** — App logo + user greeting + version badge
2. **Primary CTA** — "Process New Video + GPS" (main ML pipeline entry point)
3. **Quick Actions** — "Open Dashboard", "Open Analytics", "View Reports"
4. **Recent Jobs** — Last 5 processed video/CSV sessions (one-click re-open)
5. **System Status Card** — Backend health, model availability, local storage used
6. **Zero external network dependencies** — Fully offline capable

### Files to Modify

#### [MODIFY] `client/src/App.jsx`
- Route `/` to `DesktopHome` when `IS_DESKTOP` is true

#### [NEW] `client/src/pages/DesktopHome.jsx`
- New workspace launcher (designed via Stitch, then implemented)

#### [MODIFY] `client/src/pages/LandingPage.jsx`
- Remove YouTube `<iframe>` (or guard with `!IS_DESKTOP`)

---

## Part 3: ML Model Integration — Desktop Pipeline

### Architecture
```
User uploads:
  ├── video.mp4      → YOLO Detection (pothole, crack, vehicle)
  └── gps_data.csv   → GPS + Timestamp sync

            ↓  Desktop ML Pipeline (Python)

  ├── Frame extraction (OpenCV)
  ├── YOLO inference (ultralytics)
  ├── GPS interpolation per frame
  ├── IRI estimation (iri_calculator_logic.py)
  └── Results → SQLite DB

            ↓  Existing React UI

  Dashboard + Analytics auto-populated (no UI changes needed)
```

### New Backend Files

| File | Purpose |
|---|---|
| `desktop/backend/ml_pipeline.py` | Pipeline orchestrator (job queue) |
| `desktop/backend/video_processor.py` | OpenCV frame extraction + YOLO inference |
| `desktop/backend/gps_sync.py` | Interpolate GPS per frame |
| `desktop/backend/model_manager.py` | Load/cache `.pt` model files |

### New API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/desktop/process` | `POST` | Start pipeline job |
| `/api/v1/desktop/status/{job_id}` | `GET` | Poll progress (0–100%) |
| `/api/v1/desktop/jobs` | `GET` | List past runs |
| `/api/v1/desktop/cancel/{job_id}` | `DELETE` | Cancel in-progress job |

### New Frontend Files

| File | Purpose |
|---|---|
| `client/src/pages/DesktopHome.jsx` | Workspace launcher (home page) |
| `client/src/components/VideoUploadPanel.jsx` | Drag-and-drop video + GPS CSV upload |
| `client/src/components/ProcessingStatus.jsx` | Real-time job progress bar |

### Pipeline Steps
1. **Validate** — Check video format + GPS CSV columns (`timestamp`, `latitude`, `longitude`)
2. **Extract frames** — OpenCV, 1 frame/sec configurable
3. **Sync GPS** — Interpolate coordinates per extracted frame
4. **YOLO inference** — Batch inference on frames, save detection images
5. **IRI estimation** — Use existing `iri_calculator_logic.py`
6. **Write to DB** — Insert into SQLite via existing `UploadModel` schema
7. **Broadcast progress** — Poll `/status/{job_id}` every 2 seconds

### Model Distribution Strategy

| Option | Pros | Cons |
|---|---|---|
| **Bundle in installer** | Fully offline immediately | +300MB+ installer |
| **Download on first run** | Lean installer | Requires internet once |

**Recommendation:** Bundle YOLOv8 nano (light) in installer. Add "Upgrade Model" in settings to download YOLOv8m (medium) for higher accuracy.

> **Warning:** `torch` CPU-only adds ~800MB to bundle. Use `--onedir` PyInstaller mode. Run ML pipeline as a subprocess to isolate memory pressure from the main FastAPI server.

---

## Verification

### Part 1
- Desktop app opens → `DesktopHome` renders, no YouTube error
- Vercel web app → still shows YouTube iframe (web users unaffected)

### Part 2
- Upload `.mp4` + GPS CSV → progress reaches 100%
- Dashboard → markers at correct GPS coordinates
- Analytics → pothole count, confidence scores, images populated
