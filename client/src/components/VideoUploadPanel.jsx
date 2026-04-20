import React, { useState, useRef, useCallback, useEffect } from 'react';
import './VideoUploadPanel.css';

const IS_DESKTOP = !!(window.expressAI?.isDesktop);
const BACKEND_URL = IS_DESKTOP
    ? `http://127.0.0.1:${window.expressAI?.backendPort || 8000}`
    : '';

// Task definitions — maps to a model filename in desktop/models/
const TASKS = [
    {
        id: 'pothole_detect',
        label: 'Pothole Detection',
        model: 'pothole_detection',
        desc: 'Detects potholes via bounding box + ByteTrack. Fast, CPU-friendly.',
        icon: '🕳️',
        output: 'bbox + confidence',
    },
    {
        id: 'pothole_seg',
        label: 'Pothole Segmentation',
        model: 'pothole_segmentation',
        desc: 'Segments potholes + estimates real-world area (m²) via IPM. Uses SAM 2 if available.',
        icon: '🔵',
        output: 'mask + area (m²)',
    },
    {
        id: 'crack_seg',
        label: 'Crack Segmentation',
        model: 'cracks_segmentation',
        desc: 'Segments crack networks + estimates length (m) via skeleton tracing.',
        icon: '⚡',
        output: 'mask + length (m)',
    },
    {
        id: 'road_classify',
        label: 'Road Classification',
        model: 'road_classification',
        desc: 'Classifies road surface per frame: Asphalt · Concrete · Unpaved.',
        icon: '🛣️',
        output: 'pavement type + GPS',
    },
    {
        id: 'traffic',
        label: 'Traffic Counting',
        model: 'traffic',
        desc: 'Counts vehicles (car/bus/truck/moto) via DeepSORT counting line. Uses YOLOv8s.',
        icon: '🚗',
        output: 'vehicle counts',
    },
    {
        id: 'full_survey',
        label: 'Full Survey',
        model: 'pothole_detection',  // primary; others queued
        desc: 'Runs Pothole Detection + Road Classification + IRI in sequence.',
        icon: '📡',
        output: 'all outputs',
    },
];

const VideoUploadPanel = ({ onJobStarted, onClose }) => {
    const [video, setVideo] = useState(null);
    const [gpsCsv, setGpsCsv] = useState(null);
    const [jobName, setJobName] = useState('');
    const [selectedTask, setSelectedTask] = useState(TASKS[0]);
    const [availableModels, setAvailableModels] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [dragOver, setDragOver] = useState(null); // 'video' | 'csv' | null

    const videoRef = useRef();
    const csvRef = useRef();

    // Fetch which .pt files are on disk so we can warn if a model is missing
    useEffect(() => {
        fetch(`${BACKEND_URL}/api/v1/desktop/models`)
            .then(r => r.ok ? r.json() : null)
            .then(data => setAvailableModels(data || {}))
            .catch(() => setAvailableModels({}));
    }, []);

    const modelKey = `${selectedTask.model.replace(/-/g, '_')}_ready`;
    const isModelMissing = Object.keys(availableModels || {}).length > 0 &&
        !availableModels[modelKey];
    const sam2Ready = availableModels?.sam2_ready;

    const handleDrop = useCallback((e, type) => {
        e.preventDefault();
        setDragOver(null);
        const file = e.dataTransfer.files[0];
        if (!file) return;
        if (type === 'video') {
            if (!file.name.match(/\.(mp4|avi|mov|mkv)$/i)) {
                setError('Video must be .mp4, .avi, .mov, or .mkv');
                return;
            }
            setVideo(file);
            if (!jobName) setJobName(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
        } else {
            if (!file.name.match(/\.csv$/i)) {
                setError('GPS file must be a .csv');
                return;
            }
            setGpsCsv(file);
        }
        setError(null);
    }, [jobName]);

    const handleSubmit = async () => {
        if (!video || !gpsCsv) {
            setError('Both video and GPS CSV are required.');
            return;
        }
        setError(null);
        setUploading(true);

        const formData = new FormData();
        formData.append('video', video);
        formData.append('gps_csv', gpsCsv);
        
        // Zero-copy fast path for Desktop/Electron
        if (video.path) formData.append('video_path_str', video.path);
        if (gpsCsv.path) formData.append('csv_path_str', gpsCsv.path);

        formData.append('job_name', jobName || selectedTask.label);
        formData.append('model_name', selectedTask.model);
        formData.append('task', selectedTask.id);

        try {
            const res = await fetch(`${BACKEND_URL}/api/v1/desktop/process`, {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Server error');
            }
            const data = await res.json();
            onJobStarted?.(data.job_id, data.name);
            onClose?.();
        } catch (e) {
            setError(`Upload failed: ${e.message}`);
        } finally {
            setUploading(false);
        }
    };

    const fmt = (bytes) => bytes < 1e6 ? `${(bytes / 1e3).toFixed(0)} KB` : `${(bytes / 1e6).toFixed(1)} MB`;

    return (
        <div className="vup-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
            <div className="vup-modal">
                {/* Header */}
                <div className="vup-header">
                    <div>
                        <h2 className="vup-title">Process New Road Survey</h2>
                        <p className="vup-subtitle">Upload a dashcam video and GPS/sensor CSV to run AI detection locally.</p>
                    </div>
                    <button className="vup-close" onClick={onClose}>✕</button>
                </div>

                {/* Task / Model selector */}
                <div className="vup-field">
                    <label className="vup-label">Detection Task</label>
                    <div className="vup-task-grid">
                        {TASKS.map(task => (
                            <button
                                key={task.id}
                                className={`vup-task-card ${selectedTask.id === task.id ? 'vup-task-active' : ''}`}
                                onClick={() => { setSelectedTask(task); setError(null); }}
                                title={task.desc}
                            >
                                <span className="vup-task-icon">{task.icon}</span>
                                <span className="vup-task-label">{task.label}</span>
                            </button>
                        ))}
                    </div>
                    <p className="vup-task-desc">{selectedTask.desc}</p>

                    {/* Model availability warning */}
                    {isModelMissing && (
                        <div className="vup-model-warn">
                            ⚠️ Model <code>{selectedTask.model}.pt</code> not found in <code>desktop/models/</code>.
                            Pipeline will run without AI detections.
                        </div>
                    )}
                    {!isModelMissing && Object.keys(availableModels || {}).length > 0 && (
                        <div className="vup-model-ok">
                            ✅ <code>{selectedTask.model}.pt</code> ready
                            {(selectedTask.id === 'pothole_seg' || selectedTask.id === 'crack_seg') && (
                                sam2Ready
                                    ? <span style={{ marginLeft: 8, color: '#60a5fa' }}>· SAM 2 ✅ (enhanced masks)</span>
                                    : <span style={{ marginLeft: 8, color: '#94a3b8' }}>· SAM 2 not found (using YOLO mask)</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Job Name */}
                <div className="vup-field">
                    <label className="vup-label">Survey Name (optional)</label>
                    <input
                        className="vup-input"
                        placeholder="e.g. Maharlika Highway Survey"
                        value={jobName}
                        onChange={e => setJobName(e.target.value)}
                    />
                </div>

                {/* Drop zones */}
                <div className="vup-drop-row">
                    {/* Video */}
                    <div
                        className={`vup-dropzone ${dragOver === 'video' ? 'vup-dz-active' : ''} ${video ? 'vup-dz-filled' : ''}`}
                        onDragOver={e => { e.preventDefault(); setDragOver('video'); }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={e => handleDrop(e, 'video')}
                        onClick={() => videoRef.current?.click()}
                    >
                        <input
                            ref={videoRef}
                            type="file"
                            accept=".mp4,.avi,.mov,.mkv"
                            style={{ display: 'none' }}
                            onChange={e => handleDrop({ preventDefault: () => {}, dataTransfer: { files: e.target.files } }, 'video')}
                        />
                        <span className="vup-dz-icon">{video ? '🎬' : '📹'}</span>
                        {video ? (
                            <div className="vup-dz-info">
                                <span className="vup-dz-name">{video.name}</span>
                                <span className="vup-dz-size">{fmt(video.size)}</span>
                            </div>
                        ) : (
                            <div className="vup-dz-info">
                                <span className="vup-dz-name">Drop video here</span>
                                <span className="vup-dz-size">.mp4 · .avi · .mov</span>
                            </div>
                        )}
                    </div>

                    {/* GPS CSV */}
                    <div
                        className={`vup-dropzone ${dragOver === 'csv' ? 'vup-dz-active' : ''} ${gpsCsv ? 'vup-dz-filled' : ''}`}
                        onDragOver={e => { e.preventDefault(); setDragOver('csv'); }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={e => handleDrop(e, 'csv')}
                        onClick={() => csvRef.current?.click()}
                    >
                        <input
                            ref={csvRef}
                            type="file"
                            accept=".csv"
                            style={{ display: 'none' }}
                            onChange={e => handleDrop({ preventDefault: () => {}, dataTransfer: { files: e.target.files } }, 'csv')}
                        />
                        <span className="vup-dz-icon">{gpsCsv ? '✅' : '📄'}</span>
                        {gpsCsv ? (
                            <div className="vup-dz-info">
                                <span className="vup-dz-name">{gpsCsv.name}</span>
                                <span className="vup-dz-size">{fmt(gpsCsv.size)}</span>
                            </div>
                        ) : (
                            <div className="vup-dz-info">
                                <span className="vup-dz-name">Drop GPS CSV here</span>
                                <span className="vup-dz-size">time, ax, ay, az, lat, lon, speed</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Error */}
                {error && <p className="vup-error">⚠️ {error}</p>}

                {/* CSV format hint */}
                <div className="vup-hint">
                    <strong>Required CSV columns:</strong> time · ax · ay · az · latitude · longitude · speed
                </div>

                {/* Actions */}
                <div className="vup-actions">
                    <button className="vup-btn-cancel" onClick={onClose} disabled={uploading}>Cancel</button>
                    <button
                        className="vup-btn-start"
                        onClick={handleSubmit}
                        disabled={!video || !gpsCsv || uploading}
                    >
                        {uploading ? (
                            <><span className="vup-spinner" /> Uploading...</>
                        ) : (
                            <>{selectedTask.icon} Start {selectedTask.label}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VideoUploadPanel;
