import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// In-flight GET deduplication: if the same URL is already in-flight, reuse the same promise.
// This prevents double-fetches when React StrictMode or rapid re-renders hit the same endpoint.
const _inflightGets = new Map();

const deduplicatedGet = (url, config) => {
    const key = url + (config?.params ? JSON.stringify(config.params) : '');
    if (_inflightGets.has(key)) {
        return _inflightGets.get(key);
    }
    const promise = api.get(url, config).finally(() => _inflightGets.delete(key));
    _inflightGets.set(key, promise);
    return promise;
};

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Store for the getToken function (not the token itself - tokens expire!)
let getTokenFunction = null;

// Function to set the getToken function from Clerk
export const setTokenGetter = (getTokenFn) => {
    getTokenFunction = getTokenFn;
};

// Legacy: set static token (for backwards compatibility)
export const setAuthToken = (token) => {
    // Store as backup in localStorage
    if (token) {
        localStorage.setItem('clerk_token_backup', token);
    }
};

// Add a request interceptor to add fresh auth token to headers
api.interceptors.request.use(
    async (config) => {
        let token = null;

        // Get fresh token from Clerk if available
        if (getTokenFunction) {
            try {
                token = await getTokenFunction();
            } catch (e) {
                console.warn('Failed to get fresh Clerk token:', e);
            }
        }

        // Fall back to localStorage for backwards compatibility
        if (!token) {
            token = localStorage.getItem('token') || localStorage.getItem('clerk_token_backup');
        }

        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Legacy auth service (kept for backwards compatibility during migration)
export const authService = {
    login: async (username, password) => {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        const response = await api.post('/auth/login/access-token', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        if (response.data.access_token) {
            localStorage.setItem('token', response.data.access_token);
        }
        return response.data;
    },
    register: async (email, password, fullName) => {
        const response = await api.post('/auth/register', {
            email,
            password,
            full_name: fullName,
        });
        return response.data;
    },
    logout: () => {
        localStorage.removeItem('token');
        currentAuthToken = null;
    },
    getCurrentUser: () => {
        return localStorage.getItem('token');
    },
    getUsers: async () => {
        const response = await api.get('/auth/users');
        return response.data;
    },
    updateUserRole: async (userId, role) => {
        const response = await api.put(`/auth/users/${userId}/role?role=${role}`);
        return response.data;
    },
};

export const fileService = {
    // Sync user with backend (called after Clerk login)
    syncUser: async (clerkToken) => {
        try {
            const response = await api.post('/auth/sync', {}, {
                headers: {
                    'Authorization': `Bearer ${clerkToken}`
                }
            });
            return response.data;
        } catch (error) {
            console.error('User sync error:', error);
            throw error;
        }
    },

    uploadFile: async (file, type = 'iri') => {
        const formData = new FormData();

        if (Array.isArray(file)) {
            file.forEach(f => formData.append('files', f));
        } else {
            formData.append('files', file);
        }

        try {
            const response = await api.post(`/upload/?type=${type}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            // Backend returns array, return first item if single file upload, else return all
            const data = response.data;
            return Array.isArray(file) ? { success: true, data } : (Array.isArray(data) ? data[0] : data);
        } catch (error) {
            console.error('Upload error:', error);
            // Enhanced error message
            const msg = error.response?.data?.detail
                ? (typeof error.response.data.detail === 'string' ? error.response.data.detail : JSON.stringify(error.response.data.detail))
                : 'Upload failed';
            return { success: false, message: msg };
        }
    },

    computeIRI: async (filename, segmentLength = 100) => {
        try {
            const response = await deduplicatedGet(`/iri/compute/${filename}?segment_length=${segmentLength}`);
            return response.data;
        } catch (error) {
            console.error('IRI computation error:', error);
            return { success: false, message: error.response?.data?.detail || 'Computation failed' };
        }
    },

    // Get cached IRI data (INSTANT - preferred method)
    getCachedIRI: async (filename) => {
        try {
            const response = await deduplicatedGet(`/iri/cached/${filename}`);
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                console.log('IRI cache miss, falling back to compute...');
                return fileService.computeIRI(filename);
            }
            console.error('Cached IRI error:', error);
            return { success: false, message: error.response?.data?.detail || 'Failed to get IRI data' };
        }
    },

    processPotholes: async (filename) => {
        try {
            const response = await deduplicatedGet(`/pothole/process/${filename}`);
            return response.data;
        } catch (error) {
            console.error('Pothole processing error:', error);
            return { success: false, message: error.response?.data?.detail || 'Processing failed' };
        }
    },

    processVehicles: async (filename) => {
        try {
            const response = await deduplicatedGet(`/vehicle/process/${filename}`);
            return response.data;
        } catch (error) {
            console.error('Vehicle processing error:', error);
            return { success: false, message: error.response?.data?.detail || 'Processing failed' };
        }
    },

    processPavement: async (filename) => {
        try {
            const response = await deduplicatedGet(`/pavement/process/${filename}`);
            return response.data;
        } catch (error) {
            console.error('Pavement processing error:', error);
            return { success: false, message: error.response?.data?.detail || 'Processing failed' };
        }
    },

    getUploadedFiles: async (category = null) => {
        try {
            const url = category ? `/upload/files/${category}` : '/upload/files';
            const response = await deduplicatedGet(url);
            return response.data;
        } catch (error) {
            console.error('Get files error:', error);
            return { success: false, message: error.response?.data?.detail || 'Failed to list files' };
        }
    },

    deleteFile: async (uploadId) => {
        try {
            const response = await api.delete(`/upload/${uploadId}`);
            return response.data;
        } catch (error) {
            console.error('Delete file error:', error);
            return { success: false, message: error.response?.data?.detail || 'Delete failed' };
        }
    },

    // ============================================
    // DIRECT-TO-R2 UPLOAD (Fast, bypasses backend)
    // ============================================

    /**
     * Get presigned URLs for batch upload directly to R2
     */
    getPresignedUrls: async (files, category = 'pothole') => {
        try {
            const fileRequests = files.map(file => ({
                filename: file.name,
                content_type: file.type || 'image/jpeg',
                category: category
            }));

            const response = await api.post('/presign/upload/batch', { files: fileRequests });
            return response.data;
        } catch (error) {
            console.error('Presign error:', error);
            throw new Error(error.response?.data?.detail || 'Failed to get upload URLs');
        }
    },

    /**
     * Upload a single file directly to R2 using presigned URL
     */
    uploadToR2: async (file, presignedUrl) => {
        try {
            // PUT directly to R2 (no auth header needed - signed URL has credentials)
            await axios.put(presignedUrl, file, {
                headers: {
                    'Content-Type': file.type || 'image/jpeg'
                }
            });
            return { success: true };
        } catch (error) {
            console.error('R2 upload error:', error);
            return { success: false, message: error.message };
        }
    },

    /**
     * Register a file with the backend after direct R2 upload
     */
    registerUpload: async (objectKey, originalFilename, fileSize, contentType, category = 'pothole') => {
        try {
            const response = await api.post('/presign/register', {
                object_key: objectKey,
                original_filename: originalFilename,
                file_size: fileSize,
                content_type: contentType,
                category: category
            });
            return response.data;
        } catch (error) {
            console.error('Register upload error:', error);
            return { success: false, message: error.response?.data?.detail || 'Failed to register upload' };
        }
    },

    /**
     * Upload multiple files directly to R2 (parallel, fast!)
     * @param files Array of File objects
     * @param category Upload category
     * @param onProgress Callback with { current, total, phase }
     */
    uploadDirectToR2: async (files, category = 'pothole', onProgress = null) => {
        const results = { success: 0, failed: 0 };

        // Step 1: Get presigned URLs for all files
        if (onProgress) onProgress({ phase: 'presigning', current: 0, total: files.length });
        const presignResponse = await fileService.getPresignedUrls(files, category);
        const urls = presignResponse.urls;

        if (!urls || urls.length === 0) {
            throw new Error('No presigned URLs received');
        }

        // Step 2: Upload all files in parallel (limited concurrency)
        const CONCURRENCY = 10; // Upload 10 files at a time

        for (let i = 0; i < urls.length; i += CONCURRENCY) {
            const batch = urls.slice(i, i + CONCURRENCY);
            const batchFiles = files.slice(i, i + CONCURRENCY);

            if (onProgress) onProgress({ phase: 'uploading', current: i, total: files.length });

            // Upload batch in parallel
            const uploadPromises = batch.map((urlInfo, idx) => {
                const file = batchFiles[idx];
                return fileService.uploadToR2(file, urlInfo.upload_url)
                    .then(res => ({ ...res, urlInfo, file }));
            });

            const batchResults = await Promise.all(uploadPromises);

            // Step 3: Register successful uploads
            for (const result of batchResults) {
                if (result.success) {
                    await fileService.registerUpload(
                        result.urlInfo.object_key,
                        result.file.name,
                        result.file.size,
                        result.file.type || 'image/jpeg',
                        category
                    );
                    results.success++;
                } else {
                    results.failed++;
                }
            }
        }

        if (onProgress) onProgress({ phase: 'complete', current: files.length, total: files.length });

        return results;
    }
};

export default api;
