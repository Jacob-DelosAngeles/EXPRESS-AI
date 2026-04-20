import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProcessingStatus.css';

const IS_DESKTOP = !!(window.expressAI?.isDesktop);
const BACKEND_URL = IS_DESKTOP
    ? `http://127.0.0.1:${window.expressAI?.backendPort || 8000}`
    : '';

const STEPS = [
    { label: 'Validating inputs',    range: [0, 8]  },
    { label: 'Loading GPS data',     range: [8, 15] },
    { label: 'Extracting frames',    range: [15, 60] },
    { label: 'Running YOLO detection', range: [60, 62] },
    { label: 'Computing IRI',        range: [62, 80] },
    { label: 'Writing to database',  range: [80, 100] },
];

function getActiveStep(progress) {
    for (let i = STEPS.length - 1; i >= 0; i--) {
        if (progress >= STEPS[i].range[0]) return i;
    }
    return 0;
}

const ProcessingStatus = ({ jobId, jobName }) => {
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [error, setError] = useState(null);
    const [cancelling, setCancelling] = useState(false);
    const [confirmCancel, setConfirmCancel] = useState(false);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (!jobId) return;

        const poll = async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/api/v1/desktop/status/${jobId}`);
                if (!res.ok) throw new Error(`Status ${res.status}`);
                const data = await res.json();
                setJob(data);

                if (data.status === 'done' || data.status === 'failed' || data.status === 'cancelled') {
                    clearInterval(intervalRef.current);
                }
            } catch (e) {
                setError(`Cannot reach backend: ${e.message}`);
                clearInterval(intervalRef.current);
            }
        };

        poll(); // immediate first call
        intervalRef.current = setInterval(poll, 2000);
        return () => clearInterval(intervalRef.current);
    }, [jobId]);

    const handleCancel = async () => {
        if (!confirmCancel) {
            // First click: ask for confirmation
            setConfirmCancel(true);
            setTimeout(() => setConfirmCancel(false), 4000); // auto-reset after 4s
            return;
        }
        // Second click: confirmed
        setCancelling(true);
        setConfirmCancel(false);
        try {
            await fetch(`${BACKEND_URL}/api/v1/desktop/cancel/${jobId}`, { method: 'DELETE' });
        } catch (e) {
            console.warn('Cancel request failed:', e);
        } finally {
            setCancelling(false);
        }
    };

    if (!job) {
        return (
            <div className="ps-card ps-loading">
                <div className="ps-spinner" />
                <span>Connecting to pipeline…</span>
            </div>
        );
    }

    const activeStep = getActiveStep(job.progress);
    const isDone = job.status === 'done';
    const isFailed = job.status === 'failed';
    const isCancelled = job.status === 'cancelled';

    return (
        <div className={`ps-card ${isDone ? 'ps-done' : isFailed ? 'ps-failed' : ''}`}>
            {/* Job header */}
            <div className="ps-header">
                <div>
                    <h3 className="ps-job-name">{job.name || jobName}</h3>
                    <span className={`ps-badge ps-badge-${job.status}`}>
                        {{
                            queued: '🕐 Queued',
                            processing: '⚙️ Processing',
                            done: '✅ Complete',
                            failed: '❌ Failed',
                            cancelled: '⛔ Cancelled',
                        }[job.status] || job.status}
                    </span>
                </div>
                <div className="ps-header-right">
                    {isDone && (
                        <div className="ps-results-summary">
                            <span className="ps-pill ps-pill-red">{job.potholes} Potholes</span>
                            <span className="ps-pill ps-pill-yellow">{job.cracks} Cracks</span>
                            <span className="ps-pill ps-pill-blue">{job.iri_segments} IRI Segs</span>
                        </div>
                    )}
                    {/* Cancel button — visible while job is active */}
                    {(job.status === 'queued' || job.status === 'processing') && (
                        <button
                            className={`ps-cancel-btn ${confirmCancel ? 'ps-cancel-confirm' : ''}`}
                            onClick={handleCancel}
                            disabled={cancelling}
                            title="Stop this job"
                        >
                            {cancelling
                                ? <><span className="ps-mini-spinner" /> Stopping…</>
                                : confirmCancel
                                ? '⚠️ Confirm cancel?'
                                : '✕ Cancel Job'}
                        </button>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            {!isFailed && !isCancelled && (
                <div className="ps-progress-wrap">
                    <div className="ps-progress-bar">
                        <div
                            className={`ps-progress-fill ${isDone ? 'ps-fill-done' : ''}`}
                            style={{ width: `${job.progress}%` }}
                        />
                    </div>
                    <span className="ps-pct">{job.progress}%</span>
                </div>
            )}

            {/* Step indicator */}
            {!isDone && !isFailed && !isCancelled && (
                <div className="ps-steps">
                    {STEPS.map((step, i) => (
                        <div
                            key={step.label}
                            className={`ps-step ${
                                i < activeStep ? 'ps-step-done' :
                                i === activeStep ? 'ps-step-active' : ''
                            }`}
                        >
                            <span className="ps-step-dot" />
                            <span className="ps-step-label">{step.label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Error */}
            {isFailed && (
                <p className="ps-error">⚠️ {job.error || 'Pipeline failed. Check the backend logs.'}</p>
            )}

            {/* Done CTA */}
            {isDone && (
                <div className="ps-cta-row">
                    <button className="ps-cta-btn" onClick={() => navigate('/app/dashboard')}>
                        View on Dashboard →
                    </button>
                    <button className="ps-cta-ghost" onClick={() => navigate('/app/analytics')}>
                        Open Analytics
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProcessingStatus;
