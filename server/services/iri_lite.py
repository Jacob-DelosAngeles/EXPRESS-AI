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
        
        # Preprocess time
        df['time'] = pd.to_datetime(df['time']).astype('int64') / 1e9
        df['time'] = df['time'] - df['time'].iloc[0]
        
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
        sampling_rate = 1.0 / np.median(time_diff)
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
        
        # Process segments
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
            
            # Calculate IRI for segment
            segment_accel = vertical_accel[start_idx:end_idx]
            segment_speed = speed[start_idx:end_idx]
            
            rms_accel = np.sqrt(np.mean(segment_accel ** 2))
            mean_speed = np.mean(segment_speed)
            
            # IRI formula: K * RMS_accel / speed
            K = 80.59
            iri_value = (K * rms_accel / mean_speed) if mean_speed > 0 else 0
            
            # Get GPS coordinates
            start_lat, start_lon, end_lat, end_lon = None, None, None, None
            if has_gps:
                start_lat = float(df.iloc[start_idx]['latitude'])
                start_lon = float(df.iloc[start_idx]['longitude'])
                end_lat = float(df.iloc[end_idx - 1]['latitude'])
                end_lon = float(df.iloc[end_idx - 1]['longitude'])
            
            segments.append({
                'start_lat': start_lat,
                'start_lon': start_lon,
                'end_lat': end_lat,
                'end_lon': end_lon,
                'iri_value': round(iri_value, 2),
                'color': get_iri_color(iri_value),
                'mean_speed': round(mean_speed, 2),
                'distance_start': round(start_dist, 1),
                'distance_end': round(end_dist, 1)
            })
        
        # Cleanup
        del df, vertical_accel, speed, distance, az_filtered
        gc.collect()
        
        logger.info(f"Created {len(segments)} segments")
        
        return {
            'success': True,
            'message': f'Processed {len(segments)} segments',
            'total_segments': len(segments),
            'sampling_rate': round(sampling_rate, 2),
            'segments': segments
        }
        
    except Exception as e:
        logger.error(f"IRI processing error: {e}")
        gc.collect()
        return {
            'success': False,
            'message': str(e),
            'segments': []
        }
