from fastapi import APIRouter, HTTPException, Depends
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any
import io
from functools import lru_cache
import pandas as pd
import os
from pathlib import Path
import math
import logging
import json
from datetime import datetime

logger = logging.getLogger(__name__)
from core.config import settings
from utils.file_handler import FileHandler

from models.upload import UploadModel
from models.user import UserModel
from core.database import get_db
from core.clerk_auth import get_current_user  # Clerk auth
from core import security  # Keep for backwards compatibility
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

router = APIRouter()
file_handler = FileHandler()

@router.get("/process/{filename}", response_model=Dict[str, Any])
async def process_pothole_data(
    filename: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Process an uploaded pothole detection CSV file.
    Returns a list of pothole markers with popup HTML.
    Uses caching for fast repeat requests.
    - All users can view shared data (read-only for non-admins)
    """
    # Find the file in the database - ALL users see shared data
    upload_record = db.query(UploadModel).filter(
        UploadModel.category == 'pothole', 
        UploadModel.file_type == 'csv',
        (UploadModel.filename == filename) | (UploadModel.original_filename == filename)
    ).order_by(UploadModel.upload_date.desc()).first()
    
    if not upload_record:
        raise HTTPException(status_code=404, detail=f"File record not found for: {filename}")
    
    # ============================================
    # CACHE CHECK - Return cached data if available
    # We regenerate presigned URLs since they expire after 1 hour
    # ============================================
    if upload_record.cached_data:
        try:
            cached_response = json.loads(upload_record.cached_data)
            
            # Check if cache has storage_path (new format) - invalidate old caches
            if cached_response.get('data') and len(cached_response['data']) > 0:
                first_marker = cached_response['data'][0]
                if not first_marker.get('storage_path'):
                    # Old cache format without storage_path - need to re-process
                    logger.info(f"Invalidating old cache for {filename} (missing storage_path)")
                    upload_record.cached_data = None
                    db.commit()
                else:
                    # Regenerate presigned URLs for all markers (they expire after 1 hour)
                    for marker in cached_response['data']:
                        storage_path = marker.get('storage_path')
                        if storage_path:
                            # Regenerate fresh presigned URL
                            fresh_url = file_handler.storage.get_file_url(storage_path)
                            old_url = marker.get('_cached_url', '')
                            marker['image_url'] = fresh_url
                            # Also update popup_html with fresh URL
                            if old_url and old_url in marker.get('popup_html', ''):
                                marker['popup_html'] = marker['popup_html'].replace(old_url, fresh_url)
                    
                    logger.info(f"Returning cached pothole data for {filename} (regenerated URLs)")
                    return cached_response
        except json.JSONDecodeError:
            # Invalid cache, proceed to re-process
            pass
    
    try:
        # Use the storage path from the record
        path_to_read = upload_record.storage_path

        # Get content using storage service (works for Local and R2)
        content_bytes = file_handler.storage.get_file_content(path_to_read)
        
        from io import BytesIO
        df = pd.read_csv(BytesIO(content_bytes))
        
        # Validate columns
        required_columns = ['latitude', 'longitude', 'image_path', 'confidence_score']
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            raise HTTPException(status_code=400, detail=f"Missing columns: {missing_cols}")
        
        # 2. Fetch all pothole image records to create a filename -> storage_path map
        # For shared data model, we need images from the same user who uploaded the CSV
        file_owner_id = upload_record.user_id
        image_records = db.query(UploadModel).filter(
            UploadModel.user_id == file_owner_id,
            UploadModel.category == 'pothole',
            UploadModel.file_type.in_(['jpg', 'jpeg', 'png']) 
        ).all()
        
        # Create lookup dictionary: original_filename -> storage_path
        # Use simple filename (basename) for matching just in case
        image_map = {rec.original_filename: rec.storage_path for rec in image_records}
        
        markers_data = []
        
        for idx, row in df.iterrows():
            try:
                lat = float(row['latitude'])
                lon = float(row['longitude'])
                
                if math.isnan(lat) or math.isnan(lon):
                    continue
                    
                image_path = row['image_path'] # e.g. "frame_11030.jpg"
                confidence = float(row['confidence_score'])
                
                # Extract timestamp (case-insensitive check)
                timestamp = None
                # Normalize keys to lowercase for checking
                row_keys_lower = {k.lower(): k for k in row.keys()}
                
                if 'timestamp' in row_keys_lower:
                    timestamp = row[row_keys_lower['timestamp']]
                elif 'time' in row_keys_lower:
                    timestamp = row[row_keys_lower['time']]
                elif 'date' in row_keys_lower:
                    timestamp = row[row_keys_lower['date']]
                

                # Generate direct R2 URL (Presigned) to bypass backend proxy and save memory
                storage_path = image_map.get(image_path)
                
                if not storage_path:
                    # Fallback: If image not in DB (CSV-only upload), try to guess the path
                    # Standard path: user_id/pothole/filename
                    # Note: We can't know for sure if it was renamed (e.g. _1), but this works for clean states
                    storage_path = f"{file_owner_id}/pothole/{image_path}"
                
                # Generate URL using the storage service (generates presigned URL for R2)
                image_url = file_handler.storage.get_file_url(storage_path)
                
                # Create popup HTML (mirrored from streamlit_app.py)
                popup_html = f"""
                <div style="text-align: center; min-width: 250px; font-family: Arial, sans-serif;">
                    <h4 style="margin: 0 0 10px 0; color: #2c3e50;">🚧 Pothole Detection</h4>
                    <p style="margin: 5px 0;"><strong>Confidence:</strong> {confidence:.2%}</p>
                    <p style="margin: 5px 0; font-size: 12px; color: #666;">{image_path}</p>
                    
                    <div style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
                        <a href="{image_url}" target="_blank">
                            <img src="{image_url}" 
                                 style="width: 200px; height: auto; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer;" 
                                 onerror="this.style.display='none'; this.parentElement.nextElementSibling.style.display='block';"
                                 alt="Pothole Detection Image">
                        </a>
                        <div style="display: none; color: #e74c3c; font-size: 12px; padding: 10px;">
                            ❌ Image failed to load<br>
                            <a href="{image_url}" target="_blank" style="color: #007bff; text-decoration: none; font-size: 10px;">Click here to view image</a>
                        </div>
                    </div>
                    
                    <p style="margin: 5px 0; font-size: 10px; color: #999;">
                        <a href="{image_url}" target="_blank" style="color: #007bff; text-decoration: none;">View full image in new tab</a>
                    </p>
                </div>
                """
                
                markers_data.append({
                    'lat': lat,
                    'lon': lon,
                    'popup_html': popup_html,
                    'tooltip': f"Pothole Detection ({confidence:.1%})",
                    'confidence': confidence,
                    'image_path': image_path,
                    'image_url': image_url,
                    'storage_path': storage_path,  # Store for URL regeneration from cache
                    '_cached_url': image_url,  # Store original URL for popup replacement
                    'timestamp': timestamp,
                    'id': idx
                })
            except Exception as e:
                logger.debug(f"Error processing pothole row {idx}: {e}")
                continue
        
        response_data = {
            "success": True,
            "data": markers_data,
            "count": len(markers_data)
        }
        
        # ============================================
        # CACHE STORE - Save processed data for future requests
        # ============================================
        try:
            upload_record.cached_data = json.dumps(response_data)
            upload_record.cache_timestamp = datetime.utcnow()
            db.commit()
            logger.info(f"Cached pothole data for {filename} ({len(markers_data)} markers)")
        except Exception as cache_err:
            logger.warning(f"Failed to cache data: {cache_err}")
            # Don't fail the request if caching fails
        
        return response_data

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@router.get("/image/{filename}")
def get_pothole_image(
    filename: str,
    db: Session = Depends(get_db)
):
    """
    Legacy Proxy: serve by filename lookup (DB dependent).
    """
    try:
        # 1. Find the file record 
        image_record = db.query(UploadModel).filter(
            UploadModel.category == 'pothole',
            UploadModel.original_filename == filename
        ).first()

        if not image_record:
            raise HTTPException(status_code=404, detail="Image not found in DB")

        # 2. Stream content
        file_stream = file_handler.storage.get_file_stream(image_record.storage_path)
        
        headers = {"Cache-Control": "public, max-age=31536000, immutable"}
        return StreamingResponse(file_stream, media_type="image/jpeg", headers=headers)

    except Exception as e:
        logger.error(f"Error serving image proxy {filename}: {e}")
        raise HTTPException(status_code=404, detail="Image not found")

@router.get("/proxy")
def get_image_by_key(
    key: str,
    db: Session = Depends(get_db)
):
    """
    Direct Proxy: serve by storage key (storage_path).
    Required for reports where we know the exact path but might not have a clean DB record per file.
    """
    try:
        # Security: basic check to prevent directory traversal or accessing abuse
        if ".." in key or key.startswith("/"):
            raise HTTPException(status_code=400, detail="Invalid key format")
            
        # Stream directly from storage provider (R2/Local)
        file_stream = file_handler.storage.get_file_stream(key)
        
        headers = {"Cache-Control": "public, max-age=31536000, immutable"}
        return StreamingResponse(file_stream, media_type="image/jpeg", headers=headers)
        
    except Exception as e:
        logger.error(f"Error proxying key {key}: {e}")
        raise HTTPException(status_code=404, detail="File not found")
