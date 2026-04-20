"""
gps_sync.py — GPS / Sensor Data Synchroniser

Reads the GPS+sensor CSV and builds a fast interpolator that maps
any video timestamp → (latitude, longitude, speed).

Required CSV columns (same as IRICalculator):
    time        — elapsed seconds or ISO datetime string
    latitude    — decimal degrees
    longitude   — decimal degrees
    speed       — m/s

Optional:
    ax, ay, az  — accelerometer (used by IRI, not GPS sync)
    altitude, wx, wy, wz
"""

import logging
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Tuple, Optional

logger = logging.getLogger("express-ai-desktop.gps_sync")


class GPSSyncer:
    """
    Interpolates GPS coordinates for arbitrary video timestamps.

    Usage:
        syncer = GPSSyncer(csv_path)
        lat, lon, speed = syncer.interpolate(video_seconds=12.5)
    """

    def __init__(self, csv_path: str | Path):
        self._load(csv_path)

    def _load(self, csv_path: str | Path):
        df = pd.read_csv(csv_path)

        # ── Resolve time column ────────────────────────────────────────────
        if "time" not in df.columns:
            raise ValueError("GPS CSV must have a 'time' column.")

        time_col = df["time"]
        time_numeric = pd.to_numeric(time_col, errors="coerce")

        if time_numeric.notna().sum() > len(time_numeric) * 0.9:
            # Already numeric seconds
            times = time_numeric.values.astype(float)
        else:
            # ISO datetime strings → elapsed seconds
            parsed = pd.to_datetime(df["time"], utc=True, errors="coerce")
            epoch = pd.Timestamp("1970-01-01", tz="UTC")
            times = (parsed - epoch).dt.total_seconds().values

        times = times - times[0]   # normalise to 0-based elapsed seconds

        # ── Resolve coordinate columns ─────────────────────────────────────
        lat_col = self._find_col(df, ["latitude", "lat"])
        lon_col = self._find_col(df, ["longitude", "lon", "lng"])
        spd_col = self._find_col(df, ["speed", "spd"])

        if not lat_col or not lon_col:
            raise ValueError("GPS CSV must contain latitude and longitude columns.")

        lats = pd.to_numeric(df[lat_col], errors="coerce").values
        lons = pd.to_numeric(df[lon_col], errors="coerce").values
        speeds = (
            pd.to_numeric(df[spd_col], errors="coerce").values
            if spd_col
            else np.zeros(len(times))
        )

        # Drop rows where any key value is NaN
        mask = ~(np.isnan(times) | np.isnan(lats) | np.isnan(lons))
        self._times = times[mask]
        self._lats = lats[mask]
        self._lons = lons[mask]
        self._speeds = speeds[mask]

        self._t_min = float(self._times[0])
        self._t_max = float(self._times[-1])

        logger.info(
            f"GPSSyncer loaded {len(self._times)} GPS points "
            f"({self._t_max:.1f}s of coverage)."
        )

    @staticmethod
    def _find_col(df: pd.DataFrame, candidates: list[str]) -> Optional[str]:
        cols_lower = {c.lower(): c for c in df.columns}
        for c in candidates:
            if c.lower() in cols_lower:
                return cols_lower[c.lower()]
        return None

    def interpolate(self, video_seconds: float) -> Tuple[float, float, float]:
        """
        Return (latitude, longitude, speed) at the given video timestamp.
        Clamps to the GPS coverage range if out of bounds.
        """
        t = np.clip(video_seconds, self._t_min, self._t_max)
        lat = float(np.interp(t, self._times, self._lats))
        lon = float(np.interp(t, self._times, self._lons))
        spd = float(np.interp(t, self._times, self._speeds))
        return lat, lon, spd

    @property
    def duration(self) -> float:
        """Total GPS coverage in seconds."""
        return self._t_max - self._t_min
