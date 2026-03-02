"""
Desktop Configuration Overrides for Express-AI

This module patches the server's `core.config.settings` object
to force Desktop Mode before any server code is imported.

It MUST be called before importing anything from `server/`.
"""

import os
import sys
from pathlib import Path


def get_desktop_data_dir() -> Path:
    """
    Get the platform-appropriate data directory for Express-AI.
    
    Windows: %USERPROFILE%/.express-ai/
    macOS:   ~/Library/Application Support/express-ai/
    Linux:   ~/.local/share/express-ai/
    """
    if sys.platform == "win32":
        base = Path(os.environ.get("USERPROFILE", os.path.expanduser("~")))
        return base / ".express-ai"
    elif sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "express-ai"
    else:
        return Path.home() / ".local" / "share" / "express-ai"


def apply_desktop_overrides():
    """
    Set environment variables to force Desktop Mode.
    
    This must be called BEFORE the server's config.py is imported,
    because `Settings` reads from os.environ at class definition time.
    """
    data_dir = get_desktop_data_dir()
    
    # Ensure directories exist
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "storage").mkdir(exist_ok=True)
    (data_dir / "db").mkdir(exist_ok=True)
    
    db_path = data_dir / "db" / "express_ai.db"
    storage_path = data_dir / "storage"
    
    # --- Force Desktop Mode via Environment Variables ---
    
    # 1. Database: Use SQLite (no PostgreSQL dependency)
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    
    # 2. Storage: Use local filesystem (no R2/S3)
    os.environ["STORAGE_MODE"] = "local"
    
    # 3. Auth: Signal desktop mode (used by desktop_auth.py)
    os.environ["DEPLOYMENT_MODE"] = "desktop"
    
    # 4. Security: Generate a local-only secret key
    os.environ["SECRET_KEY"] = "desktop-local-mode-no-external-access"
    
    # 5. CORS: Allow the Electron app's origin
    os.environ["CORS_ORIGINS"] = (
        "http://localhost:5173,"
        "http://localhost:5174,"
        "http://localhost:3000,"
        "http://127.0.0.1:5173,"
        "app://."  # Electron's default origin
    )
    
    # 6. Backend URL
    os.environ["BACKEND_URL"] = "http://localhost:8000"
    
    return {
        "data_dir": str(data_dir),
        "db_path": str(db_path),
        "storage_path": str(storage_path),
    }
