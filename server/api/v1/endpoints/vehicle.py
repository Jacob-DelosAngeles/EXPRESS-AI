from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
import os
import pandas as pd
import json
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from pydantic import BaseModel
from io import BytesIO

from models.upload import UploadModel
from models.user import UserModel
from core.database import get_db
from core.clerk_auth import get_current_user  # Clerk auth
from core import security  # Keep for backwards compatibility
from core.config import settings
from utils.file_handler import FileHandler

logger = logging.getLogger(__name__)
router = APIRouter()
file_handler = FileHandler()

class VehicleDetection(BaseModel):
    lat: float
    lon: float
    type: str
    count: int = 1
    timestamp: Optional[Any] = None

class VehicleProcessResponse(BaseModel):
    success: bool
    filename: str
    count: int
    data: List[VehicleDetection]

@router.get("/process/{filename}", response_model=VehicleProcessResponse)
async def process_vehicle_data(
    filename: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Process a vehicle detection CSV file and return map-ready data.
    Uses caching for fast repeat requests.
    - All users can view shared data (read-only for non-admins)
    """
    # Find the file in the database (Strict ID lookup for 100% collision prevention)
    upload_record = None
    if filename.isdigit():
        upload_record = db.query(UploadModel).filter(
            UploadModel.id == int(filename),
            UploadModel.user_id == current_user.id
        ).first()
    
    if not upload_record:
        # Fallback to unique filename (UUID part) ONLY
        upload_record = db.query(UploadModel).filter(
            UploadModel.user_id == current_user.id,
            UploadModel.filename == filename,
            UploadModel.category == 'vehicle'
        ).order_by(UploadModel.upload_date.desc()).first()

    if not upload_record:
        raise HTTPException(status_code=404, detail=f"File not found with identifier: {filename}")

    # ============================================
    # CACHE CHECK - Return cached data if available
    # ============================================
    if upload_record.cached_data:
        try:
            cached_response = json.loads(upload_record.cached_data)
            logger.info(f"Returning cached vehicle data for {filename}")
            return cached_response
        except json.JSONDecodeError:
            # Invalid cache, proceed to re-process
            pass

    try:
        # 2. Get file content from storage (works for both local and R2)
        content_bytes = file_handler.storage.get_file_content(upload_record.storage_path)
        df = pd.read_csv(BytesIO(content_bytes))
        
        # Normalize column names
        df.columns = [c.lower() for c in df.columns]
        
        # Check required columns
        required = ['latitude', 'longitude', 'vehicle_type']
        missing = [c for c in required if c not in df.columns]
        if missing:
            # Try fallback names if specific ones missing
            if 'lat' in df.columns: df.rename(columns={'lat': 'latitude'}, inplace=True)
            if 'lon' in df.columns: df.rename(columns={'lon': 'longitude'}, inplace=True)
            
            # Recheck
            missing = [c for c in required if c not in df.columns]
            if missing:
                raise ValueError(f"Missing columns: {missing}")

        # Filter rows
        valid_types = ['car', 'truck', 'bicycle', 'motorcycle']
        df = df[df['vehicle_type'].isin(valid_types)].copy()
        
        if df.empty:
            return {
                "success": True,
                "filename": filename,
                "count": 0,
                "data": []
            }
        
        # Convert to list of objects
        result_data = []
        for _, row in df.iterrows():
            # Extract timestamp if available
            timestamp = None
            if 'timestamp' in row:
                timestamp = row['timestamp']
            elif 'time' in row:
                timestamp = row['time']

            result_data.append({
                "lat": float(row['latitude']),
                "lon": float(row['longitude']),
                "type": row['vehicle_type'],
                "timestamp": timestamp,
                "count": 1
            })
        
        response_data = {
            "success": True,
            "filename": filename,
            "count": len(result_data),
            "data": result_data
        }

        # ============================================
        # CACHE STORE - Save processed data for future requests
        # ============================================
        try:
            upload_record.cached_data = json.dumps(response_data)
            upload_record.cache_timestamp = datetime.utcnow()
            db.commit()
            logger.info(f"Cached vehicle data for {filename} ({len(result_data)} records)")
        except Exception as cache_err:
            logger.warning(f"Failed to cache data: {cache_err}")
            
        return response_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing CSV: {str(e)}")
