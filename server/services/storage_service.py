import os
import shutil
import boto3
import logging
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from pathlib import Path
from fastapi import UploadFile, HTTPException
import uuid
import aiofiles
from core.config import settings

logger = logging.getLogger(__name__)

class StorageService(ABC):
    @abstractmethod
    async def save_file(self, file: UploadFile, user_id: int, category: str, directory: str = "") -> str:
        """
        Save file to storage organized by user_id and category
        Args:
            file: The uploaded file
            user_id: ID of the user uploading the file
            category: Category of upload (pothole, iri, vehicle)
            directory: Optional subdirectory within category
        Returns:
            storage_path: Path where file is stored
        """
        pass

    @abstractmethod
    async def delete_file(self, file_path: str) -> bool:
        pass

    @abstractmethod
    def get_file_url(self, file_path: str) -> str:
        pass
        
    @abstractmethod
    def list_files(self, directory: str = "") -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_file_content(self, file_path: str) -> bytes:
        """Retrieve file content as bytes"""
        pass

    @abstractmethod
    def get_file_stream(self, file_path: str):
        """Retrieve file content as a stream iterator"""
        pass

class LocalStorageService(StorageService):
    def __init__(self, base_dir: str = "uploads"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(exist_ok=True)
        
    async def save_file(self, file: UploadFile, user_id: int, category: str, directory: str = "") -> str:
        try:
            # Create user-specific directory structure: user_id/category/
            user_dir = self.base_dir / str(user_id) / category
            if directory:
                user_dir = user_dir / directory
            user_dir.mkdir(exist_ok=True, parents=True)
                
            # Generate unique filename
            file_extension = Path(file.filename).suffix if file.filename else ""
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            file_path = user_dir / unique_filename
            
            # Save file
            async with aiofiles.open(file_path, 'wb') as f:
                content = await file.read()
                await f.write(content)
            
            # Reset file pointer for subsequent reads
            await file.seek(0)
                
            # Return relative path for database storage
            relative_path = f"{user_id}/{category}"
            if directory:
                relative_path += f"/{directory}"
            return f"{relative_path}/{unique_filename}"
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Local storage error: {str(e)}")

    async def delete_file(self, file_path: str) -> bool:
        try:
            full_path = self.base_dir / file_path
            if full_path.exists():
                full_path.unlink()
                return True
            return False
        except Exception:
            return False

    def get_file_url(self, file_path: str) -> str:
        # In local dev, we serve files statically or via an endpoint
        # The frontend will construct the full URL
        return file_path
        
    def list_files(self, directory: str = "") -> List[Dict[str, Any]]:
        try:
            target_dir = self.base_dir
            if directory:
                target_dir = target_dir / directory
                
            if not target_dir.exists():
                return []
                
            files = []
            for path in target_dir.iterdir():
                if path.is_file():
                    stat = path.stat()
                    files.append({
                        "filename": path.name,
                        "path": str(path.relative_to(self.base_dir)),
                        "size": stat.st_size,
                        "updated": stat.st_mtime
                    })
            return files
        except Exception:
            return []

    def get_file_content(self, file_path: str) -> bytes:
        try:
            full_path = self.base_dir / file_path
            return full_path.read_bytes()
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    def get_file_stream(self, file_path: str):
        full_path = self.base_dir / file_path
        if not full_path.exists():
             raise HTTPException(status_code=404, detail="File not found")
        
        # Generator to yield file chunks
        with open(full_path, "rb") as f:
            while chunk := f.read(64 * 1024):  # 64KB chunks
                yield chunk

class R2StorageService(StorageService):
    def __init__(self):
        self.s3_client = boto3.client(
            service_name='s3',
            endpoint_url=settings.R2_ENDPOINT_URL,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name='auto'  # Cloudflare R2 requires a region, often 'auto' works or 'us-east-1'
        )
        self.bucket_name = settings.R2_BUCKET_NAME
    
    def _generate_unique_filename(self, original_filename: str, prefix: str) -> str:
        """
        Generate a unique filename based on original, adding _1, _2, etc if duplicates exist.
        """
        from pathlib import Path as PurePath
        
        # Clean the filename
        base_name = PurePath(original_filename).stem
        extension = PurePath(original_filename).suffix.lower()
        
        # Sanitize filename (remove problematic characters)
        import re
        base_name = re.sub(r'[^\w\-.]', '_', base_name)
        
        # Check if this exact key exists
        target_key = f"{prefix}/{base_name}{extension}"
        
        try:
            # Check if object exists
            self.s3_client.head_object(Bucket=self.bucket_name, Key=target_key)
            # If we get here, it exists - need to find unique suffix
            
            suffix = 1
            while suffix < 1000:  # Safety limit
                target_key = f"{prefix}/{base_name}_{suffix}{extension}"
                try:
                    self.s3_client.head_object(Bucket=self.bucket_name, Key=target_key)
                    suffix += 1
                except:
                    # This one doesn't exist, use it
                    return f"{base_name}_{suffix}{extension}"
            
            # Fallback to UUID if too many duplicates
            return f"{base_name}_{uuid.uuid4().hex[:8]}{extension}"
            
        except:
            # Object doesn't exist, use original name
            return f"{base_name}{extension}"
        
    async def save_file(self, file: UploadFile, user_id: int, category: str, directory: str = "") -> str:
        try:
            # Construct prefix for file path
            prefix = f"{user_id}/{category}"
            if directory:
                prefix += f"/{directory}"
            
            # Generate unique filename based on original (with _1, _2 for duplicates)
            unique_filename = self._generate_unique_filename(file.filename or "unnamed", prefix)
            
            # Construct full object key
            object_key = f"{prefix}/{unique_filename}"
            
            # Upload file
            file.file.seek(0)
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=file.file
            )
            
            # Reset file pointer
            await file.seek(0)
            
            logger.info(f"R2: Saved '{file.filename}' as '{object_key}'")
            return object_key
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"R2 storage error: {str(e)}")

    async def delete_file(self, file_path: str) -> bool:
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=file_path)
            return True
        except Exception as e:
            logger.warning(f"R2: Error deleting '{file_path}': {e}")
            return False

    def get_file_url(self, file_path: str) -> str:
        # Generate a public URL or a presigned URL
        # For public buckets:
        # return f"{settings.R2_PUBLIC_URL}/{file_path}"
        
        # For now, let's assume we use presigned URLs for strict access, or just return the key
        # if the frontend knows how to build the public URL.
        # Let's generate a presigned URL for safety.
        try:
            url = self.s3_client.generate_presigned_url(
                ClientMethod='get_object',
                Params={'Bucket': self.bucket_name, 'Key': file_path},
                ExpiresIn=86400  # 24 hours — prevents expiry during long work sessions
            )
            return url
        except Exception:
            return file_path
            
    def list_files(self, directory: str = "") -> List[Dict[str, Any]]:
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=directory
            )
            
            files = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    files.append({
                        "filename": Path(obj['Key']).name,
                        "path": obj['Key'],
                        "size": obj['Size'],
                        "updated": obj['LastModified'].isoformat()
                    })
            return files
        except Exception:
            return []

    def get_file_content(self, file_path: str) -> bytes:
        try:
            logger.debug(f"R2: Fetching Key='{file_path}' from Bucket='{self.bucket_name}'")
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=file_path)
            return response['Body'].read()
        except Exception as e:
            logger.error(f"R2: Failed to fetch '{file_path}': {e}")
            raise HTTPException(status_code=500, detail=f"Error retrieving file from R2: {str(e)}")

    def get_file_stream(self, file_path: str):
        try:
            logger.debug(f"R2: Streaming Key='{file_path}'")
            # get_object returns a dict with 'Body' which is a StreamingBody
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=file_path)
            # iter_chunks yields bytes
            return response['Body'].iter_chunks(chunk_size=64 * 1024)
        except Exception as e:
            logger.error(f"R2: Failed to stream '{file_path}': {e}")
            raise HTTPException(status_code=500, detail=f"Error streaming file from R2: {str(e)}")

    def generate_presigned_upload_url(self, object_key: str, content_type: str = "image/jpeg", expires_in: int = 300) -> str:
        """
        Generate a presigned URL for direct browser-to-R2 upload.
        
        Args:
            object_key: The destination path in the bucket (e.g., "1/pothole/image.jpg")
            content_type: MIME type of the file being uploaded
            expires_in: URL validity in seconds (default 5 minutes)
        
        Returns:
            Presigned URL that allows PUT upload directly to R2
        """
        try:
            url = self.s3_client.generate_presigned_url(
                ClientMethod='put_object',
                Params={
                    'Bucket': self.bucket_name, 
                    'Key': object_key,
                    'ContentType': content_type
                },
                ExpiresIn=expires_in
            )
            logger.info(f"R2: Generated presigned upload URL for '{object_key}'")
            return url
        except Exception as e:
            logger.error(f"R2: Failed to generate presigned upload URL: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to generate upload URL: {str(e)}")

def get_storage_service() -> StorageService:
    if settings.STORAGE_MODE == "s3":
        return R2StorageService()
    return LocalStorageService()
