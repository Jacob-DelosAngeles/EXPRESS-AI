from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import os
import gc
from io import BytesIO

from models.iri_models import IRIComputationRequest, IRIComputationResponse, ErrorResponse
from models.upload import UploadModel
from models.user import UserModel
from services.iri_service import IRIService
from core.database import get_db
from core.clerk_auth import get_current_user  # Clerk auth
from core import security  # Keep for backwards compatibility
from core.config import settings 
from sqlalchemy.orm import Session
from fastapi import Depends
from utils.file_handler import FileHandler

router = APIRouter()

# Initialize service
iri_service = IRIService()
file_handler = FileHandler()

@router.get("/compute/{filename}", response_model=IRIComputationResponse)
async def compute_iri(
    filename: str,
    segment_length: int = Query(default=100, ge=25, le=500, description="Segment length in meters"),
    cutoff_freq: float = Query(default=10.0, description="Cutoff frequency for filtering"),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Compute IRI values for an uploaded file.
    Uses GET to avoid CORS preflight issues.
    """
    content_bytes = None
    file_obj = None
    result = None
    
    try:
        # Get superuser IDs for global data visibility
        superuser_ids = [u.id for u in db.query(UserModel.id).filter(UserModel.role == 'superuser').all()]
        
        # 1. Fetch the upload record with visibility rules
        upload_record = None
        if filename.isdigit():
            upload_record = db.query(UploadModel).filter(
                UploadModel.id == int(filename),
                ((UploadModel.user_id == current_user.id) | (UploadModel.user_id.in_(superuser_ids)))
            ).first()
            
            # Superuser can see ALL
            if not upload_record and current_user.is_superuser:
                upload_record = db.query(UploadModel).filter(
                    UploadModel.id == int(filename)
                ).first()
        
        if not upload_record:
            # Fallback with visibility rules
            upload_record = db.query(UploadModel).filter(
                UploadModel.file_type == 'csv',
                UploadModel.filename == filename,
                ((UploadModel.user_id == current_user.id) | (UploadModel.user_id.in_(superuser_ids)))
            ).order_by(UploadModel.upload_date.desc()).first()
            
            # Superuser fallback
            if not upload_record and current_user.is_superuser:
                upload_record = db.query(UploadModel).filter(
                    UploadModel.file_type == 'csv',
                    UploadModel.filename == filename
                ).order_by(UploadModel.upload_date.desc()).first()

        if not upload_record:
            raise HTTPException(status_code=404, detail=f"File not found with identifier: {filename}")

        # Use storage path from DB record
        storage_path = upload_record.storage_path
        content_bytes = file_handler.storage.get_file_content(storage_path)

        file_obj = BytesIO(content_bytes)
        
        # Create request object from query parameters
        request = IRIComputationRequest(
            segment_length=segment_length,
            cutoff_freq=cutoff_freq
        )
        
        # Compute IRI with configurable segment length
        result = await iri_service.process_file_and_compute_iri(file_obj, request)
        
        if not result.success:
            raise HTTPException(status_code=400, detail=result.message)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"IRI computation failed: {str(e)}")
    finally:
        # Aggressive memory cleanup to prevent OOM on sequential recalculations
        if file_obj:
            file_obj.close()
        del content_bytes
        del file_obj
        gc.collect()



@router.get("/cached/{filename}")
async def get_cached_iri(
    filename: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get pre-processed IRI data from cache (INSTANT - no processing).
    Visibility: users see OWN + SUPERUSER uploads
    """
    import json
    
    # Get superuser IDs for global data visibility
    superuser_ids = [u.id for u in db.query(UserModel.id).filter(UserModel.role == 'superuser').all()]
    
    # Find the file record with visibility rules
    upload_record = None
    if filename.isdigit():
        upload_record = db.query(UploadModel).filter(
            UploadModel.id == int(filename),
            ((UploadModel.user_id == current_user.id) | (UploadModel.user_id.in_(superuser_ids)))
        ).first()
        
        # Superuser can see ALL
        if not upload_record and current_user.is_superuser:
            upload_record = db.query(UploadModel).filter(
                UploadModel.id == int(filename)
            ).first()
    
    if not upload_record:
        # Fallback with visibility rules
        upload_record = db.query(UploadModel).filter(
            UploadModel.file_type == 'csv',
            UploadModel.filename == filename,
            ((UploadModel.user_id == current_user.id) | (UploadModel.user_id.in_(superuser_ids)))
        ).order_by(UploadModel.upload_date.desc()).first()
        
        # Superuser fallback
        if not upload_record and current_user.is_superuser:
            upload_record = db.query(UploadModel).filter(
                UploadModel.file_type == 'csv',
                UploadModel.filename == filename
            ).order_by(UploadModel.upload_date.desc()).first()
    
    if not upload_record:
        raise HTTPException(status_code=404, detail=f"File not found with identifier: {filename}")
    
    # Return cached data if available
    if upload_record.cached_data:
        try:
            cached = json.loads(upload_record.cached_data)
            cached['from_cache'] = True
            return cached
        except json.JSONDecodeError:
            pass  # Fall through to processing
    
    # No cache available - return error (upload should have cached it)
    raise HTTPException(
        status_code=404, 
        detail="IRI data not cached. Please re-upload the file."
    )


# NOTE: Legacy GET /compute/{filename} and GET /validate/{filename} endpoints
# have been removed because they:
# 1. Did not require authentication
# 2. Only worked with local storage (not R2)
# Use the POST /compute/{filename} endpoint instead, which requires authentication.

@router.get("/status")
async def get_service_status():
    """
    Get the current status of the IRI computation service
    """
    return {
        "success": True,
        "service": "IRI Computation Service",
        "status": "running",
        "version": "1.0.0"
    }

