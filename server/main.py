import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Verify the IRI calculator can be imported
try:
    from iri_calculator import IRICalculator
    logger.info("IRI Calculator imported successfully")
except ImportError as e:
    logger.warning(f"IRI Calculator not available: {e} (non-fatal, IRI features disabled)")

from api.v1.endpoints import auth, upload, iri, pothole, vehicle, pavement, presign, uploads
from core.config import settings
from core.database import engine
from models import user, upload as upload_models

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Digital Analytics for Asset-based Navigation of Roads",
    version=settings.PROJECT_VERSION
)

# Configure CORS from environment variable (comma-separated list)
# Example: CORS_ORIGINS=https://your-app.vercel.app,http://localhost:5173
cors_origins_str = os.getenv(
    "CORS_ORIGINS", 
    "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:5174"
)
origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

logger.info(f"CORS allowed origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(upload.router, prefix=f"{settings.API_V1_STR}/upload", tags=["upload"])
app.include_router(iri.router, prefix=f"{settings.API_V1_STR}/iri", tags=["iri"])
app.include_router(pothole.router, prefix=f"{settings.API_V1_STR}/pothole", tags=["pothole"])
app.include_router(vehicle.router, prefix=f"{settings.API_V1_STR}/vehicle", tags=["vehicle"])
app.include_router(pavement.router, prefix=f"{settings.API_V1_STR}/pavement", tags=["pavement"])
app.include_router(presign.router, prefix=f"{settings.API_V1_STR}/presign", tags=["presign"])
app.include_router(uploads.router, prefix=f"{settings.API_V1_STR}/uploads", tags=["uploads"])

@app.get("/")
async def root():
    return {"message": "Project DAAN Express API is running!"}

@app.api_route("/health", methods=["GET", "HEAD"])
async def health_check():
    """Health check endpoint - also pings database to keep connection warm."""
    from core.database import SessionLocal
    from sqlalchemy import text
    
    db_status = "unknown"
    try:
        # Quick ping to keep database connection warm
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)[:50]}"
    
    return {
        "status": "healthy", 
        "service": "Project DAAN Express API",
        "database": db_status
    }

@app.on_event("startup")
async def startup_event():
    """Create database tables on startup (with retry for cold starts)."""
    import time
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            user.Base.metadata.create_all(bind=engine)
            upload_models.Base.metadata.create_all(bind=engine)
            logger.info("Database tables created/verified successfully")
            return
        except Exception as e:
            logger.warning(f"Database init attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(5 * (attempt + 1))
            else:
                logger.error("Could not initialize database tables - will retry on first request")
                # Don't crash - let the app start anyway

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
