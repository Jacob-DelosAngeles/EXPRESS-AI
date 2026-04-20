"""
model_manager.py — YOLO Model Loader & Cache

Loads ultralytics YOLO .pt model files from the desktop models directory
and caches them in memory so they are only loaded once per session.

Models are stored at:
  Production (PyInstaller): <resources>/models/
  Development:              <project_root>/desktop/models/
"""

import sys
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger("express-ai-desktop.model_manager")

# ── Path resolution ────────────────────────────────────────────────────────
def _get_models_dir() -> Path:
    if getattr(sys, "frozen", False):
        # PyInstaller: models/ is placed next to the exe via pyinstaller.spec datas
        exe_dir = Path(sys.executable).resolve().parent
        candidates = [
            exe_dir / "models",
            exe_dir / "_internal" / "models",
        ]
        for p in candidates:
            if p.is_dir():
                return p
        return exe_dir / "models"
    else:
        # Dev mode: desktop/models/
        return Path(__file__).resolve().parent.parent / "models"


MODELS_DIR = _get_models_dir()

# ── In-memory cache ────────────────────────────────────────────────────────
_cache: dict = {}   # model_name → loaded YOLO instance


def load_model(model_name: str):
    """
    Load and cache a YOLO model by name (without .pt extension).
    Returns the YOLO model instance, or None if the file is not found.

    Example:
        model = load_model("pothole")   # loads desktop/models/pothole.pt
    """
    global _cache

    if model_name in _cache:
        return _cache[model_name]

    model_path = MODELS_DIR / f"{model_name}.pt"

    if not model_path.exists():
        logger.warning(
            f"Model file not found: {model_path}. "
            f"Detections for '{model_name}' will be skipped."
        )
        return None

    try:
        from ultralytics import YOLO
        logger.info(f"Loading YOLO model: {model_path}")
        model = YOLO(str(model_path))
        _cache[model_name] = model
        logger.info(f"Model '{model_name}' loaded and cached.")
        return model
    except Exception as e:
        logger.error(f"Failed to load model '{model_name}': {e}")
        return None


def is_model_available(model_name: str) -> bool:
    """Return True if the .pt file exists on disk."""
    return (MODELS_DIR / f"{model_name}.pt").exists()


def list_available_models() -> list[str]:
    """Return names of all .pt files in the models directory."""
    if not MODELS_DIR.is_dir():
        return []
    return [p.stem for p in MODELS_DIR.glob("*.pt")]


def clear_cache():
    """Release all loaded models from memory (e.g. on low-memory signal)."""
    global _cache
    _cache.clear()
    logger.info("Model cache cleared.")
