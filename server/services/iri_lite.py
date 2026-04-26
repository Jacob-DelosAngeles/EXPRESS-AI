"""
Lightweight IRI Processor for memory-constrained environments.
Processes IRI data in chunks and returns only map-essential data.
"""

import pandas as pd
import numpy as np
from scipy import signal
from scipy.integrate import cumulative_trapezoid
import gc
import logging

logger = logging.getLogger(__name__)


def get_iri_color(iri_value: float) -> str:
    """Get color for IRI value (for map rendering)."""
    if iri_value <= 3:
        return '#16a34a'  # Green - Good
    elif iri_value <= 5:
        return '#facc15'  # Yellow - Fair
    elif iri_value <= 7:
        return '#f97316'  # Orange - Poor
    else:
        return '#dc2626'  # Red - Bad


def process_iri_chunked(file_obj, segment_length: int = 100, chunk_size: int = 10000):
    """
    Process IRI data in chunks to minimize memory usage.
    Returns only map-essential data (lat, lon, iri, color).
    
    Args:
        file_obj: File-like object or path to CSV
        segment_length: Distance per segment in meters
        chunk_size: Number of rows to process at a time
        
    Returns:
        dict with segments ready for map rendering
    """
    logger.info("Starting chunked IRI processing...")
    
    try:
        # Read CSV in chunks for large files
        # First, get total row count and column info
        df_peek = pd.read_csv(file_obj, nrows=5)
        file_obj.seek(0)  # Reset to beginning
        
        # Check required columns
        required_cols = ['time', 'ax', 'ay', 'az']
        missing_cols = [col for col in required_cols if col not in df_peek.columns]
        if missing_cols:
            return {
                'success': False,
                'message': f'Missing required columns: {missing_cols}',
                'segments': []
            }
        
        has_gps = all(col in df_peek.columns for col in ['latitude', 'longitude', 'speed'])
        
        # For IRI calculation, we need the whole file but process segments one by one
        # Load with only essential columns
        usecols = ['time', 'ax', 'ay', 'az']
        if has_gps:
            usecols.extend(['latitude', 'longitude', 'speed'])
        
        logger.info(f"Loading CSV with columns: {usecols}")
        df = pd.read_csv(file_obj, usecols=usecols)
        logger.info(f"Loaded {len(df)} rows")
        
        # Preprocess time - Handle multiple formats:
        # 1. Numeric seconds (already float/int dtype)
        # 2. Numeric seconds as strings ("0.000", "0.010", ...)
        # 3. ISO datetime strings ("2026-01-30T08:00:00" or "2026-01-30T08:00:00Z")
        logger.info(f"Pandas version: {pd.__version__}")
        time_col = df['time']
        logger.info(f"Time column dtype: {time_col.dtype}, first value: {time_col.iloc[0]}")
        
        # Try to convert to numeric first (handles both numeric dtype AND numeric strings)
        time_numeric = pd.to_numeric(time_col, errors='coerce')
        numeric_ratio = time_numeric.notna().sum() / len(time_numeric)
        logger.info(f"Numeric conversion success ratio: {numeric_ratio:.2%}")
        
        if numeric_ratio > 0.9:
            # 90%+ values are numeric - use as elapsed seconds
            df['time'] = time_numeric
            df['time'] = df['time'] - df['time'].iloc[0]
            logger.info("Time format: Numeric seconds (direct or from string)")
        else:
            # Fallback to ISO datetime string parsing
            try:
                # Check if timestamps have timezone indicator (Z or +00:00)
                first_val = str(time_col.iloc[0])
                if 'Z' in first_val or '+' in first_val or '-' in first_val[10:]:  # Avoid matching date dashes
                    # Timezone-aware: use utc=True for consistent parsing
                    parsed = pd.to_datetime(df['time'], utc=True)
                    logger.info("Time format: ISO datetime string (timezone-aware, using UTC)")
                else:
                    # Naive datetime
                    parsed = pd.to_datetime(df['time'])
                    logger.info("Time format: ISO datetime string (naive)")
                
                # Convert to elapsed seconds using explicit epoch subtraction
                # This is the most reliable method across pandas versions
                epoch = pd.Timestamp('1970-01-01', tz='UTC') if parsed.dt.tz else pd.Timestamp('1970-01-01')
                df['time'] = (parsed - epoch).dt.total_seconds()
                df['time'] = df['time'] - df['time'].iloc[0]
                logger.info(f"Parsed time range: {df['time'].min():.2f}s to {df['time'].max():.2f}s")
            except Exception as e:
                logger.error(f"Time parsing failed: {e}")
                return {'success': False, 'message': 'Failed to parse time column', 'segments': []}
        
        # Convert columns to numeric
        for col in ['ax', 'ay', 'az']:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        if has_gps:
            for col in ['latitude', 'longitude', 'speed']:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # Drop NaN rows
        df = df.dropna(subset=['time', 'ax', 'ay', 'az'])
        df = df.sort_values('time').reset_index(drop=True)
        
        if len(df) < 100:
            return {
                'success': False,
                'message': 'Insufficient data points',
                'segments': []
            }
        
        # Compute sampling rate
        time_diff = np.diff(df['time'].values)
        median_diff = np.median(time_diff)
        sampling_rate = 1.0 / median_diff if median_diff > 0 else 0
        
        # Debug logging for production investigation
        logger.info(f"Time column first 5 values: {df['time'].head(5).tolist()}")
        logger.info(f"Time diff first 5 values: {time_diff[:5].tolist() if len(time_diff) >= 5 else time_diff.tolist()}")
        logger.info(f"Median time diff: {median_diff:.8f} seconds")
        logger.info(f"Sampling rate: {sampling_rate:.2f} Hz")
        
        # Filter accelerometer data (use az as vertical)
        cutoff_freq = 10
        nyquist = sampling_rate / 2
        if cutoff_freq >= nyquist:
            cutoff_freq = nyquist * 0.9
        
        b, a = signal.butter(4, cutoff_freq / nyquist, btype='low')
        az_filtered = signal.filtfilt(b, a, df['az'].values)
        
        # Remove gravity component
        vertical_accel = az_filtered - np.mean(az_filtered)
        
        # Get speed
        if has_gps and 'speed' in df.columns:
            speed = df['speed'].values
        else:
            speed = np.full(len(df), 15.0)  # Default 15 m/s
        
        # Calculate distance
        time_array = df['time'].values
        distance = cumulative_trapezoid(speed, time_array, initial=0)
        
        # Process segments (at the requested segment_length for IRI calculation)
        segments = []
        max_distance = distance[-1]
        
        logger.info(f"Total distance: {max_distance:.2f}m, creating segments of {segment_length}m")
        
        # Inclusive loop: create at least one segment even for short files
        for start_dist in np.arange(0, max_distance, segment_length):
            end_dist = min(start_dist + segment_length, max_distance)
            
            # Skip tiny trailing fragments (<2m) unless it's the only segment
            if (end_dist - start_dist < 2.0) and len(segments) > 0:
                continue
            
            # Find indices
            start_idx = np.argmin(np.abs(distance - start_dist))
            end_idx = np.argmin(np.abs(distance - end_dist))
            
            if end_idx <= start_idx:
                # Expand by 1 if possible
                if end_idx < len(distance) - 1:
                    end_idx += 1
                else:
                    continue
            
            # Calculate IRI for segment - SPEED-AWARE VERSION
            segment_accel = vertical_accel[start_idx:end_idx]
            segment_speed = speed[start_idx:end_idx]
            
            rms_accel = np.sqrt(np.mean(segment_accel ** 2))
            mean_speed_val = np.mean(segment_speed)
            
            # Speed-aware IRI constants (must match iri_calculator_logic.py)
            K = 80.59           # Calibration constant
            MIN_VALID_SPEED = 5.0   # m/s (~18 km/h)
            REFERENCE_SPEED = 10.0  # m/s (~36 km/h)
            SPEED_EXPONENT = 0.9    # Damped exponent (was 1.0)
            MAX_IRI_CAP = 16.0      # m/km cap for low-speed
            
            # Speed-aware IRI calculation
            if mean_speed_val >= MIN_VALID_SPEED:
                iri_value = K * rms_accel / (mean_speed_val ** SPEED_EXPONENT)
                speed_flag = 'normal'
            elif mean_speed_val > 0:
                extrapolated_iri = K * rms_accel / (REFERENCE_SPEED ** SPEED_EXPONENT)
                iri_value = min(extrapolated_iri, MAX_IRI_CAP)
                speed_flag = 'low_speed'
            else:
                iri_value = 0
                speed_flag = 'stopped'
            
            # Get GPS coordinates
            start_lat, start_lon, end_lat, end_lon = None, None, None, None
            if has_gps:
                start_lat = float(df.iloc[start_idx]['latitude'])
                start_lon = float(df.iloc[start_idx]['longitude'])
                end_lat = float(df.iloc[end_idx - 1]['latitude'])
                end_lon = float(df.iloc[end_idx - 1]['longitude'])
            
            segments.append({
                'segment_id': len(segments) + 1,
                'start_lat': start_lat,
                'start_lon': start_lon,
                'end_lat': end_lat,
                'end_lon': end_lon,
                'iri_value': round(iri_value, 2),
                'color': get_iri_color(iri_value),
                'mean_speed': round(mean_speed_val, 2),
                'speed_flag': speed_flag,
                'distance_start': round(start_dist, 1),
                'distance_end': round(end_dist, 1),
                # Store indices for display subdivision
                '_start_idx': int(start_idx),
                '_end_idx': int(end_idx),
            })
        
        # ================================================================
        # Generate 25m display sub-segments from each calculation segment
        # Each display segment inherits the parent's IRI value and color
        # ================================================================
        DISPLAY_LENGTH = 25  # Always 25m for map display
        display_segments = []
        
        for seg in segments:
            seg_start_dist = seg['distance_start']
            seg_end_dist = seg['distance_end']
            seg_start_idx = seg['_start_idx']
            seg_end_idx = seg['_end_idx']
            
            # Subdivide this calculation segment into 25m display chunks
            for sub_start in np.arange(seg_start_dist, seg_end_dist, DISPLAY_LENGTH):
                sub_end = min(sub_start + DISPLAY_LENGTH, seg_end_dist)
                
                # Skip tiny trailing fragments (<2m)
                if (sub_end - sub_start) < 2.0 and len(display_segments) > 0:
                    continue
                
                # Find GPS indices for this display chunk
                sub_start_idx = np.argmin(np.abs(distance - sub_start))
                sub_end_idx = np.argmin(np.abs(distance - sub_end))
                
                # Clamp to parent segment bounds
                sub_start_idx = max(sub_start_idx, seg_start_idx)
                sub_end_idx = min(sub_end_idx, seg_end_idx)
                
                if sub_end_idx <= sub_start_idx:
                    if sub_end_idx < len(distance) - 1:
                        sub_end_idx = sub_start_idx + 1
                    else:
                        continue
                
                sub_start_lat, sub_start_lon = None, None
                sub_end_lat, sub_end_lon = None, None
                if has_gps:
                    sub_start_lat = float(df.iloc[sub_start_idx]['latitude'])
                    sub_start_lon = float(df.iloc[sub_start_idx]['longitude'])
                    actual_end = min(sub_end_idx, len(df) - 1)
                    sub_end_lat = float(df.iloc[actual_end]['latitude'])
                    sub_end_lon = float(df.iloc[actual_end]['longitude'])
                
                display_segments.append({
                    'start_lat': sub_start_lat,
                    'start_lon': sub_start_lon,
                    'end_lat': sub_end_lat,
                    'end_lon': sub_end_lon,
                    'iri_value': seg['iri_value'],       # Inherited from parent
                    'color': seg['color'],               # Inherited from parent
                    'mean_speed': seg['mean_speed'],     # Inherited from parent
                    'speed_flag': seg['speed_flag'],     # Inherited from parent
                    'parent_segment_id': seg['segment_id'],
                    'distance_start': round(sub_start, 1),
                    'distance_end': round(sub_end, 1),
                })
        
        # Remove internal indices from calculation segments before returning
        for seg in segments:
            seg.pop('_start_idx', None)
            seg.pop('_end_idx', None)
        
        # Cleanup
        del df, vertical_accel, speed, distance, az_filtered
        gc.collect()
        
        logger.info(f"Created {len(segments)} calculation segments, {len(display_segments)} display segments")
        
        return {
            'success': True,
            'message': f'Processed {len(segments)} segments',
            'total_segments': len(segments),
            'sampling_rate': round(sampling_rate, 2),
            'segments': segments,
            'display_segments': display_segments,
        }
        
    except Exception as e:
        logger.error(f"IRI processing error: {e}")
        gc.collect()
        return {
            'success': False,
            'message': str(e),
            'segments': []
        }
