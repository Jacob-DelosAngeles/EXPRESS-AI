"""
Desktop Authentication Stub for DAAN-FERN

Replaces Clerk authentication with a local "auto-superuser" pattern.
In Desktop Mode, there is exactly ONE user who owns the computer,
so we skip all authentication and grant full access.

This module is monkey-patched into the server at startup by desktop_main.py.
"""

import logging
from fastapi import Depends
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# We will import these AFTER sys.path is configured by desktop_main.py
# so they resolve correctly from the server/ directory.
_user_model = None
_get_db = None


def _lazy_imports():
    """Perform lazy imports to avoid circular dependency issues."""
    global _user_model, _get_db
    if _user_model is None:
        from models.user import UserModel
        from core.database import get_db, SessionLocal, Base, engine
        
        # Ensure tables exist (SQLite auto-creates)
        Base.metadata.create_all(bind=engine)
        
        _user_model = UserModel
        _get_db = get_db


def get_or_create_desktop_user(db: Session):
    """
    Get or create the single desktop user.
    
    This user is always a superuser with full access.
    """
    _lazy_imports()
    
    # Look for existing desktop user
    user = db.query(_user_model).filter(
        _user_model.email == "desktop@local"
    ).first()
    
    if user:
        return user
    
    # First run: create the desktop user
    user = _user_model(
        email="desktop@local",
        clerk_id="desktop-local-user",
        full_name="Desktop User",
        role="superuser",
        is_active=True,
        hashed_password=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    logger.info("Created desktop superuser account")
    return user


def get_current_user_desktop(db: Session = Depends(None)):
    """
    Desktop auth dependency — replaces Clerk's get_current_user.
    
    Always returns the local superuser. No token required.
    The `Depends(None)` for db will be replaced at monkey-patch time
    with the real `get_db` dependency.
    """
    _lazy_imports()
    
    # We need to get a fresh DB session
    from core.database import SessionLocal
    db = SessionLocal()
    try:
        return get_or_create_desktop_user(db)
    finally:
        db.close()


def create_desktop_auth_dependency():
    """
    Create a proper FastAPI dependency for desktop auth.
    
    Returns a function compatible with FastAPI's `Depends()`.
    """
    _lazy_imports()
    from core.database import get_db
    
    def _get_current_user(db: Session = Depends(get_db)):
        return get_or_create_desktop_user(db)
    
    return _get_current_user
