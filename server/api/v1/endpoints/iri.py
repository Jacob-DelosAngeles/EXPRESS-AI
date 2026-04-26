import gc
import json
import time as _time
from io import BytesIO
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Request, Depends
from sqlalchemy.orm import Session

from core.clerk_auth import get_current_user
from core.database import get_db
from core.limiter import limiter
from models.iri_models import IRIComputationRequest, IRIComputationResponse
from models.upload import UploadModel
from models.user import UserModel
from services.iri_lite import process_iri_chunked
from utils.file_handler import FileHandler

router = APIRouter()
file_handler = FileHandler()


@router.get("/compute/{filename}")
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
    Compute IRI values using the lightweight chunked processor.
    Rate limited: 5/minute per IP. Max 2 concurrent (semaphore).
    Result cached per segment_length — subsequent calls for same length are instant.
    """
    semaphore = getattr(request.app.state, "iri_semaphore", None)

    async def _compute():
        content_bytes = None
        file_obj = None
        try:
            superuser_ids = [
                u.id for u in db.query(UserModel.id).filter(UserModel.role == 'superuser').all()
            ]

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
                raise HTTPException(status_code=404, detail=f"File not found: {filename}")

            # Cache hit — return instantly if same segment_length was already computed
            if upload_record.cached_data:
                try:
                    cached = json.loads(upload_record.cached_data)
                    if cached.get('segment_length') == segment_length and cached.get('success'):
                        cached['from_cache'] = True
                        return cached
                except (json.JSONDecodeError, KeyError):
                    pass

            # Cache miss — run lightweight computation
            t0 = _time.time()
            content_bytes = file_handler.storage.get_file_content(upload_record.storage_path)
            file_obj = BytesIO(content_bytes)

            result = process_iri_chunked(file_obj, segment_length=segment_length)

            if not result.get('success'):
                raise HTTPException(status_code=400, detail=result.get('message', 'Computation failed'))

            # Tag and save to cache so next request is instant
            result['segment_length'] = segment_length
            result['processing_time'] = round(_time.time() - t0, 3)
            result['raw_data'] = []       # Chart data not available in lightweight mode
            result['filtered_data'] = []

            try:
                upload_record.cached_data = json.dumps(result)
                upload_record.cache_timestamp = datetime.utcnow()
                db.commit()
            except Exception:
                pass  # Non-fatal — still return the result

            return result

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"IRI computation failed: {str(e)}")
        finally:
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
    Visibility: users see OWN + SUPERUSER uploads.
    """
    superuser_ids = [
        u.id for u in db.query(UserModel.id).filter(UserModel.role == 'superuser').all()
    ]

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
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")

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
    return {
        "success": True,
        "service": "IRI Computation Service",
        "status": "running",
        "version": "1.0.0"
    }
