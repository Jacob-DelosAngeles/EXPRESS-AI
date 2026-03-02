# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for Express-AI Desktop Backend

This bundles the FastAPI server + all dependencies into a single
distributable folder or executable.

Usage:
    cd desktop/
    pyinstaller pyinstaller.spec
    
Output:
    desktop/dist/express-server/    (folder with express-server.exe + dependencies)
"""

import os
import sys
from pathlib import Path

# Resolve paths
# NOTE: SPECPATH is already the directory containing pyinstaller.spec (i.e. desktop/)
# Do NOT wrap it in os.path.dirname() — that would go up one extra level to the project root.
DESKTOP_DIR = os.path.abspath(SPECPATH if 'SPECPATH' in dir() else '.')
PROJECT_ROOT = os.path.dirname(DESKTOP_DIR)
SERVER_DIR = os.path.join(PROJECT_ROOT, 'server')


block_cipher = None

# Collect all server source files
server_datas = []
for root, dirs, files in os.walk(SERVER_DIR):
    # Skip __pycache__, venv, uploads, .env files
    dirs[:] = [d for d in dirs if d not in ('__pycache__', 'venv', 'uploads', '.git', 'scripts')]
    for f in files:
        if f.endswith(('.py', '.json', '.csv', '.pt', '.onnx', '.yaml', '.yml')):
            src = os.path.join(root, f)
            # Destination is relative to server/
            dst = os.path.relpath(os.path.dirname(src), PROJECT_ROOT)
            server_datas.append((src, dst))

# Include the desktop backend modules
desktop_backend = os.path.join(DESKTOP_DIR, 'backend')

a = Analysis(
    [os.path.join(desktop_backend, 'desktop_main.py')],
    pathex=[SERVER_DIR, desktop_backend],
    binaries=[],
    datas=server_datas + [
        # Include .env.example as reference (user creates their own)
        (os.path.join(SERVER_DIR, '.env.example'), 'server'),
    ],
    hiddenimports=[
        # FastAPI / Uvicorn
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'fastapi',
        'starlette',
        'pydantic',
        
        # Database
        'sqlalchemy',
        'sqlalchemy.dialects.sqlite',
        'sqlite3',
        
        # Data processing
        'pandas',
        'numpy',
        'scipy',
        'scipy.signal',
        'scipy.interpolate',
        
        # Image processing
        'cv2',
        
        # Server modules (ensure they're found)
        'core',
        'core.config',
        'core.database',
        'core.clerk_auth',
        'core.security',
        'api',
        'api.v1',
        'api.v1.endpoints',
        'api.v1.endpoints.auth',
        'api.v1.endpoints.upload',
        'api.v1.endpoints.iri',
        'api.v1.endpoints.pothole',
        'api.v1.endpoints.vehicle',
        'api.v1.endpoints.pavement',
        'api.v1.endpoints.presign',
        'models',
        'models.user',
        'models.upload',
        'models.iri_models',
        'models.mapping_models',
        'services',
        'services.storage_service',
        'services.iri_service',
        'services.iri_lite',
        'services.iri_calculator_logic',
        'services.mapping_service',
        'utils',
        'utils.file_handler',
        'iri_calculator',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude cloud-only packages to reduce size
        'boto3',
        'botocore',
        's3transfer',
        'httpx',          # Used by Clerk only
        'psycopg2',       # PostgreSQL driver
        'gunicorn',       # Unix-only production server
        # Exclude heavy packages not needed in desktop
        'matplotlib',     # Only used for chart generation (not needed offline)
        'tkinter',        # GUI toolkit pulled in by matplotlib
        '_tkinter',
        'tcl',
        'tk',
        'PIL',            # Pillow (matplotlib dep, we use cv2 instead)
        'tornado',        # Jupyter/notebook dependency
        'notebook',
        'IPython',
        'jedi',
        'pygments',
        'setuptools',
        'pip',
        'distutils',
        'unittest',
        'test',
        'pydoc_data',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='express-server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # Console app so we can read stdout for port
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='express-server',
)
