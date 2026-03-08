import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './DesktopHome.css';

// ── Icons (inline SVG — no extra dependency) ───────────────────────────────

const Icon = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  analytics: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  upload: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  reports: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  // Spinner is a function (not a static element) so each call produces a
  // fresh React element — prevents animation reset bugs on list re-renders.
  spinner: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dh-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  ),
  x: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  arrow: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
};

// ── Mock recent jobs (will be replaced with real API data in Part 2) ────────
const MOCK_JOBS = [
  { id: '1', status: 'Done', name: 'Maharlika Highway Survey', potholes: 42, cracks: 128, duration: '12m 45s' },
  { id: '2', status: 'Processing', progress: 78, name: 'Baguio City Arterial Road', potholes: null, cracks: null, duration: '08m 12s' },
  { id: '3', status: 'Done', name: 'Expressway Exit A-4 Scan', potholes: 8, cracks: 31, duration: '03m 12s' },
  { id: '4', status: 'Done', name: 'Main Square Intersection', potholes: 15, cracks: 44, duration: '05m 50s' },
  { id: '5', status: 'Failed', name: 'Night Drive Test Runway 1', potholes: null, cracks: null, duration: '00m 04s' },
];

// ── Greeting helper ─────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Main Component ──────────────────────────────────────────────────────────
const DesktopHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('home');
  const displayName = user?.name?.split(' ')[0] || 'Desktop User';

  // Navigation helper — routes to existing /app/* pages
  const go = (path) => navigate(path);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Icon.dashboard, path: '/app/dashboard' },
    { id: 'analytics', label: 'Analytics', icon: Icon.analytics, path: '/app/analytics' },
    { id: 'upload', label: 'Upload', icon: Icon.upload, path: '/app/dashboard' },
    { id: 'reports', label: 'Reports', icon: Icon.reports, path: '/app/analytics' },
    { id: 'settings', label: 'Settings', icon: Icon.settings, path: '/app/settings' },
  ];

  const quickActions = [
    { label: 'Dashboard', desc: 'Global view', icon: Icon.dashboard, colorClass: 'dh-qa-blue', path: '/app/dashboard' },
    { label: 'Analytics', desc: 'Trends & stats', icon: Icon.analytics, colorClass: 'dh-qa-purple', path: '/app/analytics' },
    { label: 'Reports', desc: 'Export PDF/CSV', icon: Icon.reports, colorClass: 'dh-qa-amber', path: '/app/analytics' },
    { label: 'Settings', desc: 'System config', icon: Icon.settings, colorClass: 'dh-qa-emerald', path: '/app/settings' },
  ];

  return (
    <div className="dh-root">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="dh-sidebar">
        <div className="dh-sidebar-logo">
          <div className="dh-logo-icon">E</div>
          <span className="dh-logo-text">Express AI</span>
        </div>

        <nav className="dh-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`dh-nav-item ${activeNav === item.id ? 'dh-nav-active' : ''}`}
              onClick={() => { setActiveNav(item.id); go(item.path); }}
            >
              <span className="dh-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="dh-sidebar-footer">
          <div className="dh-session-label">Local Session</div>
          <div className="dh-session-row">
            <span className="dh-session-user">desktop@local</span>
            <span className="dh-version-badge">v2.1.0</span>
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="dh-main">
        <div className="dh-content">

          {/* Header */}
          <header className="dh-header">
            <div>
              <h1 className="dh-greeting">{getGreeting()}, {displayName} 👋</h1>
              <p className="dh-subheading">Review your local processing jobs and system telemetry.</p>
            </div>
            <div className="dh-status-pills">
              <div className="dh-pill dh-pill-green">
                <span className="dh-ping-wrapper">
                  <span className="dh-ping" />
                  <span className="dh-ping-dot" />
                </span>
                Backend Running
              </div>
              <div className="dh-pill dh-pill-gray">SQLite · Local Storage</div>
            </div>
          </header>

          {/* Hero CTA Card */}
          <section className="dh-hero-card">
            <div className="dh-hero-glow dh-hero-glow-tr" />
            <div className="dh-hero-glow dh-hero-glow-bl" />
            <div className="dh-hero-body">
              <div>
                <h2 className="dh-hero-title">Process New Road Survey</h2>
                <p className="dh-hero-sub">
                  Initiate automated defect detection using YOLOv8. Supports high-res dashcam video and synchronized GPS log files.
                </p>
              </div>
              <div className="dh-hero-actions">
                <button className="dh-btn-primary" onClick={() => go('/app/dashboard')}>
                  {Icon.upload}
                  Upload Video + GPS
                </button>
                <button className="dh-btn-ghost" onClick={() => go('/app/analytics')}>
                  View Processing Jobs
                </button>
              </div>
            </div>
          </section>

          {/* Quick Actions */}
          <section className="dh-quick-grid">
            {quickActions.map((a) => (
              <button key={a.label} className={`dh-qa-card ${a.colorClass}`} onClick={() => go(a.path)}>
                <div className="dh-qa-icon-wrap">{a.icon}</div>
                <h3 className="dh-qa-label">{a.label}</h3>
                <p className="dh-qa-desc">{a.desc}</p>
              </button>
            ))}
          </section>

          {/* Recent Jobs Table */}
          <section className="dh-jobs-card">
            <div className="dh-jobs-header">
              <h2 className="dh-jobs-title">Recent Processing Jobs</h2>
              <button className="dh-view-all" onClick={() => go('/app/analytics')}>View All History</button>
            </div>
            <div className="dh-table-wrap">
              <table className="dh-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Job Name</th>
                    <th>Detections</th>
                    <th>Duration</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_JOBS.map((job) => (
                    <tr key={job.id} className="dh-table-row">
                      <td>
                        {job.status === 'Done' && (
                          <span className="dh-status dh-status-done">{Icon.check} Done</span>
                        )}
                        {job.status === 'Processing' && (
                          <span className="dh-status dh-status-proc">{Icon.spinner()} {job.progress}%</span>
                        )}
                        {job.status === 'Failed' && (
                          <span className="dh-status dh-status-fail">{Icon.x} Failed</span>
                        )}
                      </td>
                      <td className="dh-job-name">{job.name}</td>
                      <td>
                        {job.status === 'Done' ? (
                          <div className="dh-detection-pills">
                            <span className="dh-dpill dh-dpill-red">{job.potholes} Potholes</span>
                            <span className="dh-dpill dh-dpill-yellow">{job.cracks} Cracks</span>
                          </div>
                        ) : job.status === 'Processing' ? (
                          <span className="dh-text-muted-italic">Processing...</span>
                        ) : (
                          <span className="dh-text-fail">Input corrupted</span>
                        )}
                      </td>
                      <td className="dh-duration">{job.duration}</td>
                      <td style={{ textAlign: 'right' }}>
                        {job.status === 'Done' && (
                          <button className="dh-open-results" onClick={() => go('/app/analytics')}>
                            Open Results {Icon.arrow}
                          </button>
                        )}
                        {job.status === 'Failed' && (
                          <button className="dh-retry">Retry Scan</button>
                        )}
                        {job.status === 'Processing' && (
                          <span className="dh-pending">Pending...</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </main>

      {/* ── Status Footer ─────────────────────────────────────────────────── */}
      <footer className="dh-status-bar">
        <div className="dh-status-left">
          <div className="dh-status-item">
            <span className="dh-dot dh-dot-blue" />
            MODEL: <span className="dh-stat-val">YOLOv8n Loaded (GPU/CUDA)</span>
          </div>
          <div className="dh-storage-item">
            <span className="dh-storage-label">LOCAL STORAGE:</span>
            <div className="dh-storage-bar">
              <div className="dh-storage-fill" style={{ width: '65%' }} />
            </div>
            <span className="dh-stat-val">65%</span>
          </div>
          <div className="dh-status-item">
            <span className="dh-dot dh-dot-green" />
            BACKEND HEALTH: <span className="dh-stat-green">OPTIMAL</span>
          </div>
        </div>
        <div className="dh-status-right">
          <span>FPS: 60.0</span>
          <span>CPU: 12%</span>
          <span>GPU: 44%</span>
        </div>
      </footer>
    </div>
  );
};

export default DesktopHome;
