import os
import aiofiles
import uuid
from pathlib import Path
from typing import Optional, List, Dict
from fastapi import UploadFile, HTTPException
from services.storage_service import get_storage_service

class FileHandler:
    def __init__(self):
        self.storage = get_storage_service()
    
    async def save_uploaded_file(self, file: UploadFile, user_id: int, category: str, directory: str = "") -> str:
        """
        Save uploaded file using the configured storage service
        Args:
            file: The uploaded file
            user_id: ID of the user uploading the file
            category: Category of upload (pothole, iri, vehicle)
            directory: Optional subdirectory within category (e.g., batch_id)
        Returns:
            storage_path: Path where file is stored
        """
        return await self.storage.save_file(file, user_id, category, directory=directory)
            
    def get_file_info(self, file_path: str) -> dict:
        """
        Get basic information about a file
        Note: detailed info might be expensive on S3, so we return basic info
        """
        return {
            "filename": os.path.basename(file_path),
            "path": file_path,
            "url": self.storage.get_file_url(file_path)
        }
    
    def cleanup_file(self, file_path: str) -> bool:
        """
        Delete a file
        DEPRECATED: Use delete_file_async instead.
        This provides a sync wrapper but it can't await the async storage call properly 
        without an event loop if not already in one.
        But since we are in FastAPI info context, we should really update callers.
        """
        raise NotImplementedError("Use delete_file_async instead")

    async def delete_file_async(self, file_path: str) -> bool:
         return await self.storage.delete_file(file_path)

    def list_uploaded_files(self) -> list:
        """
        List all files
        """
        return self.storage.list_files()
