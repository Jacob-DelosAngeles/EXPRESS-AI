from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any, Union
import os
import pandas as pd
import json
from sqlalchemy.orm import Session
from pydantic import BaseModel
from io import BytesIO
from datetime import datetime

from models.upload import UploadModel
from models.user import UserModel
from core.database import get_db
from core.clerk_auth import get_current_user  # Clerk auth
from core import security  # Keep for backwards compatibility
from core.config import settings
from utils.file_handler import FileHandler

router = APIRouter()
file_handler = FileHandler()

class PavementSegment(BaseModel):
    points: List[List[float]] # [[lat, lon], [lat, lon]]
    type: str
    color: str
    start_time: Optional[Any] = None
    end_time: Optional[Any] = None

class PavementProcessResponse(BaseModel):
    success: bool
    filename: str
    count: int
    data: List[PavementSegment]
    from_cache: Optional[bool] = False

@router.get("/process/{filename}", response_model=PavementProcessResponse)
async def process_pavement_data(
    filename: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Process a pavement type CSV file and return map-ready segments.
    Uses shared data model (all users see all pavement data).
    Includes caching for instant retrieval after first processing.
    """
    # 1. Find the file in the database (SHARED DATA MODEL - no user_id filter)
    upload_record = db.query(UploadModel).filter(
        UploadModel.category == 'pavement',
        UploadModel.file_type == 'csv',
        (UploadModel.filename == filename) | (UploadModel.original_filename == filename)
    ).order_by(UploadModel.upload_date.desc()).first()

    if not upload_record:
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")

    # 2. Check cache first (INSTANT return if available)
    if upload_record.cached_data:
        try:
            cached_response = json.loads(upload_record.cached_data)
            cached_response['from_cache'] = True
            return cached_response
        except json.JSONDecodeError:
            # Invalid cache, will reprocess
            pass

    try:
        # 3. Get file content from storage (works for both local and R2)
        content_bytes = file_handler.storage.get_file_content(upload_record.storage_path)
        df = pd.read_csv(BytesIO(content_bytes))
        
        # Normalize column names
        df.columns = [c.lower() for c in df.columns]
        
        # Check required columns
        # 'type' is strict, but coordinates can vary
        if 'type' not in df.columns:
             raise ValueError("Missing 'type' column")
             
        if 'lat' in df.columns: df.rename(columns={'lat': 'latitude'}, inplace=True)
        if 'lon' in df.columns: df.rename(columns={'lon': 'longitude'}, inplace=True)
        
        if 'latitude' not in df.columns or 'longitude' not in df.columns:
             raise ValueError("Missing latitude/longitude columns")

        # Smart Type Normalization (Accept multiple naming conventions)
        TYPE_NORMALIZE = {
            'flexible': 'Asphalt', 'asphalt': 'Asphalt',
            'rigid': 'Concrete', 'concrete': 'Concrete',
            'gravel': 'Gravel',
            'soil': 'Soil',
            'unpaved': 'Unpaved'
        }
        
        # Color Map for Map Lines
        COLOR_MAP = {
            'Asphalt': '#2F2F2F',   # Dark Grey
            'Concrete': '#FFFFFF',  # White
            'Gravel': '#D3D3D3',    # Light Grey
            'Soil': '#8B4513',      # Brown
            'Unpaved': '#000000'    # Black
        }
        
        segments = []
        if len(df) < 2:
            return {
                "success": True,
                "filename": filename,
                "count": 0,
                "data": [],
                "from_cache": False
            }
            
        current_type = None
        current_points = []
        
        # Logic to group consecutive points
        segment_start_time = None
        current_end_time = None

        for _, row in df.iterrows():
            # Normalize type name
            raw_type = str(row['type']).lower()
            p_type = TYPE_NORMALIZE.get(raw_type, raw_type.title())
            lat = float(row['latitude'])
            lon = float(row['longitude'])
            
            # Extract timestamp
            timestamp = None
            if 'timestamp' in row:
                timestamp = row['timestamp']
            elif 'time' in row:
                timestamp = row['time']

            # Set start time for new segment
            if not current_points:
                segment_start_time = timestamp
            
            current_end_time = timestamp

            # If type changes, save segment
            if current_type is not None and p_type != current_type:
                if len(current_points) >= 2:
                    segments.append({
                        "points": current_points,
                        "type": current_type,
                        "color": COLOR_MAP.get(current_type, '#808080'),
                        "start_time": str(segment_start_time) if segment_start_time else None,
                        "end_time": str(current_end_time) if current_end_time else None
                    })
                current_points = []
                segment_start_time = timestamp # Reset start time for next segment containing this point
                
            current_points.append([lat, lon])
            current_type = p_type
        
        # Add final segment
        if len(current_points) >= 2:
            segments.append({
                "points": current_points,
                "type": current_type,
                "color": COLOR_MAP.get(current_type, '#808080'),
                "start_time": str(segment_start_time) if segment_start_time else None,
                "end_time": str(current_end_time) if current_end_time else None
            })

        response_data = {
            "success": True,
            "filename": filename,
            "count": len(segments),
            "data": segments,
            "from_cache": False
        }

        # 4. Cache the result for instant future retrieval
        try:
            upload_record.cached_data = json.dumps(response_data)
            upload_record.cache_timestamp = datetime.utcnow()
            db.commit()
        except Exception as cache_err:
            # Non-fatal, just log
            print(f"Failed to cache pavement data: {cache_err}")

        return response_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing CSV: {str(e)}")


