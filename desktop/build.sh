#!/usr/bin/env bash
#
# Express-AI Desktop — Full Build Script
#
# This script builds the complete desktop application:
#   1. Builds the React frontend (Vite)
#   2. Bundles the Python backend (PyInstaller)
#   3. Packages everything into an installer (Electron Builder)
#
# Prerequisites:
#   - Node.js 18+
#   - Python 3.10+ with pip
#   - PyInstaller (pip install pyinstaller)
#
# Usage:
#   chmod +x desktop/build.sh
#   ./desktop/build.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "============================================"
echo " EXPRESS-AI Desktop Build"  
echo "============================================"
echo ""

# ─── Step 1: Build React Frontend ───────────────────────
echo "▶ Step 1/3: Building React frontend..."
cd "$PROJECT_ROOT/client"
npm ci
npm run build
echo "✓ Frontend built → client/dist/"
echo ""

# ─── Step 2: Bundle Python Backend ──────────────────────
echo "▶ Step 2/3: Bundling Python backend with PyInstaller..."
cd "$PROJECT_ROOT/desktop"

# Install PyInstaller if not present
pip install pyinstaller 2>/dev/null || true

pyinstaller pyinstaller.spec --clean --noconfirm
echo "✓ Backend bundled → desktop/dist/express-server/"
echo ""

# ─── Step 3: Package Electron App ───────────────────────
echo "▶ Step 3/3: Packaging Electron installer..."
cd "$PROJECT_ROOT/desktop/electron"
npm ci
npm run build:win
echo "✓ Installer created → desktop/dist/electron/"
echo ""

echo "============================================"
echo " Build complete!"
echo "============================================"
echo ""
echo "Output:"
echo "  Installer: desktop/dist/electron/EXPRESS-AI Setup *.exe"
echo ""
