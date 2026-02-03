import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, AlertCircle, CheckCircle, Map as MapIcon, Car, AlertTriangle, Activity, Layers, Trash, X, Menu, Calculator, LayoutList } from 'lucide-react';
import { fileService } from '../services/api';
import useAppStore from '../store/useAppStore';
// ... (imports)



const StreamlitHeader = ({ title, icon: Icon }) => (
  <div className="bg-[#262730] text-white p-3 rounded-md flex items-center justify-center mb-2 shadow-sm">
    {Icon && <Icon size={18} className="mr-2" />}
    <span className="font-semibold text-sm">{title}</span>
  </div>
);

const UploadSection = ({ title, subLabel, onUpload, icon, accept = { 'text/csv': ['.csv'] } }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [fileName, setFileName] = useState('');

  const onDrop = async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    setLoading(true);
    setError(null);
    setSuccess(false);
    setFileName(acceptedFiles[0].name);

    try {
      await onUpload(acceptedFiles[0]);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles: 1
  });

  return (
    <div className="mb-6">
      <StreamlitHeader title={title} icon={icon} />

      <div className="px-1">
        <p className="text-xs text-gray-600 mb-2 font-medium">{subLabel}</p>

        <div
          {...getRootProps()}
          className={`bg-white border border-gray-300 rounded p-4 flex items-center justify-between cursor-pointer hover:border-red-400 transition-colors ${isDragActive ? 'border-red-500 bg-red-50' : ''
            }`}
        >
          <input {...getInputProps()} />
          <div className="flex items-center text-gray-500">
            <Upload size={16} className="mr-2" />
            <span className="text-xs">Drag and drop files here</span>
          </div>
          <button className="bg-white border border-gray-300 text-xs px-3 py-1 rounded hover:bg-gray-50 transition-colors">
            Browse files
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Limit 200MB per file • CSV</p>

        {loading && <p className="mt-2 text-xs text-blue-600 font-medium animate-pulse">Processing...</p>}

        {error && (
          <div className="mt-2 flex items-start text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
            <AlertCircle size={14} className="mr-1 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-2 flex items-center text-xs text-green-700 bg-green-50 p-2 rounded border border-green-100">
            <CheckCircle size={14} className="mr-1 flex-shrink-0" />
            <span className="truncate">Uploaded: {fileName}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const PotholeUploadSection = ({ title, onUpload, icon }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);

  // Progress tracking
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, phase: '' });

  const handleCsvDrop = (acceptedFiles) => {
    if (acceptedFiles.length > 0) setCsvFile(acceptedFiles[0]);
  };

  const handleImagesDrop = (acceptedFiles) => {
    if (acceptedFiles.length > 0) setImageFiles(prev => [...prev, ...acceptedFiles]);
  };

  const { getRootProps: getCsvRoot, getInputProps: getCsvInput } = useDropzone({
    onDrop: handleCsvDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1
  });

  const { getRootProps: getImagesRoot, getInputProps: getImagesInput } = useDropzone({
    onDrop: handleImagesDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'] },
    multiple: true
  });

  const handleUpload = async () => {
    if (!csvFile) {
      setError('CSV file is required');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    setUploadProgress({ current: 0, total: imageFiles.length, phase: 'Starting upload...' });

    try {
      // Pass all files at once with a progress callback
      const allFiles = [csvFile, ...imageFiles];

      // Progress callback that updates the UI
      const onProgress = (progress) => {
        if (progress.phase === 'csv') {
          setUploadProgress({ current: 0, total: imageFiles.length, phase: 'Uploading CSV...' });
        } else if (progress.phase === 'images') {
          setUploadProgress({
            current: progress.current,
            total: progress.total,
            phase: `Uploading images ${progress.current}/${progress.total}...`
          });
        } else if (progress.phase === 'processing') {
          setUploadProgress({ current: imageFiles.length, total: imageFiles.length, phase: 'Processing data...' });
        }
      };

      await onUpload(allFiles, onProgress);

      setUploadProgress({ current: imageFiles.length, total: imageFiles.length, phase: 'Complete!' });
      setSuccess(true);
      setCsvFile(null);
      setImageFiles([]);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  // Calculate progress percentage
  const progressPercent = uploadProgress.total > 0
    ? Math.round((uploadProgress.current / uploadProgress.total) * 100)
    : (loading ? 0 : 100); // Show 100% when not loading or 0% if loading with no images


  return (
    <div className="mb-6">
      <StreamlitHeader title={title} icon={icon} />

      <div className="px-1 space-y-3">
        {/* CSV Input */}
        <div>
          <p className="text-xs text-gray-600 mb-1 font-medium">1. Pothole Data CSV (Required)</p>
          <div {...getCsvRoot()} className="bg-white border border-gray-300 rounded p-3 flex items-center justify-between cursor-pointer hover:border-blue-400">
            <input {...getCsvInput()} />
            <div className="flex items-center text-gray-500 truncate">
              <Upload size={14} className="mr-2 flex-shrink-0" />
              <span className="text-xs truncate">{csvFile ? csvFile.name : 'Drag CSV here'}</span>
            </div>
          </div>
        </div>

        {/* Images Input */}
        <div>
          <p className="text-xs text-gray-600 mb-1 font-medium">2. Pothole Images (Optional)</p>
          <div {...getImagesRoot()} className="bg-white border border-gray-300 rounded p-3 flex items-center justify-between cursor-pointer hover:border-blue-400">
            <input {...getImagesInput()} />
            <div className="flex items-center text-gray-500 truncate">
              <Upload size={14} className="mr-2 flex-shrink-0" />
              <span className="text-xs truncate">{imageFiles.length > 0 ? `${imageFiles.length} images selected` : 'Drag images here'}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar (shown during upload) */}
        {loading && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-600">
              <span>{uploadProgress.phase}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={loading || !csvFile}
          className={`w-full py-2 rounded text-xs font-semibold text-white transition-colors ${loading || !csvFile ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? `Uploading... ${progressPercent}%` : 'Upload Batch'}
        </button>

        {error && (
          <div className="mt-2 flex items-start text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
            <AlertCircle size={14} className="mr-1 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-2 flex items-center text-xs text-green-700 bg-green-50 p-2 rounded border border-green-100">
            <CheckCircle size={14} className="mr-1 flex-shrink-0" />
            <span>Upload successful!</span>
          </div>
        )}
      </div>
    </div>
  );
};

const LayerToggle = ({ label, active, onToggle, color }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
    <div className="flex items-center">
      <span className={`w-3 h-3 rounded-full mr-2 ${color}`}></span>
      <span className="text-sm text-gray-700">{label}</span>
    </div>
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={active} onChange={onToggle} className="sr-only peer" />
      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#ff4b4b]"></div>
    </label>
  </div>
);

const Sidebar = () => {
  const {
    setVehicles, setPotholes, setCracks, setPavement,
    potholes, cracks,
    iriFiles, setIriFiles, addIriFile, toggleIriFile, removeIriFile, clearIriFiles,
    potholeFiles, setPotholeFiles, addPotholeFile, togglePotholeFile, removePotholeFile, clearPotholeFiles,
    crackFiles, setCrackFiles, addCrackFile, toggleCrackFile, removeCrackFile, clearCrackFiles,
    vehicleFiles, setVehicleFiles, addVehicleFile, toggleVehicleFile, removeVehicleFile, clearVehicleFiles,
    pavementFiles, setPavementFiles, addPavementFile, togglePavementFile, removePavementFile, clearPavementFiles,
    activeLayers, toggleLayer
  } = useAppStore();

  const [isOpen, setIsOpen] = useState(false); // Mobile toggle state

  // Close sidebar when active layer changes on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsOpen(true); // Always open on desktop
      } else {
        setIsOpen(false); // Closed by default on mobile
      }
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [deleteConfirm, setDeleteConfirm] = useState(null); // ID of file pending deletion confirmation
  const [isRestoring, setIsRestoring] = useState(true); // Track initial data loading
  const [restoreError, setRestoreError] = useState(null); // Track loading errors

  // IRI Segment Length Configuration (global setting)
  const [segmentLength, setSegmentLength] = useState(100); // Default 100m
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Recalculate IRI for VISIBLE files only when segment length changes
  // Uses delays between files to allow backend GC and prevent OOM
  const recalculateAllIri = async (newSegmentLength) => {
    // Only process visible files to reduce load
    const visibleFiles = iriFiles.filter(f => f.visible);
    if (visibleFiles.length === 0) {
      alert('No visible IRI files to recalculate. Check at least one file.');
      return;
    }

    setIsRecalculating(true);
    const DELAY_BETWEEN_FILES = 5000; // 5 seconds to allow backend GC
    let successCount = 0;

    for (let i = 0; i < visibleFiles.length; i++) {
      const file = visibleFiles[i];

      try {
        // Add delay between files (not before first one)
        if (i > 0) {
          console.log(`Waiting ${DELAY_BETWEEN_FILES / 1000}s before next file...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_FILES));
        }

        console.log(`Recalculating ${file.filename} (${i + 1}/${visibleFiles.length})...`);

        // Force recompute with new segment length
        const computeRes = await fileService.computeIRI(file.id, newSegmentLength);
        if (computeRes.success) {
          // Update this file in the full list
          setIriFiles(prev => prev.map(f =>
            f.id === file.id ? {
              ...f,
              segments: computeRes.segments,
              raw_data: computeRes.raw_data,
              filtered_data: computeRes.filtered_data,
              stats: {
                averageIri: (computeRes.segments && computeRes.segments.length > 0) ? computeRes.segments.reduce((acc, seg) => acc + seg.iri_value, 0) / computeRes.segments.length : 0,
                maxIri: (computeRes.segments && computeRes.segments.length > 0) ? Math.max(...computeRes.segments.map(s => s.iri_value)) : 0,
                avgSpeed: (computeRes.segments && computeRes.segments.length > 0) ? computeRes.segments.reduce((acc, seg) => acc + seg.mean_speed, 0) / computeRes.segments.length : 0,
                totalDistance: (computeRes.segments && computeRes.segments.length > 0) ? computeRes.segments[computeRes.segments.length - 1].distance_end : 0,
                totalSegments: computeRes.total_segments || 0
              }
            } : f
          ));
          successCount++;
          console.log(`✓ ${file.filename} recalculated successfully`);
        } else {
          console.warn(`✗ Failed to recalculate ${file.filename}: ${computeRes.message}`);
        }
      } catch (e) {
        console.error(`✗ Error recalculating ${file.filename}:`, e);
        // Stop on network error (likely OOM crash)
        if (e.message?.includes('Network') || e.code === 'ERR_NETWORK') {
          console.error('Server may have crashed. Stopping recalculation.');
          alert(`Server error after ${successCount} file(s). Please wait and try again.`);
          break;
        }
      }
    }

    setIsRecalculating(false);
    if (successCount === visibleFiles.length) {
      console.log(`All ${successCount} files recalculated successfully!`);
    }
  };

  // Handle slider change with debounce for smooth interaction
  const handleSegmentLengthChange = (e) => {
    const newValue = parseInt(e.target.value, 10);
    setSegmentLength(newValue);
  };

  // Trigger recalculation when slider is released (not during drag)
  const handleSegmentLengthCommit = () => {
    recalculateAllIri(segmentLength);
  };

  // Per-file segment length editing
  const [editingSegmentFile, setEditingSegmentFile] = useState(null); // ID of file being edited
  const [editSegmentLength, setEditSegmentLength] = useState(100); // Temp value during editing

  // Recalculate IRI for a SINGLE file (safer for large files)
  const recalculateSingleIri = async (fileId, newSegmentLength) => {
    const file = iriFiles.find(f => f.id === fileId);
    if (!file) return;

    setIsRecalculating(true);

    try {
      console.log(`Recalculating ${file.filename} with ${newSegmentLength}m segments...`);

      const computeRes = await fileService.computeIRI(file.id, newSegmentLength);
      if (computeRes.success) {
        // Update the specific file in the array
        // Note: Zustand doesn't support callback pattern, so we read current state
        const updatedFiles = iriFiles.map(f =>
          f.id === fileId ? {
            ...f,
            segmentLength: newSegmentLength,
            segments: computeRes.segments,
            raw_data: computeRes.raw_data,
            filtered_data: computeRes.filtered_data,
            stats: {
              averageIri: (computeRes.segments && computeRes.segments.length > 0) ? computeRes.segments.reduce((acc, seg) => acc + seg.iri_value, 0) / computeRes.segments.length : 0,
              maxIri: (computeRes.segments && computeRes.segments.length > 0) ? Math.max(...computeRes.segments.map(s => s.iri_value)) : 0,
              avgSpeed: (computeRes.segments && computeRes.segments.length > 0) ? computeRes.segments.reduce((acc, seg) => acc + seg.mean_speed, 0) / computeRes.segments.length : 0,
              totalDistance: (computeRes.segments && computeRes.segments.length > 0) ? computeRes.segments[computeRes.segments.length - 1].distance_end : 0,
              totalSegments: computeRes.total_segments || 0
            }
          } : f
        );
        setIriFiles(updatedFiles);
        console.log(`✓ ${file.filename} recalculated at ${newSegmentLength}m`);
      } else {
        alert(`Failed: ${computeRes.message}`);
      }
    } catch (e) {
      console.error(`Error:`, e);
      alert(`Server error. Try again in a moment.`);
    }

    setIsRecalculating(false);
    setEditingSegmentFile(null);
  };

  // Sync Pothole Files to Map Layer
  useEffect(() => {
    const activeMarkers = potholeFiles
      .filter(f => f.visible)
      .flatMap(f => f.data || []);
    setPotholes(activeMarkers);
  }, [potholeFiles, setPotholes]);

  // Sync Crack Files to Map Layer
  useEffect(() => {
    const activeMarkers = crackFiles
      .filter(f => f.visible)
      .flatMap(f => f.data || []);
    setCracks(activeMarkers);
  }, [crackFiles, setCracks]);

  // Sync Vehicle Files to Map Layer
  useEffect(() => {
    const activeMarkers = vehicleFiles
      .filter(f => f.visible)
      .flatMap(f => f.data || []);
    setVehicles(activeMarkers);
  }, [vehicleFiles, setVehicles]);

  // Sync Pavement Files to Map Layer
  useEffect(() => {
    const activeSegments = pavementFiles
      .filter(f => f.visible)
      .flatMap(f => f.data || []);
    setPavement(activeSegments);
  }, [pavementFiles, setPavement]);

  // Persistence: Restore files on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // 1. Restore IRI Files (PARALLEL for speed)
        const iriRes = await fileService.getUploadedFiles('iri');
        if (iriRes.success && iriRes.files) {
          const uniqueFiles = {};
          iriRes.files.forEach(f => { uniqueFiles[f.original_filename] = f; });
          const filesToRestore = Object.values(uniqueFiles);

          // Parallel IRI processing
          const iriResults = await Promise.allSettled(
            filesToRestore.map(file => fileService.getCachedIRI(file.id))
          );

          const restoredIriFiles = iriResults
            .map((result, i) => {
              if (result.status === 'fulfilled' && result.value.success) {
                const computeRes = result.value;
                return {
                  id: filesToRestore[i].id,
                  filename: filesToRestore[i].original_filename,
                  segments: computeRes.segments,
                  raw_data: computeRes.raw_data,
                  filtered_data: computeRes.filtered_data,
                  visible: true,
                  stats: {
                    averageIri: (computeRes.segments && computeRes.segments.length > 0) ? computeRes.segments.reduce((acc, seg) => acc + seg.iri_value, 0) / computeRes.segments.length : 0,
                    maxIri: (computeRes.segments && computeRes.segments.length > 0) ? Math.max(...computeRes.segments.map(s => s.iri_value)) : 0,
                    avgSpeed: (computeRes.segments && computeRes.segments.length > 0) ? computeRes.segments.reduce((acc, seg) => acc + seg.mean_speed, 0) / computeRes.segments.length : 0,
                    totalDistance: (computeRes.segments && computeRes.segments.length > 0) ? computeRes.segments[computeRes.segments.length - 1].distance_end : 0,
                    totalSegments: computeRes.total_segments || 0
                  }
                };
              }
              return null;
            })
            .filter(Boolean);

          if (restoredIriFiles.length > 0) setIriFiles(restoredIriFiles);
        }

        // 2. Restore Pothole & Crack Data (PARALLEL for speed)
        const [potholeRes, crackRes, vehicleRes, pavementRes] = await Promise.all([
          fileService.getUploadedFiles('pothole'),
          fileService.getUploadedFiles('crack'),
          fileService.getUploadedFiles('vehicle'),
          fileService.getUploadedFiles('pavement')
        ]);

        // 2a. Restore Pothole Data (PARALLEL processing)
        if (potholeRes.success && potholeRes.files) {
          const csvFiles = potholeRes.files.filter(f => f.filename.endsWith('.csv'));
          const potholeResults = await Promise.allSettled(
            csvFiles.map(file => fileService.processPotholes(file.id))
          );
          const restored = potholeResults
            .map((result, i) => {
              if (result.status === 'fulfilled' && result.value.success) {
                return { id: csvFiles[i].id, filename: csvFiles[i].original_filename, data: result.value.data, visible: true };
              }
              return null;
            })
            .filter(Boolean);
          if (restored.length > 0) setPotholeFiles(restored);
        }

        // 2b. Restore Crack Data (PARALLEL processing)
        if (crackRes.success && crackRes.files) {
          const csvFiles = crackRes.files.filter(f => f.filename.endsWith('.csv'));
          const crackResults = await Promise.allSettled(
            csvFiles.map(file => fileService.processPotholes(file.id))
          );
          const restored = crackResults
            .map((result, i) => {
              if (result.status === 'fulfilled' && result.value.success) {
                return { id: csvFiles[i].id, filename: csvFiles[i].original_filename, data: result.value.data, visible: true, category: 'crack' };
              }
              return null;
            })
            .filter(Boolean);
          if (restored.length > 0) setCrackFiles(restored);
        }

        // 3. Restore Vehicle Data (PARALLEL processing)
        if (vehicleRes.success && vehicleRes.files) {
          const uniqueVehicles = {};
          vehicleRes.files.forEach(f => { uniqueVehicles[f.original_filename] = f; });
          const vehicleFiles = Object.values(uniqueVehicles);

          const vehicleResults = await Promise.allSettled(
            vehicleFiles.map(file => fileService.processVehicles(file.id))
          );
          const restoredVehicleFiles = vehicleResults
            .map((result, i) => {
              if (result.status === 'fulfilled' && result.value.success) {
                return { id: vehicleFiles[i].id, filename: vehicleFiles[i].original_filename, data: result.value.data, visible: true };
              }
              return null;
            })
            .filter(Boolean);
          if (restoredVehicleFiles.length > 0) setVehicleFiles(restoredVehicleFiles);
        }

        // 4. Restore Pavement Data (PARALLEL processing)
        if (pavementRes.success && pavementRes.files) {
          const uniquePavement = {};
          pavementRes.files.forEach(f => { uniquePavement[f.original_filename] = f; });
          const pavementFiles = Object.values(uniquePavement);

          const pavementResults = await Promise.allSettled(
            pavementFiles.map(file => fileService.processPavement(file.id))
          );
          const restoredPavementFiles = pavementResults
            .map((result, i) => {
              if (result.status === 'fulfilled' && result.value.success) {
                return { id: pavementFiles[i].id, filename: pavementFiles[i].original_filename, data: result.value.data, visible: true };
              }
              return null;
            })
            .filter(Boolean);
          if (restoredPavementFiles.length > 0) setPavementFiles(restoredPavementFiles);
        }


      } catch (err) {
        console.error("Failed to restore session:", err);
        setRestoreError('Failed to load data. Server may be starting up. Please try again.');
      } finally {
        setIsRestoring(false);
      }
    };

    restoreSession();
  }, []);

  // Retry loading data
  const handleRetryLoad = () => {
    setIsRestoring(true);
    setRestoreError(null);
    // Trigger page reload to restart the restore process
    window.location.reload();
  };

  const handleDeleteIri = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await fileService.deleteFile(id);
      if (res.success) {
        removeIriFile(id);
        setDeleteConfirm(null);
      } else {
        alert(res.message || 'Delete failed');
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleDeletePothole = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await fileService.deleteFile(id);
      if (res.success) {
        removePotholeFile(id);
        setDeleteConfirm(null);
      } else {
        alert(res.message || 'Delete failed');
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleDeleteCrack = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await fileService.deleteFile(id);
      if (res.success) {
        removeCrackFile(id);
        setDeleteConfirm(null);
      } else {
        alert(res.message || 'Delete failed');
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleDeleteVehicle = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await fileService.deleteFile(id);
      if (res.success) {
        removeVehicleFile(id);
        setDeleteConfirm(null);
      } else {
        alert(res.message || 'Delete failed');
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleDeletePavement = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await fileService.deleteFile(id);
      if (res.success) {
        removePavementFile(id);
        setDeleteConfirm(null);
      } else {
        alert(res.message || 'Delete failed');
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleIriUpload = async (file) => {
    const uploadRes = await fileService.uploadFile(file, 'iri');
    if (uploadRes.success) {
      // fileService returns the object directly for single files (no data prop), or {data: [...]} for arrays
      const result = uploadRes.data ? ((Array.isArray(uploadRes.data)) ? uploadRes.data[0] : uploadRes.data) : uploadRes;

      if (!result || !result.filename) throw new Error("Invalid response format from server");

      const filename = result.filename;

      // Use cached IRI data (already processed during upload)
      const computeRes = await fileService.getCachedIRI(result.id);
      if (computeRes.success) {
        addIriFile({
          id: result.id, // Use real DB ID
          filename: file.name,
          segments: computeRes.segments,
          raw_data: computeRes.raw_data,
          filtered_data: computeRes.filtered_data,
          stats: {
            averageIri: (computeRes.segments && computeRes.segments.length > 0) ? computeRes.segments.reduce((acc, seg) => acc + seg.iri_value, 0) / computeRes.segments.length : 0,
            maxIri: (computeRes.segments && computeRes.segments.length > 0) ? Math.max(...computeRes.segments.map(s => s.iri_value)) : 0,
            avgSpeed: (computeRes.segments && computeRes.segments.length > 0) ? computeRes.segments.reduce((acc, seg) => acc + seg.mean_speed, 0) / computeRes.segments.length : 0,
            totalDistance: (computeRes.segments && computeRes.segments.length > 0) ? computeRes.segments[computeRes.segments.length - 1].distance_end : 0,
            totalSegments: computeRes.total_segments || 0
          }
        });
      } else {
        throw new Error(computeRes.message);
      }
    } else {
      throw new Error(uploadRes.message);
    }
  };

  const handleVehicleUpload = async (file) => {
    const res = await fileService.uploadFile(file, 'vehicle');
    if (res.success) {
      const result = res.data ? ((Array.isArray(res.data)) ? res.data[0] : res.data) : res;
      if (!result || !result.filename) throw new Error("Invalid response format from server");

      const processRes = await fileService.processVehicles(result.id);
      if (processRes.success) {
        addVehicleFile({
          id: result.id, // Use real DB ID
          filename: file.name,
          data: processRes.data,
          visible: true
        });
      }
    } else throw new Error(res.message);
  };


  // Updated to use DIRECT-TO-R2 upload for images (fast, parallel, no OOM!)
  const handleDetectionUpload = async (category, files, onProgress = null) => {
    // files is now an array: [csv, ...images]
    const csvFile = files.find(f => f.name.toLowerCase().endsWith('.csv'));
    const imageFiles = files.filter(f => !f.name.toLowerCase().endsWith('.csv'));

    if (!csvFile) {
      throw new Error("No CSV file found in upload");
    }

    // Step 1: Upload CSV through backend
    console.log(`Uploading ${category} CSV first...`);
    if (onProgress) onProgress({ phase: 'csv', current: 0, total: imageFiles.length });

    const csvUploadRes = await fileService.uploadFile([csvFile], category);

    if (!csvUploadRes.success) {
      throw new Error(csvUploadRes.message || "CSV upload failed");
    }

    const csvResults = csvUploadRes.data || (Array.isArray(csvUploadRes) ? csvUploadRes : [csvUploadRes]);
    const csvResult = csvResults.find(r => (r.filename?.toLowerCase().endsWith('.csv') || r.original_filename?.toLowerCase().endsWith('.csv')) && r.success);

    if (!csvResult) {
      throw new Error("CSV upload failed or not found in response");
    }

    // Step 2: Upload images DIRECTLY TO R2
    if (imageFiles.length > 0) {
      console.log(`Uploading ${imageFiles.length} ${category} images directly to R2...`);

      try {
        const directUploadProgress = (progress) => {
          if (onProgress) {
            if (progress.phase === 'presigning') {
              onProgress({ phase: 'images', current: 0, total: imageFiles.length });
            } else if (progress.phase === 'uploading') {
              onProgress({ phase: 'images', current: progress.current, total: progress.total });
            } else if (progress.phase === 'complete') {
              onProgress({ phase: 'images', current: imageFiles.length, total: imageFiles.length });
            }
          }
        };

        const uploadResult = await fileService.uploadDirectToR2(imageFiles, category, directUploadProgress);
        console.log(`Direct R2 upload complete: ${uploadResult.success} succeeded, ${uploadResult.failed} failed`);
      } catch (directErr) {
        console.error('Direct R2 upload failed, falling back to backend upload:', directErr);
        for (let i = 0; i < imageFiles.length; i += 5) {
          const batch = imageFiles.slice(i, i + 5);
          if (onProgress) onProgress({ phase: 'images', current: i, total: imageFiles.length });
          await fileService.uploadFile(batch, category);
        }
      }
    }

    // Step 3: Process the CSV to get data
    if (onProgress) onProgress({ phase: 'processing', current: 0, total: 0 });

    const processRes = await fileService.processPotholes(csvResult.id);
    if (processRes.success) {
      const payload = {
        id: csvResult.id || Date.now(),
        filename: csvFile.name,
        data: processRes.data,
        visible: true,
        category: category
      };

      if (category === 'crack') {
        addCrackFile(payload);
      } else {
        addPotholeFile(payload);
      }
    } else {
      throw new Error(processRes.message);
    }
  };

  const handlePotholeUpload = (files, onProgress) => handleDetectionUpload('pothole', files, onProgress);
  const handleCrackUpload = (files, onProgress) => handleDetectionUpload('crack', files, onProgress);

  const handlePavementUpload = async (file) => {
    const res = await fileService.uploadFile(file, 'pavement');
    if (res.success) {
      const result = res.data ? ((Array.isArray(res.data)) ? res.data[0] : res.data) : res;
      if (!result || !result.filename) throw new Error("Invalid response format from server");

      const processRes = await fileService.processPavement(result.id);
      if (processRes.success) {
        addPavementFile({
          id: result.id, // Use real DB ID
          filename: file.name,
          data: processRes.data,
          visible: true
        });
      }
    } else throw new Error(res.message);
  };

  return (
    <>
      {/* Mobile Toggle Button (Visible only on mobile) */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-[160px] left-[10px] z-[3000] bg-white p-1 rounded shadow-md border-2 border-[rgba(0,0,0,0.2)] text-black hover:bg-gray-50 transition-colors"
        title="Open Menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-[2999] backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
          bg-blue-50 border-r border-gray-200 h-full overflow-y-auto flex-shrink-0 shadow-xl lg:shadow-sm z-[3001] custom-scrollbar
          fixed lg:relative inset-y-0 left-0
          transform transition-transform duration-300 ease-out
          w-80 lg:w-96
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>

        {/* Mobile Close Button inside Sidebar */}
        <button
          onClick={() => setIsOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-200 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="p-6">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-[#262730] mb-1">Express AI</h2>
            <div className="h-0.5 w-full bg-blue-500 mb-2 opacity-50"></div>
            <p className="text-xs text-gray-500 italic">Expert Platform for Road Evaluation and Smart Surveillance</p>
          </div>

          {/* Loading Indicator */}
          {isRestoring && (
            <div className="mb-6 bg-blue-100 border border-blue-300 rounded-lg p-4 text-center">
              <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mb-2"></div>
              <p className="text-sm font-medium text-blue-800">Loading your data...</p>
              <p className="text-xs text-blue-600 mt-1">This may take a moment on first load</p>
            </div>
          )}

          {/* Error with Retry */}
          {!isRestoring && restoreError && (
            <div className="mb-6 bg-amber-100 border border-amber-300 rounded-lg p-4 text-center">
              <p className="text-sm font-medium text-amber-800">⚠️ {restoreError}</p>
              <button
                onClick={handleRetryLoad}
                className="mt-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2 rounded transition-colors"
              >
                Retry Loading
              </button>
            </div>
          )}

          <UploadSection
            title="Vehicle Detection Data"
            subLabel="Upload Vehicle Detection CSV Files"
            icon={Car}
            onUpload={handleVehicleUpload}
          />

          {/* Replaced generic section with PotholeUploadSection */}
          <PotholeUploadSection
            title="Pothole Detection Data"
            icon={AlertTriangle}
            onUpload={handlePotholeUpload}
          />

          <PotholeUploadSection
            title="Crack Detection Data"
            icon={Activity}
            onUpload={handleCrackUpload}
          />

          <UploadSection
            title="IRI Sensor Data"
            subLabel="Upload IRI Sensor CSV Files"
            icon={Activity}
            onUpload={handleIriUpload}
          />

          <UploadSection
            title="Road Type Classification"
            subLabel="Upload Road Type CSV Files"
            icon={MapIcon}
            onUpload={handlePavementUpload}
          />


          {/* Cost Analysis Tools */}
          <div className="mt-8">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Calculator size={14} /> Cost Analysis
            </h3>
            <div className="space-y-2">

              {/* Budget Panel Toggle */}
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${activeLayers.showBudgetCalculator ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                    <LayoutList size={18} />
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${potholes.length > 0 ? 'text-gray-900' : 'text-gray-400'}`}>Budget Panel</div>
                    <div className="text-[10px] text-gray-500">REAL-TIME ESTIMATE</div>
                  </div>
                </div>
                <button
                  onClick={() => toggleLayer('showBudgetCalculator')}
                  disabled={potholes.length === 0}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${activeLayers.showBudgetCalculator ? 'bg-blue-600' : 'bg-gray-200'} ${potholes.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${activeLayers.showBudgetCalculator ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Heatmap Toggle */}
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${activeLayers.showCostHeatmap ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>
                    <Activity size={18} />
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${potholes.length > 0 ? 'text-gray-900' : 'text-gray-400'}`}>Cost Heatmap</div>
                    <div className="text-[10px] text-gray-500">DENSITY LAYER</div>
                  </div>
                </div>
                <button
                  onClick={() => toggleLayer('showCostHeatmap')}
                  disabled={potholes.length === 0}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${activeLayers.showCostHeatmap ? 'bg-orange-500' : 'bg-gray-200'} ${potholes.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${activeLayers.showCostHeatmap ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>

            </div>
          </div>

          <div className="mt-8">
            <StreamlitHeader title="Data Layers" icon={Layers} />
            <div className="bg-white p-3 rounded border border-gray-200">
              <LayerToggle
                label="Vehicles"
                active={activeLayers.vehicles}
                onToggle={() => toggleLayer('vehicles')}
                color="bg-blue-500"
              />
              {/* Individual Vehicle Files */}
              {activeLayers.vehicles && vehicleFiles.length > 0 && (
                <div className="mt-2 space-y-2 mb-4">
                  {vehicleFiles.map(file => (
                    <div key={file.id} className="ml-4 pl-2 border-l-2 border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center min-w-0">
                          <input
                            type="checkbox"
                            checked={file.visible}
                            onChange={() => toggleVehicleFile(file.id)}
                            className="h-3 w-3 text-blue-600 rounded focus:ring-blue-500 mr-2"
                          />
                          <span className="text-xs font-medium text-gray-700 truncate w-24" title={file.filename}>
                            {file.filename}
                          </span>
                        </div>
                        {deleteConfirm === file.id ? (
                          <button
                            onClick={(e) => handleDeleteVehicle(file.id, e)}
                            className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded hover:bg-red-600 transition-colors"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(file.id); setTimeout(() => setDeleteConfirm(null), 3000); }}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            title="Delete file"
                          >
                            <Trash size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <LayerToggle
                label="Potholes"
                active={activeLayers.potholes}
                onToggle={() => toggleLayer('potholes')}
                color="bg-red-500"
              />

              {/* Individual Pothole Files */}
              {activeLayers.potholes && potholeFiles.length > 0 && (
                <div className="mt-2 space-y-2 mb-4">
                  {potholeFiles.map(file => (
                    <div key={file.id} className="ml-4 pl-2 border-l-2 border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center min-w-0">
                          <input
                            type="checkbox"
                            checked={file.visible}
                            onChange={() => togglePotholeFile(file.id)}
                            className="h-3 w-3 text-blue-600 rounded focus:ring-blue-500 mr-2"
                          />
                          <span className="text-xs font-medium text-gray-700 truncate w-24" title={file.filename}>
                            {file.filename}
                          </span>
                        </div>
                        {deleteConfirm === file.id ? (
                          <button
                            onClick={(e) => handleDeletePothole(file.id, e)}
                            className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded hover:bg-red-600 transition-colors"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(file.id); setTimeout(() => setDeleteConfirm(null), 3000); }}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            title="Delete file"
                          >
                            <Trash size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <LayerToggle
                label="Cracks"
                active={activeLayers.cracks}
                onToggle={() => toggleLayer('cracks')}
                color="bg-orange-500"
              />

              {/* Individual Crack Files */}
              {activeLayers.cracks && crackFiles.length > 0 && (
                <div className="mt-2 space-y-2 mb-4">
                  {crackFiles.map(file => (
                    <div key={file.id} className="ml-4 pl-2 border-l-2 border-orange-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center min-w-0">
                          <input
                            type="checkbox"
                            checked={file.visible}
                            onChange={() => toggleCrackFile(file.id)}
                            className="h-3 w-3 text-orange-600 rounded focus:ring-orange-500 mr-2"
                          />
                          <span className="text-xs font-medium text-gray-700 truncate w-24" title={file.filename}>
                            {file.filename}
                          </span>
                        </div>
                        {deleteConfirm === file.id ? (
                          <button
                            onClick={(e) => handleDeleteCrack(file.id, e)}
                            className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded hover:bg-red-600 transition-colors"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(file.id); setTimeout(() => setDeleteConfirm(null), 3000); }}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            title="Delete file"
                          >
                            <Trash size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <LayerToggle
                label="Pavement"
                active={activeLayers.pavement}
                onToggle={() => toggleLayer('pavement')}
                color="bg-gray-500"
              />

              {/* Individual Pavement Files */}
              {activeLayers.pavement && pavementFiles.length > 0 && (
                <div className="mt-2 space-y-2 mb-4">
                  {pavementFiles.map(file => (
                    <div key={file.id} className="ml-4 pl-2 border-l-2 border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center min-w-0">
                          <input
                            type="checkbox"
                            checked={file.visible}
                            onChange={() => togglePavementFile(file.id)}
                            className="h-3 w-3 text-blue-600 rounded focus:ring-blue-500 mr-2"
                          />
                          <span className="text-xs font-medium text-gray-700 truncate w-24" title={file.filename}>
                            {file.filename}
                          </span>
                        </div>
                        {deleteConfirm === file.id ? (
                          <button
                            onClick={(e) => handleDeletePavement(file.id, e)}
                            className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded hover:bg-red-600 transition-colors"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(file.id); setTimeout(() => setDeleteConfirm(null), 3000); }}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            title="Delete file"
                          >
                            <Trash size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <LayerToggle
                label="IRI Segments"
                active={activeLayers.iri}
                onToggle={() => toggleLayer('iri')}
                color="bg-green-500"
              />

              {/* Individual IRI Files */}
              {activeLayers.iri && iriFiles.length > 0 && (
                <div className="mt-2 space-y-2">
                  {iriFiles.map(file => (
                    <div key={file.id} className="ml-4 pl-2 border-l-2 border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center min-w-0">
                          <input
                            type="checkbox"
                            checked={file.visible}
                            onChange={() => toggleIriFile(file.id)}
                            className="h-3 w-3 text-blue-600 rounded focus:ring-blue-500 mr-2"
                          />
                          <span className="text-xs font-medium text-gray-700 truncate w-20" title={file.filename}>
                            {file.filename}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Segment Length Badge - Click to Edit */}
                          <button
                            onClick={() => { setEditingSegmentFile(file.id); setEditSegmentLength(file.segmentLength || 100); }}
                            className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded hover:bg-green-200 transition-colors"
                            title="Click to change segment length"
                            disabled={isRecalculating}
                          >
                            {file.segmentLength || 100}m
                          </button>
                          {deleteConfirm === file.id ? (
                            <button
                              onClick={(e) => handleDeleteIri(file.id, e)}
                              className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded hover:bg-red-600 transition-colors"
                            >
                              Confirm
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(file.id); setTimeout(() => setDeleteConfirm(null), 3000); }}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1"
                              title="Delete file"
                            >
                              <Trash size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Per-file Segment Length Editor */}
                      {editingSegmentFile === file.id && (
                        <div className="bg-green-50 border border-green-200 rounded p-2 mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-medium text-gray-700">Segment Length</span>
                            <button onClick={() => setEditingSegmentFile(null)} className="text-gray-400 hover:text-gray-600">
                              <X size={12} />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-gray-500">25m</span>
                            <input
                              type="range"
                              min="25"
                              max="500"
                              step="25"
                              value={editSegmentLength}
                              onChange={(e) => setEditSegmentLength(parseInt(e.target.value, 10))}
                              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                              disabled={isRecalculating}
                            />
                            <span className="text-[9px] text-gray-500">500m</span>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs font-bold text-green-600">{editSegmentLength}m</span>
                            <button
                              onClick={() => recalculateSingleIri(file.id, editSegmentLength)}
                              disabled={isRecalculating}
                              className="bg-green-500 text-white text-[10px] px-2 py-1 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isRecalculating ? 'Processing...' : 'Apply'}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-1 text-[10px] text-gray-500">
                        <div>Avg IRI: <span className="font-semibold">{file.stats.averageIri.toFixed(2)}</span></div>
                        <div>Max IRI: <span className="font-semibold">{file.stats.maxIri.toFixed(2)}</span></div>
                        <div>Dist: <span className="font-semibold">{(file.stats.totalDistance / 1000).toFixed(2)}km</span></div>
                        <div>Speed: <span className="font-semibold">{file.stats.avgSpeed.toFixed(1)}m/s</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Global segment length slider removed - now using per-file editing */}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
