<div align="center">

# DAAN-FERN

**Digital Analytics for Asset-based Navigation of Roads**

*An AI-powered road condition monitoring and analytics platform for pavement asset management*

[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat&logo=react)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python)](https://python.org/)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-00FFCD?style=flat)](https://ultralytics.com/)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey?style=flat)](https://creativecommons.org/licenses/by-nc/4.0/)

</div>

---

## Overview

DAAN-FERN is a full-stack road condition monitoring system that combines **computer vision**, **GPS telemetry**, and **pavement engineering principles** to automate the detection, classification, and management of road surface distresses. The platform is designed to support local government units (LGUs) and road asset managers in the Philippines with data-driven, evidence-based pavement maintenance decisions.

Traditionally, road condition surveys are manual, time-consuming, and subjective. DAAN-FERN replaces this with a deployable mobile data collection pipeline paired with a web-based analytics dashboard — processing raw survey videos and GPS logs into actionable pavement health reports.

---

## Research Context

This project is developed in the context of **pavement asset management** under Philippine road network conditions. It addresses the following research problems:

- **Automated Pavement Distress Detection** — using fine-tuned YOLOv8 models trained on local road datasets (RDD2022 + custom-annotated Philippine road images)
- **International Roughness Index (IRI) Estimation** — computing IRI from smartphone accelerometer data as a low-cost alternative to profilometers
- **Crack Quantification** — segmenting crack instances and estimating crack length (`measurement` field) from image metadata
- **Road Surface Classification** — classifying segments as Asphalt, Concrete, or Unpaved using a YOLOv8 classification model
- **Rehabilitation Cost Estimation** — deriving repair cost estimates from pothole area (m²) and severity using DPWH-aligned cost models

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Data Collection Layer                      │
│  Mobile App (React Native/Expo)  ←→  Dashcam / GPS Logger       │
└───────────────────────┬─────────────────────────────────────────┘
                        │  CSV + Images
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Processing Layer (Notebooks)               │
│  YOLOv8 Detection → IRI Calculator → Crack Segmentation (SAM)  │
│  Road Classification → Traffic Counting (DeepSORT)              │
└───────────────────────┬─────────────────────────────────────────┘
                        │  Processed CSV + Annotated Images
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Backend (FastAPI + Supabase)               │
│  /iri  /pothole  /vehicle  /pavement  /upload  /auth            │
│  PostgreSQL (Supabase) + Cloudflare R2 (Object Storage)         │
└───────────────────────┬─────────────────────────────────────────┘
                        │  REST API
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                      │
│  Interactive Map (Leaflet) · Analytics Dashboard · PDF Export   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 🛣️ Pavement Distress Detection
- **Pothole Detection** — YOLOv8 object detection, outputting GPS coordinates, confidence scores, bounding box area (m²), and repair cost estimates
- **Crack Detection & Segmentation** — instance segmentation pipeline using YOLOv8-seg + SAM (Segment Anything Model) for crack length quantification
- **Road Classification** — per-segment pavement type classification (Asphalt / Concrete / Unpaved)

### 📊 Analytics Dashboard
- **IRI Analysis** — roughness index computation from accelerometer CSV data, segmented by GPS waypoints
- **Interactive Map** — Leaflet-based spatial visualization with ROI (Region of Interest) polygon filtering
- **Paginated Image Gallery** — confidence-sorted detection image review with full pagination support
- **PDF Report Export** — auto-generated road condition summary reports for field engineers

### 🤖 AI Notebooks (`/Notebooks`)
| Notebook | Description |
|----------|-------------|
| `Ultra_Production_Pipeline_V6/V7.ipynb` | Full road survey pipeline: detection, IRI, GPS fusion, output CSV |
| `Production_Notebook_Pothole.ipynb` | Standalone pothole detection + area calculation |
| `Production_Notebook_Cracks.ipynb` | Crack detection + segmentation pipeline |
| `Production_Notebook_Road_Classification.ipynb` | Pavement type classification |
| `Crack_Segmentation_ImagePipeline.ipynb` | SAM-based crack instance segmentation |
| `Training_Notebook_v2.ipynb` | YOLOv8 model fine-tuning (custom Philippine road dataset) |
| `Training_Notebook_RDD.ipynb` | Training on RDD2022 Road Damage Dataset |
| `PAVI_VLM_Inference.ipynb` | Vision-Language Model (VLM) inference for pavement description |

### 📱 Multi-Platform
- **Web App** — full-featured analytics platform (this repo)
- **Mobile App** — React Native (Expo) dashcam + GPS data collection app
- **Desktop App** — Electron wrapper for offline/on-premise deployment

---

## Tech Stack

### Backend
| Technology | Role |
|-----------|------|
| **FastAPI** | REST API framework |
| **Supabase (PostgreSQL)** | Relational database + auth |
| **Cloudflare R2** | Image & CSV object storage |
| **Pandas / NumPy** | Data processing |
| **Ultralytics YOLOv8** | Object detection & segmentation |

### Frontend
| Technology | Role |
|-----------|------|
| **React 18 + Vite** | UI framework & build tool |
| **Leaflet.js** | Interactive mapping |
| **Recharts** | Analytics charts |
| **Zustand** | State management |
| **TailwindCSS** | Styling |

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- A [Supabase](https://supabase.com/) project
- A [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) bucket

### Backend

```bash
cd server
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # fill in your keys
python main.py
```

### Frontend

```bash
cd client
npm install
cp .env.example .env              # set VITE_API_URL
npm run dev
```

### Environment Variables

**`server/.env`**
```env
DATABASE_URL=postgresql://...
CLOUDFLARE_R2_ENDPOINT=...
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...
CLOUDFLARE_R2_BUCKET_NAME=...
CLERK_SECRET_KEY=...
```

**`client/.env`**
```env
VITE_API_URL=http://localhost:8000
VITE_CLERK_PUBLISHABLE_KEY=...
```

---

## Deployment

| Service | Platform |
|---------|----------|
| Frontend | [Vercel](https://vercel.com/) |
| Backend | [Render](https://render.com/) |
| Database | [Supabase](https://supabase.com/) |
| Storage | [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) |

---

## Project Structure

```
DAAN-FERN/
├── client/              # React + Vite frontend
│   └── src/
│       ├── pages/       # Dashboard, Analytics, Map, Auth
│       ├── components/  # Sidebar, Map, DiagnosisCard, etc.
│       └── services/    # API clients, report generation
├── server/              # FastAPI backend
│   └── api/v1/endpoints/
│       ├── iri.py       # IRI data processing
│       ├── pothole.py   # Pothole + crack detection API
│       ├── vehicle.py   # Traffic count API
│       ├── pavement.py  # Road classification API
│       └── upload.py    # File upload + R2 storage
├── Notebooks/           # AI processing pipelines (Jupyter)
├── mobile-app/          # React Native (Expo) data collection app
└── desktop/             # Electron desktop wrapper
```

---

## Research Applications

This platform is designed to support the following engineering workflows:

1. **Network-Level Pavement Management** — prioritize maintenance budgets across a road network using IRI thresholds and distress density metrics
2. **Project-Level Condition Assessment** — detailed before/after rehabilitation documentation using the image gallery and detection confidence scores
3. **DPWH Compliance Reporting** — structured PDF exports aligned with Philippine Department of Public Works and Highways pavement condition reporting standards
4. **AI Model Benchmarking** — the notebook suite supports iterative model training and evaluation on local datasets

---

## Citation

If you use this system or its components in academic work, please cite:

```bibtex
@software{daanfern2025,
  title   = {DAAN-FERN: Digital Analytics for Asset-based Navigation of Roads},
  author  = {Delos Angeles, Jacob},
  year    = {2025},
  url     = {https://github.com/Jacob-DelosAngeles/DAAN-FERN}
}
```

---

## License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)** License. See [LICENSE](LICENSE) for details.
