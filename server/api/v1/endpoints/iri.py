from fastapi import APIRouter, HTTPException, Query, Request, Depends
from typing import Optional
import os
import gc
from io import BytesIO
from core.limiter import limiter

from models.iri_models import IRIComputationRequest, IRIComputationResponse, ErrorResponse
from models.upload import UploadModel
from models.user import UserModel
from services.iri_service import IRIService
from core.database import get_db
from core.clerk_auth import get_current_user
from core import security
from core.config import settings
from sqlalchemy.orm import Session
from utils.file_handler import FileHandler

router = APIRouter()

iri_service = IRIService()
file_handler = FileHandler()


@router.get("/compute/{filename}", response_model=IRIComputationResponse)
@limiter.limit("5/minute")
async def compute_iri(
    request: Request,
    filename: str,
    segment_length: int = Query(default=100, ge=25, le=500, description="Segment length in meters"),
    cutoff_freq: float = Query(default=10.0, description="Cutoff frequency for filtering"),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Compute IRI values for an uploaded file.
    Rate limited: 5/minute per IP. Max 2 concurrent computations (semaphore).
    """
    content_bytes = None
    file_obj = None
    result = None

    semaphore = getattr(request.app.state, "iri_semaphore", None)

    async def _compute():
        nonlocal content_bytes, file_obj, result
        try:
            superuser_ids = [u.id for u in db.query(UserModel.id).filter(UserModel.role == 'superuser').all()]

            upload_record = None
            if filename.isdigit():
                upload_record = db.query(UploadModel).filter(
                    UploadModel.id == int(filename),
                    ((UploadModel.user_id == current_user.id) | (UploadModel.user_id.in_(superuser_ids)))
                ).first()

                if not upload_record and current_user.is_superuser:
                    upload_record = db.query(UploadModel).filter(
                        UploadModel.id == int(filename)
                    ).first()

            if not upload_record:
                upload_record = db.query(UploadModel).filter(
                    UploadModel.file_type == 'csv',
                    UploadModel.filename == filename,
                    ((UploadModel.user_id == current_user.id) | (UploadModel.user_id.in_(superuser_ids)))
                ).order_by(UploadModel.upload_date.desc()).first()

                if not upload_record and current_user.is_superuser:
                    upload_record = db.query(UploadModel).filter(
                        UploadModel.file_type == 'csv',
                        UploadModel.filename == filename
                    ).order_by(UploadModel.upload_date.desc()).first()

            if not upload_record:
                raise HTTPException(status_code=404, detail=f"File not found with identifier: {filename}")

            storage_path = upload_record.storage_path
            content_bytes = file_handler.storage.get_file_content(storage_path)
            file_obj = BytesIO(content_bytes)

            iri_request = IRIComputationRequest(
                segment_length=segment_length,
                cutoff_freq=cutoff_freq
            )

            result = await iri_service.process_file_and_compute_iri(file_obj, iri_request)

            if not result.success:
                raise HTTPException(status_code=400, detail=result.message)

            return result

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"IRI computation failed: {str(e)}")
        finally:
            if file_obj:
                file_obj.close()
            del content_bytes
            del file_obj
            gc.collect()

    if semaphore:
        async with semaphore:
            return await _compute()
    else:
        return await _compute()


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

    superuser_ids = [u.id for u in db.query(UserModel.id).filter(UserModel.role == 'superuser').all()]

    upload_record = None
    if filename.isdigit():
        upload_record = db.query(UploadModel).filter(
            UploadModel.id == int(filename),
            ((UploadModel.user_id == current_user.id) | (UploadModel.user_id.in_(superuser_ids)))
        ).first()

        if not upload_record and current_user.is_superuser:
            upload_record = db.query(UploadModel).filter(
                UploadModel.id == int(filename)
            ).first()

    if not upload_record:
        upload_record = db.query(UploadModel).filter(
            UploadModel.file_type == 'csv',
            UploadModel.filename == filename,
            ((UploadModel.user_id == current_user.id) | (UploadModel.user_id.in_(superuser_ids)))
        ).order_by(UploadModel.upload_date.desc()).first()

        if not upload_record and current_user.is_superuser:
            upload_record = db.query(UploadModel).filter(
                UploadModel.file_type == 'csv',
                UploadModel.filename == filename
            ).order_by(UploadModel.upload_date.desc()).first()

    if not upload_record:
        raise HTTPException(status_code=404, detail=f"File not found with identifier: {filename}")

    if upload_record.cached_data:
        try:
            cached = json.loads(upload_record.cached_data)
            cached['from_cache'] = True
            return cached
        except json.JSONDecodeError:
            pass

    raise HTTPException(
        status_code=404,
        detail="IRI data not cached. Please re-upload the file."
    )


@router.get("/status")
async def get_service_status():
    """Get the current status of the IRI computation service."""
    return {
        "success": True,
        "service": "IRI Computation Service",
        "status": "running",
        "version": "1.0.0"
    }
