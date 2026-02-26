import React from 'react';
import LandingNavbar from '../components/LandingNavbar';
import './ProductsPage.css';

const ProductsPage = () => {
    return (
        <div className="pp-root">
            {/* ── Shared Landing Navbar ── */}
            <LandingNavbar />

            <main className="pp-main">
                {/* ── Hero ── */}
                <section className="pp-hero">
                    <div className="pp-hero-badge">
                        <span className="pp-badge-ping-wrapper">
                            <span className="pp-badge-ping"></span>
                            <span className="pp-badge-dot"></span>
                        </span>
                        New Version 2.0.0 Available
                    </div>

                    <h1 className="pp-hero-title">
                        <span>Road Evaluation,</span>{' '}
                        <span className="pp-gradient-text">Reimagined.</span>
                    </h1>

                    <p className="pp-hero-subtitle">
                        Professional grade road analysis directly from your desktop. Powered by offline-first AI processing for unparalleled speed and privacy.
                    </p>

                    {/* ── Product Showcase Card ── */}
                    <div className="pp-showcase-card">
                        {/* Ambient glows */}
                        <div className="pp-glow pp-glow-tr"></div>
                        <div className="pp-glow pp-glow-bl"></div>

                        <div className="pp-showcase-grid">
                            {/* Dashboard screenshot */}
                            <div className="pp-screenshot-col">
                                {/* Monitor mockup */}
                                <div className="pp-monitor">
                                    <div className="pp-monitor-bezel">
                                        <div className="pp-monitor-cam"></div>
                                        <div className="pp-monitor-screen">
                                            <img
                                                src="/screenshots/dashboard-mockup.jpg"
                                                alt="Express AI Desktop Dashboard"
                                                className="pp-screenshot-img"
                                            />
                                        </div>
                                    </div>
                                    <div className="pp-monitor-neck"></div>
                                    <div className="pp-monitor-base"></div>
                                </div>
                            </div>

                            {/* Product info panel */}
                            <div className="pp-info-col">
                                <div className="pp-info-header">
                                    <div className="pp-info-icon-box">
                                        <span className="material-symbols-outlined pp-info-icon">desktop_windows</span>
                                    </div>
                                    <div>
                                        <h3 className="pp-info-title">Desktop App</h3>
                                        <p className="pp-info-platform">Windows 10/11 • 64-bit Architecture</p>
                                    </div>
                                </div>

                                <div className="pp-divider"></div>

                                <div className="pp-meta-grid">
                                    <div className="pp-meta-item">
                                        <span className="pp-meta-label">Version</span>
                                        <span className="pp-meta-value">v2.0.0</span>
                                    </div>
                                    <div className="pp-meta-item">
                                        <span className="pp-meta-label">Size</span>
                                        <span className="pp-meta-value">176 MB</span>
                                    </div>
                                    <div className="pp-meta-item">
                                        <span className="pp-meta-label">License</span>
                                        <span className="pp-meta-value">Enterprise</span>
                                    </div>
                                    <div className="pp-meta-item">
                                        <span className="pp-meta-label">Last Update</span>
                                        <span className="pp-meta-value">Feb 2026</span>
                                    </div>
                                </div>

                                <div className="pp-cta-buttons">
                                    <a
                                        href="https://github.com/Jacob-DelosAngeles/DAAN-FERN/releases/download/v2.0.0/DAAN-FERN-Setup-2.0.0.exe"
                                        className="pp-download-btn"
                                        id="download-installer-btn"
                                        download
                                    >
                                        <span className="material-symbols-outlined pp-dl-icon">download</span>
                                        <span>Download Installer</span>
                                    </a>
                                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem', textAlign: 'center' }}>
                                        v2.0.0 &bull; Windows 10/11 64-bit &bull;{' '}
                                        <a
                                            href="https://github.com/Jacob-DelosAngeles/DAAN-FERN/releases"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: '#6b7280', textDecoration: 'underline' }}
                                        >
                                            View all releases
                                        </a>
                                    </p>
                                    <p style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.25rem', textAlign: 'center' }}>
                                        ⚠️ Windows may show a security warning. Click <strong>"More info"</strong> → <strong>"Run anyway"</strong> to proceed.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Key Features ── */}
                <section className="pp-features">
                    <h2 className="pp-section-title">Key Features</h2>
                    <div className="pp-features-grid">
                        <div className="pp-feature-card pp-feature-blue">
                            <div className="pp-feature-icon-box pp-fib-blue">
                                <span className="material-symbols-outlined">wifi_off</span>
                            </div>
                            <h3>Offline-First</h3>
                            <p>Process road data locally on your machine without needing a constant internet connection. Syncs automatically later.</p>
                        </div>
                        <div className="pp-feature-card pp-feature-cyan">
                            <div className="pp-feature-icon-box pp-fib-cyan">
                                <span className="material-symbols-outlined">speed</span>
                            </div>
                            <h3>Fast Processing</h3>
                            <p>Leverages local GPU acceleration to analyze high-resolution video feeds in near real-time with minimal latency.</p>
                        </div>
                        <div className="pp-feature-card pp-feature-purple">
                            <div className="pp-feature-icon-box pp-fib-purple">
                                <span className="material-symbols-outlined">security</span>
                            </div>
                            <h3>Data Privacy</h3>
                            <p>End-to-end encryption for all stored data. Your proprietary road metrics stay on your device until you decide to share.</p>
                        </div>
                        <div className="pp-feature-card pp-feature-emerald">
                            <div className="pp-feature-icon-box pp-fib-emerald">
                                <span className="material-symbols-outlined">join_full</span>
                            </div>
                            <h3>Full Feature Set</h3>
                            <p>Access the complete set of evaluation tools, detailed reporting engines, and versatile export options in one package.</p>
                        </div>
                    </div>
                </section>

                {/* ── How It Works + System Requirements ── */}
                <div className="pp-bottom-grid">
                    {/* How It Works */}
                    <section className="pp-how">
                        <h2 className="pp-section-title">How It Works</h2>
                        <div className="pp-timeline">
                            <div className="pp-timeline-item">
                                <div className="pp-step-num pp-step-active">1</div>
                                <div className="pp-step-content">
                                    <h3>Download Installer</h3>
                                    <p>Get the latest .exe file directly to your workstation. Ensure you have admin privileges for installation.</p>
                                </div>
                            </div>
                            <div className="pp-timeline-item">
                                <div className="pp-step-num">2</div>
                                <div className="pp-step-content">
                                    <h3>Sign in with Enterprise ID</h3>
                                    <p>Use your organization's credentials. SSO (Single Sign-On) is fully supported for seamless access.</p>
                                </div>
                            </div>
                            <div className="pp-timeline-item">
                                <div className="pp-step-num">3</div>
                                <div className="pp-step-content">
                                    <h3>Start Evaluating</h3>
                                    <p>Connect your camera feed or upload recorded footage to begin analyzing road conditions instantly.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* System Requirements */}
                    <section className="pp-sysreq">
                        <div className="pp-sysreq-card">
                            <div className="pp-sysreq-header">
                                <span className="material-symbols-outlined pp-sysreq-icon">settings_suggest</span>
                                <h2>System Requirements</h2>
                            </div>
                            <table className="pp-req-table">
                                <thead>
                                    <tr>
                                        <th>Component</th>
                                        <th>Minimum Requirement</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="pp-req-component">Operating System</td>
                                        <td className="pp-req-value">Windows 10/11 (64-bit)</td>
                                    </tr>
                                    <tr>
                                        <td className="pp-req-component">Processor</td>
                                        <td className="pp-req-value">Intel Core i5 or AMD Ryzen 5</td>
                                    </tr>
                                    <tr>
                                        <td className="pp-req-component">Memory (RAM)</td>
                                        <td className="pp-req-value">8 GB Min. (16 GB Rec.)</td>
                                    </tr>
                                    <tr>
                                        <td className="pp-req-component">Graphics</td>
                                        <td className="pp-req-value">NVIDIA GTX 1050 or higher</td>
                                    </tr>
                                    <tr>
                                        <td className="pp-req-component">Storage</td>
                                        <td className="pp-req-value">2 GB Available Space</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </main>

            {/* ── Footer ── */}
            <footer className="pp-footer">
                <div className="pp-footer-inner">
                    <div className="pp-footer-brand">
                        <div className="pp-footer-logo-row">
                            <img src="/logos/express-ai-logo.png" alt="Express AI" className="pp-footer-logo" />
                            <span className="pp-footer-name">Express AI</span>
                        </div>
                        <p className="pp-footer-copy">
                            © 2026 Express AI Technologies Inc. All rights reserved.<br />
                            Made for road evaluation professionals.
                        </p>
                    </div>
                    <div className="pp-footer-links">
                        <a href="#" className="pp-footer-link">Privacy Policy</a>
                        <a href="#" className="pp-footer-link">Terms of Service</a>
                        <a href="#" className="pp-footer-link">Support Center</a>
                        <a href="#" className="pp-footer-link">Contact Sales</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default ProductsPage;
