from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class IRISegment(BaseModel):
    segment_id: int
    distance_start: float
    distance_end: float
    segment_length: float
    iri_value: float
    mean_speed: float
    rms_accel: float
    speed_flag: str = "normal"  # 'normal', 'low_speed', or 'stopped'
    start_lat: Optional[float] = None
    start_lon: Optional[float] = None
    end_lat: Optional[float] = None
    end_lon: Optional[float] = None

class IRIDisplaySegment(BaseModel):
    """25m visual sub-segment for map rendering. Inherits IRI from parent calculation segment."""
    start_lat: Optional[float] = None
    start_lon: Optional[float] = None
    end_lat: Optional[float] = None
    end_lon: Optional[float] = None
    iri_value: float
    color: str = "#16a34a"
    mean_speed: float = 0.0
    speed_flag: str = "normal"
    parent_segment_id: int = 1
    distance_start: float = 0.0
    distance_end: float = 0.0

class IRIComputationRequest(BaseModel):
    segment_length: int = Field(default=25, description="Length of each IRI segment in meters")
    cutoff_freq: float = Field(default=10.0, description="Cutoff frequency for filtering")
    sampling_rate: Optional[float] = Field(default=None, description="Sampling rate (auto-detected if not provided)")

class IRIComputationResponse(BaseModel):
    success: bool
    message: str
    total_segments: int
    segments: List[IRISegment]
    display_segments: Optional[List[IRIDisplaySegment]] = None  # 25m sub-segments for map
    processing_time: float
    sampling_rate: float
    raw_data: Optional[List[dict]] = None
    filtered_data: Optional[List[dict]] = None

class FileUploadResponse(BaseModel):
    success: bool
    message: str
    id: Optional[int] = None
    filename: str
    file_size: int
    rows_processed: int
    duration: float

class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    details: Optional[str] = None
