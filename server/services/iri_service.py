import os
import sys
import time
import pandas as pd
import numpy as np
from typing import Tuple, List, Dict, Any

# Import the local IRI calculator
from services.iri_calculator_logic import IRICalculator
from models.iri_models import IRISegment, IRIComputationResponse, IRIComputationRequest

class IRIService:
    def __init__(self):
        self.calculator = IRICalculator()
    
    async def process_file_and_compute_iri(
        self, 
        file_path: str, 
        request: IRIComputationRequest
    ) -> IRIComputationResponse:
        """
        Process uploaded file and compute IRI values
        """
        start_time = time.time()
        
        try:
            # Load and preprocess data
            df = self.calculator.load_data(file_path)
            if df is None:
                raise ValueError("Failed to load data from file")
            
            processed_df, duration = self.calculator.preprocess_data(df)
            if processed_df is None:
                raise ValueError("Failed to preprocess data")
            
            # Compute IRI values
            iri_values, segments, sampling_rate, speed = self.calculator.calculate_iri_rms_method(
                processed_df,
                segment_length=request.segment_length
            )
            
            # Prepare chart data (downsample if too large)
            # Limit to ~2000 points for performance
            total_rows = len(processed_df)
            step = max(1, total_rows // 2000)
            
            raw_data = []
            filtered_data = []
            
            # Get filtered data for plotting
            df_filtered, _ = self.calculator.filter_accelerometer_data(processed_df)
            vertical_accel = self.calculator.extract_vertical_acceleration(df_filtered)
            
            for i in range(0, total_rows, step):
                row = processed_df.iloc[i]
                raw_data.append({
                    "time": float(row['time']),
                    "ax": float(row['ax']),
                    "ay": float(row['ay']),
                    "az": float(row['az']),
                    "speed": float(row['speed']) if 'speed' in row else 0.0
                })
                
                filtered_data.append({
                    "time": float(df_filtered.iloc[i]['time']),
                    "vertical_accel": float(vertical_accel[i])
                })

            # Convert segments to response format
            iri_segments = []
            has_gps = 'latitude' in processed_df.columns and 'longitude' in processed_df.columns

            # We need distance array for display subdivision
            from scipy.integrate import cumulative_trapezoid
            time_array = processed_df['time'].values
            calc_distance = cumulative_trapezoid(speed, time_array, initial=0)

            for i, (iri_val, segment) in enumerate(zip(iri_values, segments)):
                # Extract coordinates if available
                start_lat, start_lon, end_lat, end_lon = None, None, None, None
                
                start_idx = segment.get('start_index')
                end_idx = segment.get('end_index')
                
                if start_idx is not None and end_idx is not None and has_gps:
                    # Clamp indices to valid range
                    start_idx = max(0, min(start_idx, len(processed_df) - 1))
                    actual_end_idx = max(0, min(end_idx - 1, len(processed_df) - 1))

                    start_lat = float(processed_df.iloc[start_idx]['latitude'])
                    start_lon = float(processed_df.iloc[start_idx]['longitude'])
                    end_lat   = float(processed_df.iloc[actual_end_idx]['latitude'])
                    end_lon   = float(processed_df.iloc[actual_end_idx]['longitude'])

                iri_segments.append(IRISegment(
                    segment_id=i + 1,
                    distance_start=float(segment['distance_start']),
                    distance_end=float(segment['distance_end']),
                    segment_length=float(segment['length']),
                    iri_value=float(iri_val),
                    mean_speed=float(segment['mean_speed']),
                    rms_accel=float(segment['rms_accel']),
                    speed_flag=segment.get('speed_flag', 'normal'),
                    start_lat=start_lat,
                    start_lon=start_lon,
                    end_lat=end_lat,
                    end_lon=end_lon,
                ))

            # ================================================================
            # Generate 25m display sub-segments for map rendering
            # Each display segment inherits the parent's IRI value and color
            # ================================================================
            from services.iri_lite import get_iri_color
            DISPLAY_LENGTH = 25  # Always 25m for map display
            display_segments = []

            for seg in iri_segments:
                seg_start_dist = seg.distance_start
                seg_end_dist = seg.distance_end

                for sub_start in np.arange(seg_start_dist, seg_end_dist, DISPLAY_LENGTH):
                    sub_end = min(sub_start + DISPLAY_LENGTH, seg_end_dist)

                    # Skip tiny trailing fragments
                    if (sub_end - sub_start) < 2.0 and len(display_segments) > 0:
                        continue

                    sub_start_lat, sub_start_lon = None, None
                    sub_end_lat, sub_end_lon = None, None

                    if has_gps:
                        sub_s_idx = int(np.argmin(np.abs(calc_distance - sub_start)))
                        sub_e_idx = int(np.argmin(np.abs(calc_distance - sub_end)))
                        sub_e_idx = max(sub_s_idx + 1, sub_e_idx)
                        sub_e_idx = min(sub_e_idx, len(processed_df) - 1)

                        sub_start_lat = float(processed_df.iloc[sub_s_idx]['latitude'])
                        sub_start_lon = float(processed_df.iloc[sub_s_idx]['longitude'])
                        sub_end_lat = float(processed_df.iloc[sub_e_idx]['latitude'])
                        sub_end_lon = float(processed_df.iloc[sub_e_idx]['longitude'])

                    from models.iri_models import IRIDisplaySegment
                    display_segments.append(IRIDisplaySegment(
                        start_lat=sub_start_lat,
                        start_lon=sub_start_lon,
                        end_lat=sub_end_lat,
                        end_lon=sub_end_lon,
                        iri_value=seg.iri_value,
                        color=get_iri_color(seg.iri_value),
                        mean_speed=seg.mean_speed,
                        speed_flag=seg.speed_flag,
                        parent_segment_id=seg.segment_id,
                        distance_start=round(sub_start, 1),
                        distance_end=round(sub_end, 1),
                    ))
            
            processing_time = time.time() - start_time
            
            return IRIComputationResponse(
                success=True,
                message=f"Successfully computed IRI for {len(iri_segments)} segments",
                total_segments=len(iri_segments),
                segments=iri_segments,
                display_segments=display_segments,
                processing_time=processing_time,
                sampling_rate=float(sampling_rate),
                raw_data=raw_data,
                filtered_data=filtered_data
            )
            
        except Exception as e:
            processing_time = time.time() - start_time
            return IRIComputationResponse(
                success=False,
                message=f"Error processing file: {str(e)}",
                total_segments=0,
                segments=[],
                processing_time=processing_time,
                sampling_rate=0.0
            )
        finally:
            # Force garbage collection to free memory on constrained environments (Render)
            import gc
            if 'df' in locals(): del df
            if 'processed_df' in locals(): del processed_df
            if 'df_filtered' in locals(): del df_filtered
            if 'vertical_accel' in locals(): del vertical_accel
            gc.collect()
    
    async def validate_file_format(self, file_path: str) -> Tuple[bool, str, int]:
        """
        Validate that the uploaded file has the required format for IRI computation
        """
        try:
            df = self.calculator.load_data(file_path)
            if df is None:
                return False, "Failed to load file", 0
            
            # Check for required columns
            required_cols = ['time', 'ax', 'ay', 'az']
            missing_cols = [col for col in required_cols if col not in df.columns]
            
            if missing_cols:
                return False, f"Missing required columns: {missing_cols}", len(df)
            
            # Check if we have enough data
            if len(df) < 10:
                return False, "Insufficient data points (minimum 10 required)", len(df)
            
            return True, "File format is valid", len(df)
            
        except Exception as e:
            return False, f"Error validating file: {str(e)}", 0
    
    async def get_file_preview(self, file_path: str, num_rows: int = 5) -> Dict[str, Any]:
        """
        Get a preview of the uploaded file
        """
        try:
            df = self.calculator.load_data(file_path)
            if df is None:
                return {"error": "Failed to load file"}
            
            preview = {
                "columns": list(df.columns),
                "total_rows": len(df),
                "preview_data": df.head(num_rows).to_dict('records'),
                "data_types": df.dtypes.to_dict()
            }
            
            return preview
            
        except Exception as e:
            return {"error": f"Error getting file preview: {str(e)}"}
