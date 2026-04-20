# EXPRESS-AI Desktop Application

This directory contains everything needed to run EXPRESS-AI as a standalone
desktop application (Electron + Python backend + local YOLO ML pipeline).

## Directory Structure

```
desktop/
├── backend/                  # Python desktop server + ML pipeline
│   ├── desktop_main.py       # Entry point — patches settings, starts FastAPI
│   ├── desktop_auth.py       # Auto-superuser auth (no Clerk required)
│   ├── desktop_config.py     # Desktop-specific settings overrides
│   ├── desktop_router.py     # ML pipeline API endpoints (/api/v1/desktop/*)
│   ├── ml_pipeline.py        # Job queue orchestrator (background thread)
│   ├── video_processor.py    # OpenCV frame extraction + YOLO inference
│   ├── gps_sync.py           # GPS/sensor CSV interpolation per video frame
│   └── model_manager.py      # YOLO .pt model loader & memory cache
├── electron/                 # Electron shell
│   ├── main.js               # Electron main process
│   ├── preload.js            # Bridge between Electron and React
│   └── package.json          # Electron + electron-builder
├── models/                   # ← Place your YOLO .pt files here
│   └── README.md             # Model placement guide
├── homepage_inspo/           # Design reference (Stitch/AI Studio output)
├── IMPLEMENTATION_PLAN.md    # ML pipeline architecture & roadmap
└── pyinstaller.spec          # PyInstaller bundling spec
```

---

## Quick Start (Development)

### Prerequisites
```bash
# Python deps (desktop backend + ML pipeline)
pip install ultralytics opencv-python-headless pandas numpy scipy

# Node deps (Electron shell)
cd desktop/electron
npm install
```

### 1. Place YOLO model files
```
desktop/models/
  ├── pothole.pt    ← YOLOv8 model trained for pothole/crack detection
  └── vehicle.pt   ← YOLOv8 model trained for vehicle detection (optional)
```
See `desktop/models/README.md` for download links and naming conventions.

### 2. Start the Desktop Backend
```bash
cd desktop/backend
python desktop_main.py
```

### 3. Start the Frontend (separate terminal)
```bash
cd client
npm run dev
```

### 4. Launch Electron (separate terminal, points at Vite dev server)
```bash
cd desktop/electron
npx electron . --dev
```

The `--dev` flag connects Electron to `http://localhost:5173` (Vite HMR).
Without it, Electron loads the pre-built frontend bundle inside `resources/`.

---

## ML Pipeline — How It Works

```
User uploads video + GPS CSV via DesktopHome
         │
         ▼  POST /api/v1/desktop/process
desktop_router.py
         │
         ▼  Background thread
ml_pipeline.py
  ├── gps_sync.py        — Interpolate GPS lat/lon for each video frame
  ├── video_processor.py — Extract frames (1/sec) → run YOLO inference
  ├── iri_calculator_logic.py (from server/) — Compute IRI per 100m segment
  └── Write UploadModel + PotholeImageModel rows to SQLite
         │
         ▼  Poll /api/v1/desktop/status/{job_id} every 2s
ProcessingStatus.jsx    — Live progress bar in DesktopHome
         │
         ▼
Dashboard + Analytics   — Auto-populated (no additional code needed)
```

### GPS/Sensor CSV Format
| Column | Required | Description |
|---|---|---|
| `time` | ✅ | Elapsed seconds or ISO datetime |
| `ax`, `ay`, `az` | ✅ | Accelerometer (m/s²) |
| `latitude`, `longitude` | ✅ | GPS coordinates |
| `speed` | ✅ | Vehicle speed (m/s) |
| `altitude`, `wx`, `wy`, `wz` | optional | Altitude + gyroscope |

---

## API Endpoints (Desktop-Only)

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/desktop/process` | `POST` | Start pipeline (video + CSV upload) |
| `/api/v1/desktop/status/{job_id}` | `GET` | Poll job progress (0–100%) |
| `/api/v1/desktop/jobs` | `GET` | List all past jobs |
| `/api/v1/desktop/cancel/{job_id}` | `DELETE` | Cancel running job |
| `/api/v1/desktop/models` | `GET` | List available .pt model files |

---

## Building the Installer

```bash
# 1. Build React frontend
cd client && npm run build

# 2. Bundle Python backend with PyInstaller
cd desktop
pyinstaller pyinstaller.spec

# 3. Package with Electron Builder  
cd desktop/electron
npm run build:win
```

The installer will be output to `desktop/dist/electron/`.

GitHub Actions (`build-desktop.yml`) automates this on every `v*` tag push.

---

## Web App Isolation Guarantee

All ML pipeline code lives exclusively in `desktop/backend/`. The
`server/` directory and the Vercel web deployment are **never modified**.
Desktop-only endpoints are mounted only when `DEPLOYMENT_MODE=desktop`.
