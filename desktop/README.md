# EXPRESS-AI Desktop Application

This directory contains everything needed to run EXPRESS-AI as a standalone
desktop application (Electron + Python backend).

## Architecture

```
desktop/
├── backend/              # Python desktop server wrapper
│   ├── desktop_main.py   # Entry point — patches settings, starts FastAPI
│   ├── desktop_auth.py   # Dummy auth (auto-superuser, no Clerk)
│   └── desktop_config.py # Desktop-specific settings overrides
├── electron/             # Electron shell (launches backend + frontend)
│   ├── main.js           # Electron main process
│   ├── preload.js        # Bridge between Electron and React
│   └── package.json      # Electron dependencies
├── build/                # PyInstaller output (generated, gitignored)
├── installer/            # Installer configs (future)
└── pyinstaller.spec      # PyInstaller bundling spec
```

## Quick Start (Development)

### 1. Start the Desktop Backend
```bash
cd desktop/backend
python desktop_main.py
```

### 2. Start the Frontend (in a separate terminal)
```bash
cd client
npm run dev
```

The frontend will connect to `http://localhost:8000` by default.

## How It Works

The `desktop_main.py` script:
1. Sets environment variables to force Desktop Mode
2. Adds the `server/` directory to Python's `sys.path`
3. Monkey-patches the auth dependency so Clerk is never imported
4. Launches FastAPI with uvicorn on a dynamic port

No changes to the original `server/` or `client/` code are required.
