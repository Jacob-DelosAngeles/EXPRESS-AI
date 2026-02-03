from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from models.upload import UploadModel
from models.user import UserModel
from core.clerk_auth import get_current_user
import json
from typing import Dict, Any, Optional
from pydantic import BaseModel

router = APIRouter()

class StatusOverrideRequest(BaseModel):
    detection_idx: int
    deleted: Optional[bool] = None
    hidden: Optional[bool] = None

@router.patch("/{upload_id}/override")
async def update_status_override(
    upload_id: int,
    request: StatusOverrideRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update the status (deleted/hidden) of a specific detection within an upload.
    - Only SuperUsers can set 'deleted' to true.
    - All users can toggle 'hidden'.
    """
    upload = db.query(UploadModel).filter(UploadModel.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload record not found")

    # Security Check: Only SuperUsers can delete
    if request.deleted is True and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only SuperUsers can delete detections")

    # Load existing overrides
    overrides = {}
    if upload.status_overrides:
        try:
            overrides = json.loads(upload.status_overrides)
        except:
            overrides = {}

    # Update override for this specific index
    idx_str = str(request.detection_idx)
    if idx_str not in overrides:
        overrides[idx_str] = {}

    if request.deleted is not None:
        overrides[idx_str]["deleted"] = request.deleted
    if request.hidden is not None:
        overrides[idx_str]["hidden"] = request.hidden

    # Save back to DB
    upload.status_overrides = json.dumps(overrides)
    
    # MEMORY OPTIMIZATION: Patch cache instead of invalidating
    # This prevents 512MB memory spike from full re-processing
    cache_patched = False
    if upload.cached_data:
        try:
            cached = json.loads(upload.cached_data)
            if 'data' in cached and isinstance(cached['data'], list):
                if request.deleted is True:
                    # Remove deleted marker from cache
                    original_count = len(cached['data'])
                    cached['data'] = [m for m in cached['data'] if m.get('id') != request.detection_idx]
                    cached['count'] = len(cached['data'])
                    cache_patched = (len(cached['data']) < original_count)
                elif request.hidden is not None:
                    # Update hidden status in cache
                    for m in cached['data']:
                        if m.get('id') == request.detection_idx:
                            m['is_hidden'] = request.hidden
                            cache_patched = True
                            break
                
                if cache_patched:
                    upload.cached_data = json.dumps(cached)
        except (json.JSONDecodeError, TypeError, KeyError):
            # Fallback: invalidate cache if patching fails
            upload.cached_data = None
    
    # If cache wasn't patched (no cache or patch failed), invalidate for safety
    if not cache_patched and upload.cached_data is None:
        pass  # Already None, re-processing will happen on next request
    
    db.commit()

    return {
        "success": True, 
        "message": f"Updated status for detection {request.detection_idx}",
        "overrides": overrides
    }
