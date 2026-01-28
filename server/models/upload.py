from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Float, Text
from sqlalchemy.orm import relationship
from core.database import Base
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# SQLAlchemy Models
from sqlalchemy import Index

class UploadModel(Base):
    __tablename__ = "uploads"
    
    # Composite index for the image proxy lookup
    # Improves: db.query(UploadModel).filter(category='pothole', original_filename=filename)
    __table_args__ = (
        Index('idx_pothole_lookup', 'category', 'original_filename'),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False, index=True) # Added index for fast proxy lookup
    file_type = Column(String, nullable=False)  # csv, jpg, png, etc.
    category = Column(String, nullable=False, index=True)  # pothole, iri, vehicle
    storage_path = Column(String, nullable=False)  # Path in storage (local or R2)
    file_size = Column(Integer, nullable=False)  # Size in bytes
    file_hash = Column(String, nullable=True, index=True)  # MD5/SHA256 hash for deduplication
    upload_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Cached processed data (for fast loading)
    cached_data = Column(Text, nullable=True)  # Cached processed JSON response
    cache_timestamp = Column(DateTime, nullable=True)  # When cache was created

    # Persistent status overrides (e.g. manual deletions, visibility)
    # Format: { "detection_idx": { "deleted": bool, "hidden": bool } }
    status_overrides = Column(Text, nullable=True)
    
    # Relationships
    user = relationship("UserModel", back_populates="uploads")
    pothole_images = relationship("PotholeImageModel", back_populates="upload", cascade="all, delete-orphan")


class PotholeImageModel(Base):
    __tablename__ = "pothole_images"

    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(Integer, ForeignKey("uploads.id"), nullable=False, index=True)
    image_path = Column(String, nullable=False)  # Path to image in storage
    frame_number = Column(Integer, nullable=True)  # Frame number from CSV
    detection_confidence = Column(Float, nullable=True)  # Detection confidence score
    upload_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    upload = relationship("UploadModel", back_populates="pothole_images")


# Pydantic Schemas
class PotholeImageBase(BaseModel):
    image_path: str
    frame_number: Optional[int] = None
    detection_confidence: Optional[float] = None


class PotholeImage(PotholeImageBase):
    id: int
    upload_id: int
    upload_date: datetime
    
    class Config:
        from_attributes = True


class UploadBase(BaseModel):
    filename: str
    original_filename: str
    file_type: str
    category: str
    file_size: int


class UploadCreate(UploadBase):
    storage_path: str
    user_id: int


class Upload(UploadBase):
    id: int
    user_id: int
    storage_path: str
    upload_date: datetime
    status_overrides: Optional[str] = None
    pothole_images: List[PotholeImage] = []
    
    class Config:
        from_attributes = True


class UploadResponse(BaseModel):
    success: bool
    message: str
    upload: Optional[Upload] = None
