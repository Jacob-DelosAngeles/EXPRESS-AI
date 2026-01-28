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
    
    # CRITICAL: Invalidate cache to force re-processing with new overrides
    upload.cached_data = None
    
    db.commit()

    return {
        "success": True, 
        "message": f"Updated status for detection {request.detection_idx}",
        "overrides": overrides
    }
