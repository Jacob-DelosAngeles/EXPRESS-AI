"""
DAAN-FERN Desktop Mode — Main Entry Point

This script starts the FastAPI server in "Desktop Mode":
  1. Sets environment variables for SQLite + Local Storage
  2. Adds the server/ directory to sys.path
  3. Monkey-patches Clerk auth with a local dummy auth
  4. Starts uvicorn on a dynamic port

Usage:
    python desktop_main.py
    python desktop_main.py --port 9000
"""

import os
import sys
import socket
import signal
import logging
import argparse
from pathlib import Path

# ============================================================
# STEP 0: Determine project paths
# ============================================================
DESKTOP_DIR = Path(__file__).resolve().parent.parent  # desktop/
PROJECT_ROOT = DESKTOP_DIR.parent                     # DAAN-FERN/
SERVER_DIR = PROJECT_ROOT / "server"                   # DAAN-FERN/server/

# ============================================================
# STEP 1: Apply desktop config BEFORE any server imports
# ============================================================
# Add desktop/backend to path so we can import our modules
sys.path.insert(0, str(DESKTOP_DIR / "backend"))

from desktop_config import apply_desktop_overrides
desktop_paths = apply_desktop_overrides()

# ============================================================
# STEP 2: Add server/ to sys.path
# ============================================================
sys.path.insert(0, str(SERVER_DIR))

# Also set working directory to server/ so relative paths work
os.chdir(SERVER_DIR)

# ============================================================
# STEP 3: Override the uploads directory
# ============================================================
# The LocalStorageService uses a relative "uploads" directory by default.
# We need to patch it to use our Desktop data directory.
# We do this by setting the environment variable and patching after import.

# ============================================================
# STEP 4: Configure logging
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("daan-desktop")
logger.info(f"DAAN-FERN Desktop Mode")
logger.info(f"Project root: {PROJECT_ROOT}")
logger.info(f"Server dir:   {SERVER_DIR}")
logger.info(f"Data dir:     {desktop_paths['data_dir']}")
logger.info(f"Database:     {desktop_paths['db_path']}")
logger.info(f"Storage:      {desktop_paths['storage_path']}")


def find_open_port(start=8000, end=8100):
    """Find an available port in a range."""
    for port in range(start, end):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"No open port found between {start}-{end}")


def monkey_patch_auth():
    """
    Replace Clerk auth dependency with desktop dummy auth.
    
    This patches the `get_current_user` function in `core.clerk_auth`
    so that every endpoint using `Depends(get_current_user)` will 
    automatically receive the desktop superuser.
    """
    from desktop_auth import create_desktop_auth_dependency
    import core.clerk_auth as clerk_module
    
    desktop_dep = create_desktop_auth_dependency()
    
    # Patch both the function and the alias
    clerk_module.get_current_user = desktop_dep
    clerk_module.get_current_user_sync = desktop_dep
    
    logger.info("Monkey-patched Clerk auth → Desktop auth (auto-superuser)")


def monkey_patch_storage():
    """
    Patch storage to use the desktop data directory AND serve images
    via a static file mount (so <img> tags work without auth headers).
    """
    import services.storage_service as storage_module
    
    storage_dir = desktop_paths["storage_path"]
    
    # Create a subclass that overrides get_file_url to return HTTP URLs
    # pointing to our static file mount instead of raw filesystem paths.
    class DesktopStorageService(storage_module.LocalStorageService):
        def __init__(self, base_dir, backend_url):
            super().__init__(base_dir=base_dir)
            self._backend_url = backend_url
        
        def get_file_url(self, file_path: str) -> str:
            # Return a URL that the browser can load directly
            # e.g., http://127.0.0.1:8000/static/uploads/1/pothole/frame.jpg
            return f"{self._backend_url}/static/uploads/{file_path}"
    
    # Store the backend URL for later (set after port is determined)
    monkey_patch_storage._DesktopStorageService = DesktopStorageService
    monkey_patch_storage._storage_dir = storage_dir
    monkey_patch_storage._storage_module = storage_module
    
    logger.info(f"Prepared desktop storage → {storage_dir}")


def apply_storage_patch(port, host="127.0.0.1"):
    """
    Finalize the storage patch once we know the port.
    Must be called AFTER port selection but BEFORE app import.
    """
    DesktopStorageService = monkey_patch_storage._DesktopStorageService
    storage_dir = monkey_patch_storage._storage_dir
    storage_module = monkey_patch_storage._storage_module
    
    backend_url = f"http://{host}:{port}"
    
    def desktop_storage_factory():
        return DesktopStorageService(base_dir=storage_dir, backend_url=backend_url)
    
    storage_module.get_storage_service = desktop_storage_factory
    
    logger.info(f"Patched storage URLs → {backend_url}/static/uploads/...")


def mount_static_files(app):
    """
    Mount the desktop storage directory as static files so images
    can be loaded directly by <img> tags without auth headers.
    Only runs in desktop mode (localhost-only, safe).
    """
    from starlette.staticfiles import StaticFiles
    
    storage_dir = desktop_paths["storage_path"]
    app.mount("/static/uploads", StaticFiles(directory=str(storage_dir)), name="desktop-uploads")
    
    logger.info(f"Mounted static files: /static/uploads/ → {storage_dir}")


def main():
    parser = argparse.ArgumentParser(description="DAAN-FERN Desktop Server")
    parser.add_argument("--port", type=int, default=0, 
                        help="Port to run on (0 = auto-detect)")
    parser.add_argument("--host", type=str, default="127.0.0.1",
                        help="Host to bind to (default: localhost only)")
    args = parser.parse_args()
    
    # Find port
    port = args.port if args.port > 0 else find_open_port()
    
    # Apply monkey patches
    monkey_patch_auth()
    monkey_patch_storage()          # Prepares the storage class
    apply_storage_patch(port, args.host)  # Finalizes with correct port
    
    # Print the port on stdout so Electron can read it
    # This is the "sidecar protocol"
    print(f"DAAN_PORT={port}", flush=True)
    
    # Import the actual FastAPI app (AFTER patches are applied)
    from main import app
    
    # Mount static file serving for images
    mount_static_files(app)
    
    # Start uvicorn
    import uvicorn
    
    logger.info(f"Starting DAAN-FERN Desktop on http://{args.host}:{port}")
    
    uvicorn.run(
        app,
        host=args.host,
        port=port,
        log_level="info",
        # No reload in desktop mode for stability
    )


if __name__ == "__main__":
    main()
