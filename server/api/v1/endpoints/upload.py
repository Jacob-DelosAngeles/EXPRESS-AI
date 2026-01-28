from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import List
from sqlalchemy.orm import Session
import os
import logging
import gc  # Garbage collection for memory management
import json
from datetime import datetime

logger = logging.getLogger(__name__)

from models.iri_models import FileUploadResponse, ErrorResponse
from models.upload import UploadModel, PotholeImageModel, Upload, UploadCreate
from models.user import UserModel
from utils.file_handler import FileHandler
from services.iri_service import IRIService
from services.iri_lite import process_iri_chunked  # Lightweight IRI processor
from core.database import get_db
from core.clerk_auth import get_current_user  # Clerk auth
from core import security  # Keep for backwards compatibility
from core.config import settings
import hashlib
import pandas as pd
from io import BytesIO

router = APIRouter()

# Initialize services
file_handler = FileHandler()
iri_service = IRIService()

# Allowed file extensions by category
ALLOWED_EXTENSIONS = {
    'pothole': {'.csv', '.jpg', '.jpeg', '.png', '.gif', '.bmp'},
    'crack': {'.csv', '.jpg', '.jpeg', '.png', '.gif', '.bmp'},
    'iri': {'.csv'},
    'vehicle': {'.csv'},
    'pavement': {'.csv'}
}

@router.post("/", response_model=List[FileUploadResponse])
async def upload_files(
    files: List[UploadFile] = File(...), 
    type: str = "iri",
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload multiple files (CSV and/or images).
    type: 'iri', 'pothole', or 'vehicle'
    Files are saved to user-specific storage and tracked in database.
    Requires admin or superuser role.
    """
    # Role check: Only admins and superusers can upload
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only admins can upload files. Contact your superuser for access."
        )
    
    results = []
    pothole_csv_upload_id = None  # Track CSV upload for linking images
    
    # Generate a unique batch_id for this upload session to prevent naming collisions
    batch_id = f"batch_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    
    # ---------------------------------------------------------
    # SMART FILTERING (STRICT MODE) FOR POTHOLE UPLOADS
    # Now supports batched uploads where CSV was uploaded first
    # ---------------------------------------------------------
    allowed_pothole_images = None
    if type == "pothole":
        # First, check if there's a CSV in the current upload batch
        csv_file = next((f for f in files if f.filename.lower().endswith('.csv')), None)
        
        if csv_file:
            # CSV in current batch - use it for filtering
            try:
                csv_file.file.seek(0)
                df_scan = pd.read_csv(csv_file.file)
                if 'image_path' in df_scan.columns:
                    allowed_pothole_images = set(df_scan['image_path'].dropna().unique())
                csv_file.file.seek(0)
            except Exception as e:
                logger.warning(f"Failed to scan CSV for image filtering: {e}")
                allowed_pothole_images = None
        else:
            # No CSV in this batch - look for the most recent pothole CSV in database
            try:
                existing_csv = db.query(UploadModel).filter(
                    UploadModel.user_id == current_user.id,
                    UploadModel.category == 'pothole',
                    UploadModel.file_type == 'csv'
                ).order_by(UploadModel.upload_date.desc()).first()
                
                if existing_csv:
                    pothole_csv_upload_id = existing_csv.id
                    # Fetch CSV content from storage and extract allowed images
                    try:
                        csv_content = file_handler.storage.get_file_content(existing_csv.storage_path)
                        df_scan = pd.read_csv(BytesIO(csv_content))
                        if 'image_path' in df_scan.columns:
                            allowed_pothole_images = set(df_scan['image_path'].dropna().unique())
                        logger.info(f"Using existing CSV for filtering: {existing_csv.original_filename} ({len(allowed_pothole_images) if allowed_pothole_images else 0} images)")
                    except Exception as e:
                        logger.warning(f"Failed to read existing CSV for filtering: {e}")
                        # Allow all images if we can't read the CSV
                        allowed_pothole_images = None
                else:
                    logger.warning("No CSV found - allowing all images without filtering")
                    allowed_pothole_images = None
            except Exception as e:
                logger.warning(f"Database query for existing CSV failed: {e}")
                allowed_pothole_images = None

    for file in files:
        try:
            # Get file extension
            file_extension = os.path.splitext(file.filename)[1].lower()
            
            # Smart Filtering Check
            if type == "pothole" and allowed_pothole_images is not None:
                is_image_check = file_extension in {'.jpg', '.jpeg', '.png', '.gif', '.bmp'}
                if is_image_check:
                    if file.filename not in allowed_pothole_images:
                        # SKIP THIS FILE
                        results.append(FileUploadResponse(
                            success=False,
                            message=f"Skipped {file.filename}: Not referenced in the uploaded CSV.",
                            filename=file.filename,
                            file_size=0,
                            rows_processed=0,
                            duration=0.0
                        ))
                        continue
            
            # Validate file type for category
            
            # Validate file type for category
            allowed = ALLOWED_EXTENSIONS.get(type, set())
            if file_extension not in allowed:
                results.append(FileUploadResponse(
                    success=False,
                    message=f"Skipped {file.filename}: File type {file_extension} not allowed for {type}. Allowed: {', '.join(allowed)}",
                    filename=file.filename,
                    file_size=0,
                    rows_processed=0,
                    duration=0.0
                ))
                continue
            
            # Calculate file hash for deduplication
            hash_md5 = hashlib.md5()
            # Read in chunks to avoid memory issues with large files
            file.file.seek(0)
            for chunk in iter(lambda: file.file.read(4096), b""):
                hash_md5.update(chunk)
            file_hash = hash_md5.hexdigest()
            file.file.seek(0) # Reset pointer
            
            # File size
            file.file.seek(0, 2)
            file_size = file.file.tell()
            file.file.seek(0)

            # Smart Deduplication: Check if file already exists
            existing_upload = db.query(UploadModel).filter(
                (UploadModel.file_hash == file_hash) | 
                ((UploadModel.user_id == current_user.id) & 
                 (UploadModel.filename == file.filename) & 
                 (UploadModel.category == type) & 
                 (UploadModel.file_size == file_size))
            ).first()

            if existing_upload:
                
                # If it's a pothole CSV, we might need to link it again if logic requires, 
                # but currently we just return success.
                # However, for pothole linkage, if the user uploads the same CSV, we might simply return the existing ID.
                if type == "pothole":
                     pothole_csv_upload_id = existing_upload.id

                results.append(FileUploadResponse(
                    success=True,
                    message="File already exists (deduplicated). Used cached version.",
                    id=existing_upload.id,
                    filename=existing_upload.filename,
                    file_size=existing_upload.file_size,
                    rows_processed=0,
                    duration=0.0
                ))
                continue
            
            # Determine if this is a CSV or image
            is_csv = file_extension == '.csv'
            is_image = file_extension in {'.jpg', '.jpeg', '.png', '.gif', '.bmp'}
            
            # Save file to storage (organized by user_id/category/batch_id/)
            storage_path = await file_handler.save_uploaded_file(file, current_user.id, type, directory=batch_id)
            
            rows_count = 0
            message = "File uploaded."
            
            # Handle CSV files
            if is_csv:
                # Validate based on type
                if type == "iri":
                    # Validate IRI file format using file object
                    # We reuse the file stream which is already in memory/temp file
                    file.file.seek(0)
                    is_valid, message, rows_count = await iri_service.validate_file_format(file.file)
                    
                    if not is_valid:
                        # Clean up invalid file from storage
                        await file_handler.delete_file_async(storage_path)
                        results.append(FileUploadResponse(
                            success=False,
                            message=f"Invalid format {file.filename}: {message}",
                            filename=file.filename,
                            file_size=0,
                            rows_processed=0,
                            duration=0.0
                        ))
                        continue
                else:
                    # For other types, just count rows
                    try:
                        # pandas is already imported globally
                        file.file.seek(0)
                        df = pd.read_csv(file.file)
                        rows_count = len(df)
                    except Exception:
                        rows_count = 0
                
                # Save to database
                db_upload = UploadModel(
                    user_id=current_user.id,
                    filename=os.path.basename(storage_path),
                    original_filename=file.filename,
                    file_type=file_extension[1:],  # Remove dot
                    category=type,
                    storage_path=storage_path,
                    file_size=file_size,
                    file_hash=file_hash
                )
                db.add(db_upload)
                db.commit()
                db.refresh(db_upload)
                
                # Track pothole CSV for linking images
                if type == "pothole":
                    pothole_csv_upload_id = db_upload.id
                
                # ============================================
                # IRI: Process and cache during upload for instant fetches
                # ============================================
                if type == "iri":
                    try:
                        logger.info(f"Processing IRI data for caching: {file.filename}")
                        file.file.seek(0)
                        iri_result = process_iri_chunked(file.file)
                        
                        if iri_result['success']:
                            # Store only the lightweight map data
                            db_upload.cached_data = json.dumps(iri_result)
                            db_upload.cache_timestamp = datetime.utcnow()
                            db.commit()
                            logger.info(f"Cached {len(iri_result['segments'])} IRI segments for {file.filename}")
                            message = f"Processed {len(iri_result['segments'])} road segments."
                        else:
                            logger.warning(f"IRI processing failed: {iri_result['message']}")
                            message = f"Uploaded but processing failed: {iri_result['message']}"
                    except Exception as cache_err:
                        logger.error(f"IRI caching error: {cache_err}")
                        message = "Uploaded. Processing will happen on first fetch."
                
                results.append(FileUploadResponse(
                    success=True,
                    message=f"CSV uploaded successfully. {message}",
                    id=db_upload.id,
                    filename=file.filename,
                    file_size=file_size,
                    rows_processed=rows_count,
                    duration=0.0
                ))
            
            # Handle image files (for potholes)
            elif is_image and type == "pothole":
                # Save to database
                db_upload = UploadModel(
                    user_id=current_user.id,
                    filename=os.path.basename(storage_path),
                    original_filename=file.filename,
                    file_type=file_extension[1:],  # Remove dot
                    category=type,
                    storage_path=storage_path,
                    file_size=file_size,
                    file_hash=file_hash
                )
                db.add(db_upload)
                db.commit()
                db.refresh(db_upload)
                
                # If we have a pothole CSV, link this image to it
                if pothole_csv_upload_id:
                    pothole_image = PotholeImageModel(
                        upload_id=pothole_csv_upload_id,
                        image_path=storage_path
                    )
                    db.add(pothole_image)
                    db.commit()
                
                results.append(FileUploadResponse(
                    success=True,
                    message=f"Image uploaded successfully.",
                    id=db_upload.id,
                    filename=file.filename,
                    file_size=file_size,
                    rows_processed=0,
                    duration=0.0
                ))
            
        except Exception as e:
            results.append(FileUploadResponse(
                success=False,
                message=f"Error uploading {file.filename}: {str(e)}",
                filename=file.filename,
                file_size=0,
                rows_processed=0,
                duration=0.0
            ))
        finally:
            # Aggressive memory cleanup after each file
            try:
                # Close and release the file handle
                if hasattr(file, 'file') and file.file:
                    file.file.close()
            except:
                pass
            
            # Clear any dataframe references
            if 'df' in locals():
                del df
            if 'df_scan' in locals():
                del df_scan
            
            # Force garbage collection (critical for Render's 512MB limit)
            gc.collect()
            
    return results

@router.get("/files")
async def list_uploaded_files(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all files (shared data model).
    All authenticated users see all files.
    """
    try:
        uploads = db.query(UploadModel).all()
        
        return {
            "success": True,
            "files": uploads,
            "count": len(uploads)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing files: {str(e)}")

@router.get("/files/{category}")
async def list_files_by_category(
    category: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List files by category (shared data model).
    All authenticated users see all files in this category.
    """
    try:
        uploads = db.query(UploadModel).filter(
            UploadModel.category == category
        ).all()
        
        return {
            "success": True,
            "category": category,
            "files": uploads,
            "count": len(uploads)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing files: {str(e)}")

@router.delete("/{upload_id}")
async def delete_upload(
    upload_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a specific upload. Requires admin or superuser role.
    """
    # Role check: Only admins and superusers can delete
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only admins can delete files."
        )
    
    try:
        # Find the upload
        upload = db.query(UploadModel).filter(
            UploadModel.id == upload_id,
            UploadModel.user_id == current_user.id
        ).first()
        
        if not upload:
            raise HTTPException(status_code=404, detail="Upload not found or access denied")
            
        # SMART DELETION FOR POTHOLES
        # If deleting a Pothole CSV, cascade delete the associated images
        if upload.category == 'pothole' and upload.file_type == 'csv':
            try:
                # 1. Read the CSV content
                content_bytes = file_handler.storage.get_file_content(upload.storage_path)
                df = pd.read_csv(BytesIO(content_bytes))
                
                # 2. Extract image paths (filenames)
                if 'image_path' in df.columns:
                    image_filenames = df['image_path'].dropna().unique().tolist()
                    if image_filenames:
                        logger.debug(f"Found {len(image_filenames)} images to cascade delete.")
                        
                        # 3. Find UploadModel records for these images
                        # We match by original_filename because R2 filenames are UUIDs
                        images_to_delete = db.query(UploadModel).filter(
                            UploadModel.user_id == current_user.id,
                            UploadModel.category == 'pothole',
                            UploadModel.original_filename.in_(image_filenames)
                        ).all()
                        
                        # 4. Delete them
                        for img_upload in images_to_delete:
                            try:
                                # Delete from R2
                                await file_handler.delete_file_async(img_upload.storage_path)
                                # Delete from DB
                                db.delete(img_upload)
                                db.commit() # Force commit immediately
                            except Exception as e:
                                logger.warning(f"Error cascading delete for {img_upload.filename}: {e}")
                                # Continue deleting others even if one fails
                        
                        logger.debug(f"Cascade deleted {len(images_to_delete)} image records.")
                        
            except Exception as e:
                # Log error but don't stop the main deletion
                logger.warning(f"Smart deletion logic failed: {e}")

        # Delete from storage
        await file_handler.delete_file_async(upload.storage_path)
        
        # Delete from database (cascade will delete related pothole_images)
        db.delete(upload)
        db.commit()
        
        return {"success": True, "message": f"Upload {upload.original_filename} deleted successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting upload: {str(e)}")
