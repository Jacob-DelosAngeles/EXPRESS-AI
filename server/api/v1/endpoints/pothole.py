from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
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

from utils.calibration_utils import RoadCalibrator
from utils.cost_calculator import CostCalculator
from utils.engineering_expert import EngineeringExpert

router = APIRouter()
file_handler = FileHandler()
calibrator = RoadCalibrator()


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
    # 1. Fetch the upload record
    # Visibility rules:
    #   - Users see their OWN uploads + SUPERUSER uploads (global/sample data)
    #   - Admins see their OWN uploads + SUPERUSER uploads
    #   - Superusers see ALL uploads
    
    # Get all superuser IDs for global data visibility
    superuser_ids = [u.id for u in db.query(UserModel.id).filter(UserModel.role == 'superuser').all()]
    
    upload_record = None
    if filename.isdigit():
        upload_record = db.query(UploadModel).filter(
            UploadModel.id == int(filename),
            # User can see: own uploads OR superuser uploads
            ((UploadModel.user_id == current_user.id) | (UploadModel.user_id.in_(superuser_ids)))
        ).first()
        
        # Superuser can see ALL
        if not upload_record and current_user.is_superuser:
            upload_record = db.query(UploadModel).filter(
                UploadModel.id == int(filename)
            ).first()
    
    if not upload_record:
        # Fallback to filename lookup with same visibility rules
        upload_record = db.query(UploadModel).filter(
            UploadModel.filename == filename,
            ((UploadModel.user_id == current_user.id) | (UploadModel.user_id.in_(superuser_ids)))
        ).order_by(UploadModel.upload_date.desc()).first()
        
        # Superuser fallback
        if not upload_record and current_user.is_superuser:
            upload_record = db.query(UploadModel).filter(
                UploadModel.filename == filename
            ).order_by(UploadModel.upload_date.desc()).first()
    
    if not upload_record:
        raise HTTPException(status_code=404, detail=f"File not found with identifier: {filename}")

    category = upload_record.category # 'pothole' or 'crack'
    
    # ============================================
    # CACHE CHECK - Return cached data if available
    # We regenerate presigned URLs since they expire after 1 hour
    # ============================================
    if upload_record.cached_data:
        try:
            cached_response = json.loads(upload_record.cached_data)
            
            # Check if cache has upload_id (new format) - invalidate old caches
            if cached_response.get('data') and len(cached_response['data']) > 0:
                first_marker = cached_response['data'][0]
                if not first_marker.get('upload_id') or not first_marker.get('storage_path'):
                    # Old cache format - need to re-process to include upload_id for cleaning tools
                    logger.info(f"Invalidating old cache for {filename} (missing upload_id or storage_path)")
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
        
        # Helper to find column variations
        def get_col(candidates, df_cols):
            for c in candidates:
                if c in df_cols: return c
                # Case-insensitive check
                for actual in df_cols:
                    if c.lower() == actual.lower(): return actual
            return None

        # Determine actual column names from variations
        lat_col = get_col(['latitude', 'lat', 'lat_dec'], df.columns)
        lon_col = get_col(['longitude', 'lon', 'lng', 'long', 'lon_dec'], df.columns)
        conf_col = get_col(['confidence_score', 'confidence', 'conf', 'score'], df.columns)
        path_col = get_col(['image_path', 'img_path', 'image', 'filename'], df.columns)
        
        # Check for mandatory coordinate columns
        if not lat_col or not lon_col:
            missing = []
            if not lat_col: missing.append('latitude')
            if not lon_col: missing.append('longitude')
            raise HTTPException(status_code=400, detail=f"Required coordinate columns missing: {missing}")
        
        # Confidence and Path are highly recommended but we can fallback
        # (Though current logic depends on them, let's at least provide better errors)
        if not conf_col or not path_col:
            missing = []
            if not conf_col: missing.append('confidence_score')
            if not path_col: missing.append('image_path')
            raise HTTPException(status_code=400, detail=f"Required detection columns missing: {missing}")
        
        # ============================================
        # LAZY IMAGE LOADING - Memory Optimization
        # Extract only the image filenames we need from CSV,
        # then query ONLY those images (not all user images)
        # ============================================
        
        # Step 1: Extract unique image filenames from CSV
        image_filenames_needed = set()
        for idx, row in df.iterrows():
            img_path = str(row.get(path_col, ''))
            if img_path and img_path != 'nan':
                # Get just the filename (not full path)
                image_filenames_needed.add(os.path.basename(img_path))
        
        # Memory safety cap - prevent explosion with huge CSVs
        MAX_IMAGES = 500
        if len(image_filenames_needed) > MAX_IMAGES:
            logger.warning(f"CSV references {len(image_filenames_needed)} images, limiting to {MAX_IMAGES}")
            image_filenames_needed = set(list(image_filenames_needed)[:MAX_IMAGES])
        
        logger.info(f"Lazy loading {len(image_filenames_needed)} images (instead of all user images)")
        
        # Step 2: Query ONLY the images we need (by original_filename)
        file_owner_id = upload_record.user_id
        image_records = []
        if image_filenames_needed:
            image_records = db.query(
                UploadModel.original_filename,
                UploadModel.storage_path,
                UploadModel.category
            ).filter(
                UploadModel.user_id == file_owner_id,
                UploadModel.file_type.in_(['jpg', 'jpeg', 'png', 'gif', 'bmp']),
                UploadModel.original_filename.in_(image_filenames_needed)
            ).all()
        
        # Categorical Separation: Group images by category to prioritize matches
        category_images = {} # {category: {filename: storage_path}}
        for rec in image_records:
            cat = rec.category
            if cat not in category_images: category_images[cat] = {}
            
            # Map by original filename
            category_images[cat][rec.original_filename] = rec.storage_path
            # Also map by basename as fallback
            base = os.path.basename(rec.original_filename)
            if base not in category_images[cat]:
                category_images[cat][base] = rec.storage_path

        # Create the final prioritized map for THIS CSV's category
        image_map = {}
        target_cat = category # 'pothole' or 'crack'
        
        # Level 1: Prioritize current category
        if target_cat in category_images:
            image_map.update(category_images[target_cat])
            
        # Level 2: Fallback to all other categories (only if NOT already in map)
        for cat, images in category_images.items():
            if cat != target_cat:
                for fname, path in images.items():
                    if fname not in image_map:
                        image_map[fname] = path
        
        markers_data = []
        total_defect_area_m2 = 0.0
        valid_coords = [] # Track coordinates for road length calc
        
        # Load overrides
        overrides = {}
        if upload_record.status_overrides:
            try:
                overrides = json.loads(upload_record.status_overrides)
            except:
                overrides = {}

        for idx, row in df.iterrows():
            try:
                # Check for persistent overrides
                idx_str = str(idx)
                row_override = overrides.get(idx_str, {})
                
                # PERMANENT DELETE (SuperUser Action)
                if row_override.get("deleted") is True:
                    continue

                # Check for hidden status (All users)
                is_hidden = row_override.get("hidden", False)

                lat = float(row[lat_col])
                lon = float(row[lon_col])
                confidence = float(row[conf_col])
                image_ref = str(row[path_col])
                
                if math.isnan(lat) or math.isnan(lon) or math.isnan(confidence):
                    logger.warning(f"Skipping row {idx} due to NaN values: lat={lat}, lon={lon}, conf={confidence}")
                    continue

                # Capture coordinate for distance calculation (Use all valid, non-deleted points)
                # This ensures Road Length remains static even when hiding specific defects
                valid_coords.append((lat, lon))

                image_path = image_ref # e.g. "frame_11030.jpg"
                # confidence is already float-converted above
                
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
                storage_path = None
                
                # Match image by basename to handle path variations in CSV
                img_basename = os.path.basename(image_path)
                if img_basename in image_map:
                    storage_path = image_map[img_basename]
                elif image_path in image_map:
                    storage_path = image_map[image_path]
                else:
                    # Dynamic path fallback
                    storage_path = f"{file_owner_id}/{category}/{img_basename}"
                
                # Generate URL using the storage service (generates presigned URL for R2)
                image_url = file_handler.storage.get_file_url(storage_path)
                
                # Estimate Area & Cost
                area_m2 = 0.0
                
                # 1. Try to get precise AREA from Notebook (Mask-based)
                if 'area_m2' in row and not pd.isna(row['area_m2']):
                    area_m2 = float(row['area_m2'])
                # 2. Fallback to Bbox Estimation (if missing)
                else:
                    width_px = row.get('box_width', 100) 
                    height_px = row.get('box_height', 100) 
                    center_y = row.get('box_center_y', 540) # Default to center of 1080p
                    
                    area_m2 = calibrator.estimate_area_from_bbox(
                        float(width_px), float(height_px), float(center_y)
                    )
                
                # Get Pavement Type (Notebook Classification)
                pavement_type = 'asphalt' # Default
                if 'pavement_type' in row and not pd.isna(row['pavement_type']):
                    pavement_type = str(row['pavement_type']).lower()
                
                cost_data = CostCalculator.calculate_repair_cost(
                    defect_type=category,
                    pavement_type=pavement_type,
                    area_m2=area_m2
                )
                
                if not is_hidden:
                    # Accumulate Total Area for Density Calculation
                    total_defect_area_m2 += area_m2

                # Create popup HTML
                category_title = "🚧 Pothole Detection" if category == 'pothole' else "📉 Crack Detection"
                
                # Add a 'hidden' badge to popup if applicable
                hidden_badge = '<div style="background: #f3f4f6; color: #6b7280; padding: 2px 8px; border-radius: 99px; font-size: 10px; display: inline-block; margin-bottom: 5px;">Hiding from Budget</div>' if is_hidden else ''

                popup_html = f"""
                <div style="text-align: center; min-width: 250px; font-family: Arial, sans-serif;">
                    {hidden_badge}
                    <h4 style="margin: 0 0 10px 0; color: #dc2626; border-bottom: 2px solid #fee2e2; padding-bottom: 5px;">{category_title}</h4>
                    <p style="margin: 5px 0;"><strong>Confidence:</strong> {confidence:.2%}</p>
                    
                    <div style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
                        <a href="{image_url}" target="_blank">
                            <img src="{image_url}" 
                                 style="width: 200px; height: auto; border-radius: 6px; cursor: pointer;" 
                                 onerror="this.style.display='none'; this.parentElement.nextElementSibling.style.display='block';"
                                 alt="Pothole Image">
                        </a>
                         <div style="display: none; color: #e74c3c; font-size: 12px; padding: 10px;">
                            ❌ Image failed to load<br>
                            <a href="{image_url}" target="_blank" style="color: #007bff; text-decoration: none; font-size: 10px;">Click here to view image</a>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; text-align: left;">
                         <div style="background: #f9fafb; padding: 4px; border-radius: 4px;">
                            <div style="color: #6b7280; font-size: 10px; text-transform: uppercase;">Est. Area</div>
                            <div style="font-weight: bold; color: #1f2937;">{area_m2} m²</div>
                        </div>
                        <div style="background: #fffbe6; padding: 4px; border-radius: 4px; border: 1px solid #fef3c7;">
                            <div style="color: #b45309; font-size: 10px; text-transform: uppercase;">Repair Cost</div>
                            <div style="font-weight: bold; color: #92400e;">₱{cost_data['total_cost_php']:,}</div>
                        </div>
                    </div>
                </div>
                """
                
                markers_data.append({
                    'lat': lat,
                    'lon': lon,
                    'popup_html': popup_html,
                    'tooltip': f"{category.title()} Detection ({confidence:.1%})",
                    'confidence': confidence,
                    'area_m2': area_m2,
                    'repair_cost': cost_data['total_cost_php'],
                    'severity': cost_data['severity'],
                    'image_path': image_path,
                    'image_url': image_url,
                    'storage_path': storage_path,  # Store for URL regeneration from cache
                    '_cached_url': image_url,  # Store original URL for popup replacement
                    'timestamp': timestamp,
                    'is_hidden': is_hidden,
                    'upload_id': upload_record.id,
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
        # 3. ENGINEERING DIAGNOSIS (Density Calculation)
        # ============================================
        try:
            # 3a. Calculate Total Road Length (Accumulated Haversine)
            road_len_m = 0.0
            if len(valid_coords) >= 2:
                for i in range(len(valid_coords) - 1):
                    p1 = valid_coords[i]
                    p2 = valid_coords[i+1]
                    dist = calibrator.calculate_distance_meters(p1[0], p1[1], p2[0], p2[1])
                    # Filter out crazy jumps (GPS glitches > 100m per frame)
                    if dist < 100.0:
                        road_len_m += dist
            
            # Fallback if static image or single point (assume 50m segment)
            if road_len_m < 5.0:
                road_len_m = 50.0

            # 3b. Road Area = Length * Width (Standard 3.5m lane)
            road_width_m = 3.5
            total_road_area_m2 = road_len_m * road_width_m
            
            # 3c. Calculate Density %
            density_percent = 0.0
            if total_road_area_m2 > 0:
                density_percent = (total_defect_area_m2 / total_road_area_m2) * 100.0
            
            # 3d. Get Expert Diagnosis
            expert_diagnosis = EngineeringExpert.diagnose(category, density_percent)
            
            # Add to response
            response_data['summary'] = {
                'total_defect_area_m2': round(total_defect_area_m2, 2),
                'total_road_area_m2': round(total_road_area_m2, 2),
                'road_length_m': round(road_len_m, 2),
                'density_percent': round(density_percent, 2),
                'diagnosis': expert_diagnosis
            }
        except Exception as diag_err:
            logger.error(f"Diagnosis failed: {diag_err}")
            # Non-blocking, just omit summary

        
        # ============================================
        # CACHE STORE - Save processed data for future requests
        # ============================================
        try:
            upload_record.cached_data = json.dumps(response_data)
            upload_record.cache_timestamp = datetime.utcnow()
            db.commit()
            logger.info(f"Cached {category} data for {filename} ({len(markers_data)} markers)")
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
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Direct Proxy: serve by storage key (storage_path).
    Required for reports where we know the exact path but might not have a clean DB record per file.
    """
    try:
        # Security: basic check to prevent directory traversal
        if ".." in key or key.startswith("/"):
            raise HTTPException(status_code=400, detail="Invalid key format")
            
        # Ownership check: Ensure user is asking for their own file (or is superuser)
        # Path format: {user_id}/{category}/{filename}
        try:
            folder_user_id = int(key.split('/')[0])
            if folder_user_id != current_user.id and not current_user.is_superuser:
                 raise HTTPException(status_code=403, detail="Unauthorized access to this file")
        except (ValueError, IndexError):
            # If path doesn't start with an ID, check if it's a shared/public file
            # For now, we enforce the {id}/ structure for security
            raise HTTPException(status_code=400, detail="Invalid storage path structure")

        # Stream directly from storage provider (R2/Local)
        file_stream = file_handler.storage.get_file_stream(key)
        
        headers = {"Cache-Control": "public, max-age=31536000, immutable"}
        return StreamingResponse(file_stream, media_type="image/jpeg", headers=headers)
        
    except Exception as e:
        logger.error(f"Error proxying key {key}: {e}")
        raise HTTPException(status_code=404, detail="File not found")
