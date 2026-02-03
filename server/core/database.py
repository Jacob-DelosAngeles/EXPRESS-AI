from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from sqlalchemy.exc import OperationalError
import time
import logging

from core.config import settings

logger = logging.getLogger(__name__)

SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL
# For PostgreSQL, use: "postgresql://user:password@postgresserver/db"

connect_args = {}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    # PostgreSQL connection options - optimized for Supabase Transaction Pooler
    connect_args = {
        "connect_timeout": 15,           # Faster timeout, we'll retry instead
        "keepalives": 1,                 # Enable TCP keepalives
        "keepalives_idle": 30,           # Seconds before sending keepalive
        "keepalives_interval": 10,       # Interval between keepalives
        "keepalives_count": 5,           # Number of keepalives before giving up
        "options": "-c statement_timeout=30000"  # 30s statement timeout
    }

# Configure engine with optimized pool settings for Supabase Transaction Pooler
# Key insight: Transaction pooler (port 6543) requires:
# - pre_ping=True to detect stale connections
# - Smaller pool to avoid exhausting pooler limits
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args=connect_args,
    poolclass=QueuePool,
    pool_pre_ping=True,           # CRITICAL: Check if connection is alive before use
    pool_recycle=120,             # Recycle connections every 2 minutes
    pool_size=3,                  # Small pool (Supabase free tier has ~60 connections)
    max_overflow=2,               # Limited overflow to prevent pool exhaustion
    pool_timeout=30,              # Wait up to 30s for a connection from pool
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db_with_retry(max_retries: int = 3, retry_delay: float = 2.0):
    """
    Database session with automatic retry for cold start connection failures.
    Use this for critical paths that need extra resilience.
    """
    last_error = None
    for attempt in range(max_retries):
        try:
            db = SessionLocal()
            # Test the connection
            db.execute("SELECT 1")
            yield db
            return
        except OperationalError as e:
            last_error = e
            logger.warning(f"Database connection attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
        finally:
            try:
                db.close()
            except:
                pass
    
    # All retries failed
    logger.error(f"Database connection failed after {max_retries} attempts")
    raise last_error


def get_db():
    """
    Database session dependency.
    Creates a new session for each request and closes it when done.
    Uses pool_pre_ping to automatically retry stale connections.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
